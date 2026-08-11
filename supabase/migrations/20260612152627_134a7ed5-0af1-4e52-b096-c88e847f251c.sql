
-- Add registration fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hero_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS role_title text,
  ADD COLUMN IF NOT EXISTS email text;

-- Sequence for hero_id (atomic, race-condition-proof)
CREATE SEQUENCE IF NOT EXISTS public.hero_id_seq START WITH 1 INCREMENT BY 1;

-- Function to generate next hero_id: H-001, H-002, ...
CREATE OR REPLACE FUNCTION public.generate_hero_id()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'H-' || LPAD(nextval('public.hero_id_seq')::text, 3, '0')
$$;

-- Update handle_new_user to also persist attraction, role_title, email and hero_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hero_id text;
BEGIN
  v_hero_id := public.generate_hero_id();

  INSERT INTO public.profiles (id, full_name, attraction, role_title, email, hero_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'attraction',
    NEW.raw_user_meta_data->>'role_title',
    NEW.email,
    v_hero_id
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
    attraction = COALESCE(EXCLUDED.attraction, public.profiles.attraction),
    role_title = COALESCE(EXCLUDED.role_title, public.profiles.role_title),
    email = COALESCE(EXCLUDED.email, public.profiles.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'messenger')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill hero_id for existing profiles missing one (in created_at order)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE hero_id IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.profiles SET hero_id = public.generate_hero_id() WHERE id = r.id;
  END LOOP;
END $$;
