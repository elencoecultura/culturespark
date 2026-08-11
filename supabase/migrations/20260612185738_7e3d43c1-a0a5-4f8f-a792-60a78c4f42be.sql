
-- Normalization helper (lowercase, no accents, trim)
CREATE OR REPLACE FUNCTION public.normalize_name(_s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(regexp_replace(translate(coalesce(_s,''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'),
    '\s+', ' ', 'g')))
$$;

CREATE TABLE IF NOT EXISTS public.pre_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (public.normalize_name(full_name)) STORED,
  email text,
  cargo text,
  setor text,
  perfil text NOT NULL,
  negocio text NOT NULL,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pre_reg_name_idx ON public.pre_registrations(name_normalized);
CREATE INDEX IF NOT EXISTS pre_reg_email_idx ON public.pre_registrations(lower(email));
CREATE INDEX IF NOT EXISTS pre_reg_negocio_idx ON public.pre_registrations(negocio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_registrations TO authenticated;
GRANT ALL ON public.pre_registrations TO service_role;

ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage pre_registrations"
  ON public.pre_registrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pre_registrations_updated_at
  BEFORE UPDATE ON public.pre_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public lookup function (SECURITY DEFINER, returns only display-safe fields)
CREATE OR REPLACE FUNCTION public.lookup_pre_registration(_email text, _full_name text)
RETURNS TABLE (
  id uuid,
  full_name text,
  cargo text,
  setor text,
  perfil text,
  negocio text,
  already_claimed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.cargo, p.setor, p.perfil, p.negocio,
         (p.claimed_by IS NOT NULL) AS already_claimed
  FROM public.pre_registrations p
  WHERE (_email IS NOT NULL AND lower(p.email) = lower(_email))
     OR (_full_name IS NOT NULL AND p.name_normalized = public.normalize_name(_full_name))
  ORDER BY (lower(coalesce(p.email,'')) = lower(coalesce(_email,''))) DESC,
           (p.name_normalized = public.normalize_name(coalesce(_full_name,''))) DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_pre_registration(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_pre_registration(text, text) TO anon, authenticated;

-- Map perfil text -> app_role
CREATE OR REPLACE FUNCTION public.map_perfil_to_role(_perfil text)
RETURNS public.app_role
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(_perfil,''))
    WHEN 'ADMIN' THEN 'admin'::public.app_role
    WHEN 'DIREÇÃO' THEN 'direcao'::public.app_role
    WHEN 'DIRECAO' THEN 'direcao'::public.app_role
    WHEN 'GERENTE' THEN 'gerente'::public.app_role
    WHEN 'LÍDER' THEN 'lider'::public.app_role
    WHEN 'LIDER' THEN 'lider'::public.app_role
    ELSE 'elenco'::public.app_role
  END
$$;

-- Update handle_new_user to use pre_registrations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hero_id text;
  v_pre public.pre_registrations%ROWTYPE;
  v_full_name text;
  v_role public.app_role;
BEGIN
  v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', '');
  v_hero_id := public.generate_hero_id();

  -- Try to find matching pre-registration (by email first, then by normalized name)
  SELECT * INTO v_pre
  FROM public.pre_registrations
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF NOT FOUND AND v_full_name <> '' THEN
    SELECT * INTO v_pre
    FROM public.pre_registrations
    WHERE name_normalized = public.normalize_name(v_full_name)
      AND claimed_by IS NULL
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, attraction, role_title, email, hero_id, negocio, setor)
  VALUES (
    NEW.id,
    coalesce(NULLIF(v_full_name,''), v_pre.full_name, ''),
    coalesce(NEW.raw_user_meta_data->>'attraction', v_pre.negocio),
    coalesce(NEW.raw_user_meta_data->>'role_title', v_pre.cargo),
    NEW.email,
    v_hero_id,
    v_pre.negocio,
    v_pre.setor
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
    attraction = COALESCE(EXCLUDED.attraction, public.profiles.attraction),
    role_title = COALESCE(EXCLUDED.role_title, public.profiles.role_title),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    negocio = COALESCE(EXCLUDED.negocio, public.profiles.negocio),
    setor = COALESCE(EXCLUDED.setor, public.profiles.setor);

  v_role := public.map_perfil_to_role(v_pre.perfil);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT DO NOTHING;

  IF v_pre.id IS NOT NULL THEN
    UPDATE public.pre_registrations
    SET claimed_by = NEW.id, claimed_at = now()
    WHERE id = v_pre.id;
  END IF;

  RETURN NEW;
END $$;

-- Migrate existing roles: messenger -> elenco, leader -> lider
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'elenco'::public.app_role FROM public.user_roles WHERE role = 'messenger'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'lider'::public.app_role FROM public.user_roles WHERE role = 'leader'
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles WHERE role IN ('messenger','leader');
