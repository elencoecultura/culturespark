-- Já aplicada em produção em 28/10/2026 (via SQL, junto com o fechamento do
-- ciclo 11/08 -> 28/10 10:35). Registrada aqui para o repositório não divergir.
--
-- 1) "Fechar ciclo atual" sempre dava Forbidden: o servidor chama esta função
--    com o service role (auth.uid() nulo) e ela exigia admin logado. EXECUTE
--    segue só para service_role/postgres, então liberar o auth.uid() nulo é seguro.
-- 2) current_cycle_start aceita "start_at" (instante exato) no app_settings,
--    para o ciclo novo começar na hora do fechamento e não à meia-noite.
--    Sem start_at continua igual (meia-noite de start_date, fuso SP).

create or replace function public.snapshot_gamification_cycle(_cycle_start timestamptz, _cycle_end timestamptz)
returns integer language plpgsql security definer set search_path to 'public' as $function$
DECLARE inserted_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  WITH agg AS (
    SELECT pe.user_id, SUM(pe.points)::int AS total_points, jsonb_object_agg(pe.kind, pe.kind_points) AS breakdown
    FROM (SELECT user_id, kind, SUM(points)::int AS kind_points, SUM(points)::int AS points
          FROM public.point_events WHERE created_at >= _cycle_start AND created_at < _cycle_end GROUP BY user_id, kind) pe
    GROUP BY pe.user_id
  ), rows AS (
    SELECT _cycle_start AS cycle_start, _cycle_end AS cycle_end, a.user_id, p.full_name, p.negocio, p.setor, p.attraction,
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = a.user_id ORDER BY ur.role LIMIT 1) AS role,
      a.total_points, a.breakdown
    FROM agg a LEFT JOIN public.profiles p ON p.id = a.user_id
  )
  INSERT INTO public.gamification_cycle_snapshots (cycle_start, cycle_end, user_id, full_name, negocio, setor, attraction, role, total_points, breakdown)
  SELECT cycle_start, cycle_end, user_id, full_name, negocio, setor, attraction, role, total_points, breakdown FROM rows
  ON CONFLICT (cycle_start, cycle_end, user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name, negocio = EXCLUDED.negocio, setor = EXCLUDED.setor, attraction = EXCLUDED.attraction,
        role = EXCLUDED.role, total_points = EXCLUDED.total_points, breakdown = EXCLUDED.breakdown;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $function$;
revoke execute on function public.snapshot_gamification_cycle(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.current_cycle_start()
returns timestamptz language plpgsql stable security definer set search_path to 'public' as $function$
DECLARE cfg jsonb; start_date date; start_at timestamptz; cycle_days int; today_sp date; elapsed int; cycle_index int;
BEGIN
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'gamification_cycle';
  IF cfg IS NULL THEN RETURN NULL; END IF;
  start_date := (cfg->>'start_date')::date;
  start_at := nullif(cfg->>'start_at', '')::timestamptz;
  cycle_days := GREATEST(1, COALESCE((cfg->>'cycle_days')::int, 60));
  today_sp := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  IF today_sp < start_date THEN
    RETURN coalesce(start_at, start_date::timestamp AT TIME ZONE 'America/Sao_Paulo');
  END IF;
  elapsed := today_sp - start_date;
  cycle_index := elapsed / cycle_days;
  IF cycle_index = 0 AND start_at IS NOT NULL THEN RETURN start_at; END IF;
  RETURN ((start_date + (cycle_index * cycle_days))::timestamp AT TIME ZONE 'America/Sao_Paulo');
END $function$;
revoke execute on function public.current_cycle_start() from public, anon;
grant execute on function public.current_cycle_start() to authenticated, service_role;
