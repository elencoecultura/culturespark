-- O calculo de streak usado pra dar a badge "Semana firme" (streak_7) era
-- puramente consecutivo, sem nenhuma tolerancia pra folga da escala (a
-- funcao getMyGamification no app ja tinha essa tolerancia desde antes,
-- mas essa funcao SQL que decide as badges nunca foi atualizada junto).
-- Resultado: quem esta na escala 6x1 (Trupe, Cozinha, Salao etc.) NUNCA
-- consegue a badge, porque toda semana tem 1 dia de folga obrigatorio que
-- quebrava a sequencia — e o limiar ainda pedia >=7 dias mesmo depois da
-- badge ter sido ajustada pra "6 check-ins na semana" (goal=6 no app).
--
-- Corrige os dois problemas:
--   1. tolera ate N dias de folga seguidos sem quebrar a sequencia (N=2
--      pra quem e' Hector Studios/5x2, N=1 pros demais/6x1 - mesma regra
--      ja usada no app)
--   2. streak_7 passa a exigir >=6 (nao mais >=7), batendo com a badge

CREATE OR REPLACE FUNCTION public.recompute_badges(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_xp int;
  streak int;
  weeks_full int;
  grace int;
BEGIN
  -- Total XP
  SELECT COALESCE(SUM(points),0) INTO total_xp FROM public.point_events WHERE user_id = _user_id;

  IF total_xp >= 100 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'veteran_100') ON CONFLICT DO NOTHING; END IF;
  IF total_xp >= 500 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'veteran_500') ON CONFLICT DO NOTHING; END IF;
  IF total_xp >= 1000 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'veteran_1000') ON CONFLICT DO NOTHING; END IF;

  -- Tolerância de folga: Hector Studios (5x2) tolera 2 dias seguidos sem
  -- check-in, o resto da casa (6x1) tolera 1.
  SELECT CASE WHEN UPPER(COALESCE(negocio,'')) = 'HECTOR STUDIOS' THEN 2 ELSE 1 END
    INTO grace FROM public.profiles WHERE id = _user_id;
  grace := COALESCE(grace, 1);

  -- Check-in streak (dias distintos com check-in, tolerando até `grace`
  -- dias de folga seguidos sem quebrar a sequência).
  WITH days AS (
    SELECT DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.mood_checkins WHERE user_id = _user_id
  ),
  with_lag AS (
    SELECT d, LAG(d) OVER (ORDER BY d) AS prev_d FROM days
  ),
  gapped AS (
    SELECT d,
      SUM(CASE WHEN d - prev_d > (grace + 1) THEN 1 ELSE 0 END)
        OVER (ORDER BY d) AS grp
    FROM with_lag
  ),
  groups AS (
    SELECT grp, COUNT(*)::int AS len, MAX(d) AS last_d FROM gapped GROUP BY grp
  )
  SELECT COALESCE(MAX(len),0) INTO streak
  FROM groups
  WHERE last_d >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - (grace + 1) * INTERVAL '1 day';

  IF streak >= 6 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'streak_7') ON CONFLICT DO NOTHING; END IF;
  IF streak >= 30 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'streak_30') ON CONFLICT DO NOTHING; END IF;
  IF streak >= 100 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'streak_100') ON CONFLICT DO NOTHING; END IF;

  -- Weeks with full schedule completed
  SELECT COUNT(*)::int INTO weeks_full FROM public.weekly_schedules
    WHERE user_id = _user_id AND completed_full = true;

  IF weeks_full >= 1 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'always_present_1') ON CONFLICT DO NOTHING; END IF;
  IF weeks_full >= 4 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'always_present_4') ON CONFLICT DO NOTHING; END IF;
  IF weeks_full >= 12 THEN INSERT INTO public.badges_awarded(user_id,badge_key) VALUES (_user_id,'always_present_12') ON CONFLICT DO NOTHING; END IF;
END $$;

-- Recalcula pra todo mundo ativo agora, uma vez só - assim quem já tinha
-- direito à badge mas nunca recebeu (por causa do bug acima) recebe já.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE active = true LOOP
    PERFORM public.recompute_badges(r.id);
  END LOOP;
END $$;
