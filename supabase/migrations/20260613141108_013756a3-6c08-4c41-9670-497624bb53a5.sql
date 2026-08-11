
-- 1) Role mismatch: switch policies from 'leader' to 'lider' (matches map_perfil_to_role)
DROP POLICY IF EXISTS "leaders and admins read absences" ON public.journey_absences;
CREATE POLICY "leaders and admins read absences" ON public.journey_absences
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'lider'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "read mood" ON public.mood_checkins;
CREATE POLICY "read mood" ON public.mood_checkins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(), 'lider'::public.app_role)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "read own or leader/admin point events" ON public.point_events;
CREATE POLICY "read own or leader/admin point events" ON public.point_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(), 'lider'::public.app_role)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "leader write schedule" ON public.weekly_schedules;
CREATE POLICY "leader write schedule" ON public.weekly_schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'lider'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'lider'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "read schedule" ON public.weekly_schedules;
CREATE POLICY "read schedule" ON public.weekly_schedules
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(), 'lider'::public.app_role)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Column-level REVOKE: hide truly sensitive profile fields from authenticated/anon
REVOKE SELECT (wifi_bypass, first_login_at, email) ON public.profiles FROM authenticated;
REVOKE SELECT (wifi_bypass, first_login_at, email) ON public.profiles FROM anon;
REVOKE UPDATE (wifi_bypass, first_login_at) ON public.profiles FROM authenticated;
REVOKE UPDATE (wifi_bypass, first_login_at) ON public.profiles FROM anon;

-- 3) journey_progress: lock direct writes; expose validated SECURITY DEFINER RPC
DROP POLICY IF EXISTS "manage own journey" ON public.journey_progress;
CREATE POLICY "read own journey" ON public.journey_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(), 'lider'::public.app_role)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE INSERT, UPDATE, DELETE ON public.journey_progress FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.journey_progress FROM anon;

CREATE OR REPLACE FUNCTION public.complete_journey_step(_step_key text)
RETURNS public.journey_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.journey_progress;
  v_allowed_steps text[] := ARRAY[
    'welcome','profile_complete','first_checkin','first_schedule',
    'first_kudos','first_mood','first_iluminari','first_week_full'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _step_key IS NULL OR NOT (_step_key = ANY(v_allowed_steps)) THEN
    RAISE EXCEPTION 'Etapa inválida: %', _step_key;
  END IF;

  INSERT INTO public.journey_progress (user_id, step_key, completed_at)
  VALUES (auth.uid(), _step_key, now())
  ON CONFLICT (user_id, step_key) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.user_id IS NULL THEN
    SELECT * INTO v_row FROM public.journey_progress
    WHERE user_id = auth.uid() AND step_key = _step_key;
  END IF;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.complete_journey_step(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_journey_step(text) TO authenticated;
