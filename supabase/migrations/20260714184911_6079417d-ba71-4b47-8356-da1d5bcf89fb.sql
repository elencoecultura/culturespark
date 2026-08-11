
-- ============================================================
-- FASE 1: Base, hierarquia e acessos
-- ============================================================

-- 1) profiles: novos campos de hierarquia e identificação
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS co_leader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS department text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON public.profiles (cpf) WHERE cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_manager_id_idx ON public.profiles (manager_id);
CREATE INDEX IF NOT EXISTS profiles_co_leader_id_idx ON public.profiles (co_leader_id);

-- Proteger novos campos sensíveis para não serem alterados pelo próprio usuário
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.wifi_bypass    := OLD.wifi_bypass;
  NEW.first_login_at := OLD.first_login_at;
  NEW.hero_id        := OLD.hero_id;
  NEW.negocio        := OLD.negocio;
  NEW.setor          := OLD.setor;
  NEW.active         := OLD.active;
  NEW.email          := OLD.email;
  NEW.cpf            := OLD.cpf;
  NEW.manager_id     := OLD.manager_id;
  NEW.co_leader_id   := OLD.co_leader_id;
  NEW.area           := OLD.area;
  NEW.department     := OLD.department;
  RETURN NEW;
END $function$;

-- 2) org_units: estrutura empresa → departamento → área
CREATE TABLE IF NOT EXISTS public.org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('atracao','departamento','area')),
  name text NOT NULL,
  parent_id uuid REFERENCES public.org_units(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name, parent_id)
);

GRANT SELECT ON public.org_units TO authenticated;
GRANT ALL ON public.org_units TO service_role;

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler org_units"
  ON public.org_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Somente admin modifica org_units"
  ON public.org_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER org_units_set_updated_at
  BEFORE UPDATE ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial de atrações (mantidas ativas); Clicks Mágicos e Trupe entram como inativas
INSERT INTO public.org_units (kind, name, active, sort_order) VALUES
  ('atracao','Hector Studios', true, 1),
  ('atracao','Pizzaria Ônyra', true, 2),
  ('atracao','Ferrovia Secreta', true, 3),
  ('atracao','Era do Fogo', true, 4),
  ('atracao','Castelo de Gelo', true, 5),
  ('atracao','Clicks Mágicos', false, 90),
  ('atracao','Trupe', false, 91)
ON CONFLICT (kind, name, parent_id) DO NOTHING;

-- 3) Auditoria de alterações em profiles
CREATE TABLE IF NOT EXISTS public.profile_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  before jsonb,
  after jsonb,
  changed_fields text[]
);

GRANT SELECT ON public.profile_audit_log TO authenticated;
GRANT ALL ON public.profile_audit_log TO service_role;

ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e direcao leem auditoria"
  ON public.profile_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'direcao'));

CREATE INDEX IF NOT EXISTS profile_audit_log_profile_idx ON public.profile_audit_log (profile_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.trg_profile_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_changed text[] := ARRAY[]::text[];
  v_key text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_audit_log(profile_id, changed_by, action, before, after)
    VALUES (NEW.id, auth.uid(), 'insert', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.profile_audit_log(profile_id, changed_by, action, before, after)
    VALUES (OLD.id, auth.uid(), 'delete', to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSE
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_after) LOOP
      IF v_before->v_key IS DISTINCT FROM v_after->v_key THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;
    IF array_length(v_changed,1) IS NOT NULL THEN
      INSERT INTO public.profile_audit_log(profile_id, changed_by, action, before, after, changed_fields)
      VALUES (NEW.id, auth.uid(), 'update', v_before, v_after, v_changed);
    END IF;
    RETURN NEW;
  END IF;
END $function$;

DROP TRIGGER IF EXISTS profiles_audit_trg ON public.profiles;
CREATE TRIGGER profiles_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profile_audit();

-- 4) Helpers de hierarquia (para RLS futuras da avaliação e painel do líder)
CREATE OR REPLACE FUNCTION public.is_leader_of(_leader uuid, _member uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _member
      AND (_leader = p.manager_id OR _leader = p.co_leader_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_manager uuid, _member uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Gerente do gestor: o gerente lidera o líder direto (ou co-líder) do membro
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.profiles l ON l.id = p.manager_id OR l.id = p.co_leader_id
    WHERE p.id = _member
      AND (l.manager_id = _manager OR l.co_leader_id = _manager)
  )
$$;
