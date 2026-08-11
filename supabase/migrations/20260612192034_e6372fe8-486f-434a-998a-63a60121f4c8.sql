
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings readable by authenticated"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings writable by admin insert"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "settings writable by admin update"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults (gamification cycle): start = today, length = 60 days
INSERT INTO public.app_settings(key, value)
VALUES ('gamification_cycle', jsonb_build_object(
  'start_date', to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
  'cycle_days', 60
))
ON CONFLICT (key) DO NOTHING;

-- Helper: returns the start timestamp (UTC) of the current cycle window.
CREATE OR REPLACE FUNCTION public.current_cycle_start()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb;
  start_date date;
  cycle_days int;
  today_sp date;
  elapsed int;
  cycle_index int;
  cycle_start_date date;
BEGIN
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'gamification_cycle';
  IF cfg IS NULL THEN
    RETURN NULL;
  END IF;
  start_date := (cfg->>'start_date')::date;
  cycle_days := GREATEST(1, COALESCE((cfg->>'cycle_days')::int, 60));
  today_sp := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  IF today_sp < start_date THEN
    RETURN (start_date::timestamp AT TIME ZONE 'America/Sao_Paulo');
  END IF;
  elapsed := today_sp - start_date;
  cycle_index := elapsed / cycle_days;
  cycle_start_date := start_date + (cycle_index * cycle_days);
  RETURN (cycle_start_date::timestamp AT TIME ZONE 'America/Sao_Paulo');
END $$;

GRANT EXECUTE ON FUNCTION public.current_cycle_start() TO authenticated;
