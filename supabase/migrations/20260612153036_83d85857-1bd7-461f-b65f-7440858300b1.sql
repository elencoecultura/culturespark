
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz;

CREATE TABLE IF NOT EXISTS public.wifi_allowlist (
  ip text PRIMARY KEY,
  label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wifi_allowlist TO authenticated;
GRANT ALL ON public.wifi_allowlist TO service_role;

ALTER TABLE public.wifi_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage wifi_allowlist"
  ON public.wifi_allowlist
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
