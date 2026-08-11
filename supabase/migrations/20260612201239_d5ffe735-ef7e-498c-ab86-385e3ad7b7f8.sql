
-- 1) Public lookup/search functions: drop PII (cargo/setor/perfil/negocio)
DROP FUNCTION IF EXISTS public.lookup_pre_registration(text, text);
CREATE FUNCTION public.lookup_pre_registration(_email text, _full_name text)
RETURNS TABLE(id uuid, full_name text, already_claimed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, (p.claimed_by IS NOT NULL) AS already_claimed
  FROM public.pre_registrations p
  WHERE (_email IS NOT NULL AND _email <> '' AND lower(p.email) = lower(_email))
     OR (_full_name IS NOT NULL AND _full_name <> '' AND p.name_normalized = public.normalize_name(_full_name))
  ORDER BY (lower(coalesce(p.email,'')) = lower(coalesce(_email,''))) DESC,
           (p.name_normalized = public.normalize_name(coalesce(_full_name,''))) DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.lookup_pre_registration(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_pre_registration(text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.search_pre_registrations(text, integer);
CREATE FUNCTION public.search_pre_registrations(_q text, _limit integer DEFAULT 5)
RETURNS TABLE(id uuid, full_name text, already_claimed boolean, similarity real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  with q as (select public.normalize_name(coalesce(_q,'')) as qn)
  select p.id, p.full_name, (p.claimed_by is not null) as already_claimed,
         similarity(p.name_normalized, (select qn from q)) as similarity
  from public.pre_registrations p, q
  where length(q.qn) >= 2
    and (p.name_normalized % q.qn or p.name_normalized ilike '%' || q.qn || '%')
  order by similarity desc, p.full_name asc
  limit greatest(1, least(_limit, 20));
$$;
REVOKE ALL ON FUNCTION public.search_pre_registrations(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_pre_registrations(text, integer) TO anon, authenticated;

-- 2) profiles.email column: hide from non-admin authenticated users
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;

-- helper for the logged-in user to read their own email
CREATE OR REPLACE FUNCTION public.my_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT email FROM public.profiles WHERE id = auth.uid() $$;
REVOKE ALL ON FUNCTION public.my_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;

-- 3) Lock sensitive profile columns against self-edit
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- prevent the row owner from tampering with sensitive fields
  NEW.wifi_bypass    := OLD.wifi_bypass;
  NEW.first_login_at := OLD.first_login_at;
  NEW.hero_id        := OLD.hero_id;
  NEW.negocio        := OLD.negocio;
  NEW.setor          := OLD.setor;
  NEW.active         := OLD.active;
  NEW.email          := OLD.email;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();
