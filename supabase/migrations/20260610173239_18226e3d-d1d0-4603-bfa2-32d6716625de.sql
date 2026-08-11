
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','leader','messenger');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  attraction text,
  weekly_hours int DEFAULT 0,
  days_off text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'messenger')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mood checkins
CREATE TABLE public.mood_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mood_checkins TO authenticated;
GRANT ALL ON public.mood_checkins TO service_role;
ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own mood" ON public.mood_checkins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "read mood" ON public.mood_checkins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'leader') OR public.has_role(auth.uid(),'admin'));

-- Kudos
CREATE TABLE public.kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kudos TO authenticated;
GRANT ALL ON public.kudos TO service_role;
ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read kudos" ON public.kudos FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own kudos" ON public.kudos FOR INSERT TO authenticated WITH CHECK (from_user = auth.uid());

-- Journey progress
CREATE TABLE public.journey_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_key)
);
GRANT SELECT, INSERT, DELETE ON public.journey_progress TO authenticated;
GRANT ALL ON public.journey_progress TO service_role;
ALTER TABLE public.journey_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own journey" ON public.journey_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Weekly schedules
CREATE TABLE public.weekly_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attraction text NOT NULL,
  days_off text[] NOT NULL DEFAULT '{}',
  weekly_hours int NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_schedules TO authenticated;
GRANT ALL ON public.weekly_schedules TO service_role;
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER weekly_schedules_updated_at BEFORE UPDATE ON public.weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "read schedule" ON public.weekly_schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'leader') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "leader write schedule" ON public.weekly_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'leader') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'leader') OR public.has_role(auth.uid(),'admin'));

-- Seed: promote mensageiro@hectorstudios.com.br to admin and create profile
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'mensageiro@hectorstudios.com.br' LIMIT 1;
  IF uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name) VALUES (uid, 'Mensageiro Hector')
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
      ON CONFLICT DO NOTHING;
  END IF;
END $$;
