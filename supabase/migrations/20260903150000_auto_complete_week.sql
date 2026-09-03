-- "Semana cumprida" (+20 pontos) deixa de depender do líder marcar na mão.
-- Agora é automático: toda vez que a pessoa faz um check-in, o sistema
-- confere se ela já bateu o número de dias exigido pela escala dela nessa
-- semana (6 dias pra 6x1, 5 pra Hector Studios/5x2 — mesma tolerância já
-- usada no streak/badge) e, se sim, marca weekly_schedules.completed_full
-- = true sozinho. O botão manual "Marcar semana cumprida" continua
-- existindo (útil pra corrigir algum caso excepcional), mas não é mais o
-- caminho normal.
--
-- De quebra corrige um bug: o trigger que dá os pontos (trg_award_schedule)
-- só disparava em UPDATE — se a linha de weekly_schedules nunca existia
-- antes (o caso mais comum, já que a feature de escala nunca teve tela
-- própria) e alguém criava ela já com completed_full=true de uma vez
-- (INSERT direto), o trigger nunca rodava e os 20 pontos não saíam.

CREATE OR REPLACE FUNCTION public.trg_award_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed_full = true AND (TG_OP = 'INSERT' OR OLD.completed_full IS DISTINCT FROM true) THEN
    PERFORM public.award_points(NEW.user_id, 'schedule_completed', 20, NEW.id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS award_schedule_points ON public.weekly_schedules;
CREATE TRIGGER award_schedule_points AFTER INSERT OR UPDATE ON public.weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_schedule();

-- Detecta e marca a semana cumprida sozinho, toda vez que rola um check-in.
CREATE OR REPLACE FUNCTION public.trg_auto_complete_week()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_negocio text;
  v_attraction text;
  v_weekly_hours int;
  v_week_start date;
  v_required int;
  v_days_checked int;
BEGIN
  SELECT negocio, attraction, weekly_hours INTO v_negocio, v_attraction, v_weekly_hours
  FROM public.profiles WHERE id = NEW.user_id;

  -- 6x1 (maioria da casa) precisa de 6 dias distintos com check-in na
  -- semana; Hector Studios (5x2) precisa de 5.
  v_required := CASE WHEN UPPER(COALESCE(v_negocio,'')) = 'HECTOR STUDIOS' THEN 5 ELSE 6 END;

  -- Semana de segunda a domingo, no fuso de São Paulo (date_trunc('week',...)
  -- já considera segunda como início, igual ao getWeekStart() do app).
  v_week_start := date_trunc('week', (NEW.created_at AT TIME ZONE 'America/Sao_Paulo'))::date;

  SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) INTO v_days_checked
  FROM public.mood_checkins
  WHERE user_id = NEW.user_id
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= v_week_start
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date < v_week_start + 7;

  IF v_days_checked >= v_required THEN
    INSERT INTO public.weekly_schedules(user_id, week_start, attraction, weekly_hours, completed_full, created_by)
    VALUES (NEW.user_id, v_week_start, COALESCE(v_attraction, 'Hector Studios'), COALESCE(v_weekly_hours, 44), true, NEW.user_id)
    ON CONFLICT (week_start, user_id) DO UPDATE
      SET completed_full = true
      WHERE public.weekly_schedules.completed_full IS DISTINCT FROM true;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_complete_week ON public.mood_checkins;
CREATE TRIGGER auto_complete_week AFTER INSERT ON public.mood_checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_complete_week();

-- Sem passada retroativa: só conta a partir de agora, semana corrente em
-- diante. Ninguém ganha os 20 pontos de semanas passadas de uma vez.
