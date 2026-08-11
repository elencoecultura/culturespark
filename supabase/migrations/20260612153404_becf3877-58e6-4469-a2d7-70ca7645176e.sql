
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wifi_bypass boolean NOT NULL DEFAULT false;
