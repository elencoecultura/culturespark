-- Réplica do estado de PRODUÇÃO (23/10/2026) das partes tocadas pela migração.
-- Definições copiadas do banco vivo (pg_get_functiondef / pg_policies / grants).
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb);
create schema storage;
create table storage.buckets(id text primary key, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
insert into storage.buckets values ('iluminari', false, 10000000, null), ('evaluation-documents', false, 10000000, null), ('journey-absences', false, 10000000, null);
grant usage on schema public to anon, authenticated, service_role;

create type public.app_role as enum ('admin','leader','messenger','elenco','lider','gerente','direcao');
create type public.job_status as enum ('pending','changes_requested','approved','rejected','in_recruitment','finished');
create type public.evaluation_status as enum ('nao_iniciada','em_andamento','pendente_lancamento','pendente_documento','concluida');
create sequence public.hero_id_seq;

create table public.profiles (id uuid primary key, full_name text not null default '', attraction text, weekly_hours int default 0,
  days_off text[] default '{}', active boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), hero_id text unique, role_title text, email text, first_login_at timestamptz,
  wifi_bypass boolean not null default false, negocio text, setor text, cpf text, manager_id uuid, co_leader_id uuid,
  area text, department text, birth_date date);
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role public.app_role not null,
  created_at timestamptz not null default now(), unique (user_id, role));
create table public.pre_registrations (id uuid primary key default gen_random_uuid(), full_name text not null, name_normalized text,
  email text, cargo text, setor text, perfil text not null, negocio text not null, claimed_by uuid, claimed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.mood_checkins (id uuid primary key default gen_random_uuid(), user_id uuid not null, mood smallint not null check (mood between 1 and 5),
  note text, created_at timestamptz not null default now());
create table public.kudos (id uuid primary key default gen_random_uuid(), from_user uuid not null, to_user uuid not null, message text not null,
  category text, created_at timestamptz not null default now(), flagged boolean not null default false, flag_reason text, check (from_user <> to_user));
create table public.weekly_schedules (id uuid primary key default gen_random_uuid(), week_start date not null, user_id uuid not null, attraction text not null,
  days_off text[] not null default '{}', weekly_hours int not null default 0, notes text, created_by uuid, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), completed_full boolean not null default false, unique (week_start, user_id));
create table public.point_events (id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text not null, points int not null,
  season text not null, ref_id text not null, created_at timestamptz not null default now(), unique (user_id, kind, ref_id));
create table public.journey_absences (id uuid primary key default gen_random_uuid(), user_id uuid not null, absence_date date not null, reason text,
  attachment_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, absence_date));
create table public.journey_progress (id uuid primary key default gen_random_uuid(), user_id uuid not null, step_key text not null,
  completed_at timestamptz not null default now(), unique (user_id, step_key));
create table public.job_requests (id uuid primary key default gen_random_uuid(), title text not null, status public.job_status not null default 'pending',
  decision_note text, decided_by uuid, decided_at timestamptz, created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.evaluations (id uuid primary key default gen_random_uuid(), cycle_id uuid not null, evaluatee_id uuid not null,
  status public.evaluation_status not null default 'nao_iniciada', notes text, published_at timestamptz, published_by uuid, completed_at timestamptz,
  updated_at timestamptz not null default now(), unique (cycle_id, evaluatee_id));
create table public.evaluation_evaluators (id uuid primary key default gen_random_uuid(), evaluation_id uuid not null, evaluator_id uuid not null,
  role text not null default 'lider', unique (evaluation_id, evaluator_id));
create table public.evaluation_documents (id uuid primary key default gen_random_uuid(), evaluation_id uuid not null, kind text not null check (kind in ('gerado','assinado')),
  storage_path text not null, mime_type text not null default 'application/pdf', uploaded_by uuid, created_at timestamptz not null default now());
create table public.nps_surveys (id uuid primary key default gen_random_uuid(), title text not null default 'x', opens_at timestamptz not null default now(),
  closes_at timestamptz not null, active boolean not null default true);
create table public.nps_responses (id uuid primary key default gen_random_uuid(), survey_id uuid not null, user_id uuid not null, score int not null check (score between 0 and 10),
  comment text, created_at timestamptz not null default now(), extra_scores jsonb not null default '{}', unique (survey_id, user_id));
create table public.profile_audit_log (id uuid primary key default gen_random_uuid(), profile_id uuid not null, changed_by uuid, changed_at timestamptz not null default now(),
  action text not null, before jsonb, after jsonb, changed_fields text[]);
create table public.app_settings (key text primary key, value jsonb not null);

-- Funções (corpo de produção)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $function$;
CREATE OR REPLACE FUNCTION public.is_evaluator_of(_evaluation_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.evaluation_evaluators WHERE evaluation_id = _evaluation_id AND evaluator_id = _user_id); $function$;
CREATE OR REPLACE FUNCTION public.is_leader_of(_leader uuid, _member uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _member AND (_leader = p.manager_id OR _leader = p.co_leader_id)) $function$;
CREATE OR REPLACE FUNCTION public.is_manager_of(_manager uuid, _member uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.profiles p JOIN public.profiles l ON l.id = p.manager_id OR l.id = p.co_leader_id
  WHERE p.id = _member AND (l.manager_id = _manager OR l.co_leader_id = _manager)) $function$;
create or replace function public.can_access_evaluation(_evaluation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'admin') or exists (select 1 from public.evaluations e where e.id = _evaluation_id and (
        (e.evaluatee_id = _user_id and e.published_at is not null) or public.is_evaluator_of(e.id, _user_id)
        or exists (select 1 from public.profiles p where p.id = e.evaluatee_id and (p.manager_id = _user_id or p.co_leader_id = _user_id)
            and (public.has_role(_user_id,'lider') or public.has_role(_user_id,'leader') or public.has_role(_user_id,'gerente') or public.has_role(_user_id,'direcao')))));
$$;
CREATE OR REPLACE FUNCTION public.can_view_user_data(_target_user_id uuid, _viewer_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select public.has_role(_viewer_id, 'admin'::public.app_role)
    or exists (select 1 from public.profiles v where v.id = _viewer_id and (v.attraction = 'TODOS' or v.negocio = 'TODOS'))
    or exists (select 1 from public.profiles v join public.profiles t on t.id = _target_user_id where v.id = _viewer_id
        and (public.has_role(_viewer_id, 'gerente'::public.app_role) or public.has_role(_viewer_id, 'direcao'::public.app_role)) and v.attraction = t.attraction)
    or exists (select 1 from public.profiles t where t.id = _target_user_id and t.manager_id = _viewer_id
        and (public.has_role(_viewer_id, 'lider'::public.app_role) or public.has_role(_viewer_id, 'leader'::public.app_role)
             or public.has_role(_viewer_id, 'gerente'::public.app_role) or public.has_role(_viewer_id, 'direcao'::public.app_role)))
$function$;
CREATE OR REPLACE FUNCTION public.map_perfil_to_role(_perfil text) RETURNS app_role LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ SELECT CASE upper(coalesce(_perfil,'')) WHEN 'ADMIN' THEN 'admin'::public.app_role WHEN 'DIREÇÃO' THEN 'direcao'::public.app_role
  WHEN 'DIRECAO' THEN 'direcao'::public.app_role WHEN 'GERENTE' THEN 'gerente'::public.app_role WHEN 'LÍDER' THEN 'lider'::public.app_role
  WHEN 'LIDER' THEN 'lider'::public.app_role ELSE 'elenco'::public.app_role END $function$;
CREATE OR REPLACE FUNCTION public.normalize_name(_s text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ SELECT lower(trim(regexp_replace(translate(coalesce(_s,''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '\s+', ' ', 'g'))) $function$;
CREATE OR REPLACE FUNCTION public.generate_hero_id() RETURNS text LANGUAGE sql SET search_path TO 'public'
AS $function$ SELECT 'H-' || LPAD(nextval('public.hero_id_seq')::text, 3, '0') $function$;
CREATE OR REPLACE FUNCTION public.current_season(_at timestamp with time zone DEFAULT now()) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ SELECT EXTRACT(YEAR FROM _at)::int || '-Q' || (((EXTRACT(MONTH FROM _at)::int - 1) / 3) + 1)::text $function$;
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _kind text, _points integer, _ref_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN INSERT INTO public.point_events(user_id, kind, points, season, ref_id) VALUES (_user_id, _kind, _points, current_season(), _ref_id)
  ON CONFLICT (user_id, kind, ref_id) DO NOTHING; END $function$;
revoke execute on function public.award_points(uuid,text,integer,text) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.trg_award_checkin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE day_key text; BEGIN day_key := 'day:' || ((NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::date)::text;
  PERFORM public.award_points(NEW.user_id, 'checkin', 5, day_key); RETURN NEW; END $function$;
CREATE OR REPLACE FUNCTION public.trg_award_kudos() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN PERFORM public.award_points(NEW.from_user, 'kudos_sent', 3, NEW.id::text); PERFORM public.award_points(NEW.to_user, 'kudos_received', 5, NEW.id::text); RETURN NEW; END $function$;
CREATE OR REPLACE FUNCTION public.trg_award_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN IF NEW.completed_full = true AND (TG_OP = 'INSERT' OR OLD.completed_full IS DISTINCT FROM true) THEN
    PERFORM public.award_points(NEW.user_id, 'schedule_completed', 20, NEW.id::text); END IF; RETURN NEW; END $function$;
CREATE OR REPLACE FUNCTION public.trg_auto_complete_week() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE v_negocio text; v_attraction text; v_weekly_hours int; v_week_start date; v_required int; v_days_checked int;
BEGIN
  SELECT negocio, attraction, weekly_hours INTO v_negocio, v_attraction, v_weekly_hours FROM public.profiles WHERE id = NEW.user_id;
  v_required := CASE WHEN UPPER(COALESCE(v_negocio,'')) = 'HECTOR STUDIOS' THEN 5 ELSE 6 END;
  v_week_start := date_trunc('week', (NEW.created_at AT TIME ZONE 'America/Sao_Paulo'))::date;
  SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) INTO v_days_checked FROM public.mood_checkins
  WHERE user_id = NEW.user_id AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= v_week_start AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date < v_week_start + 7;
  IF v_days_checked >= v_required THEN
    INSERT INTO public.weekly_schedules(user_id, week_start, attraction, weekly_hours, completed_full, created_by)
    VALUES (NEW.user_id, v_week_start, COALESCE(v_attraction, 'Hector Studios'), COALESCE(v_weekly_hours, 44), true, NEW.user_id)
    ON CONFLICT (week_start, user_id) DO UPDATE SET completed_full = true WHERE public.weekly_schedules.completed_full IS DISTINCT FROM true;
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  NEW.wifi_bypass := OLD.wifi_bypass; NEW.first_login_at := OLD.first_login_at; NEW.hero_id := OLD.hero_id; NEW.negocio := OLD.negocio;
  NEW.setor := OLD.setor; NEW.active := OLD.active; NEW.email := OLD.email; NEW.cpf := OLD.cpf; NEW.manager_id := OLD.manager_id;
  NEW.co_leader_id := OLD.co_leader_id; NEW.area := OLD.area; NEW.department := OLD.department; RETURN NEW; END $function$;
CREATE OR REPLACE FUNCTION public.trg_profile_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN IF TG_OP = 'INSERT' THEN INSERT INTO public.profile_audit_log(profile_id, changed_by, action, before, after) VALUES (NEW.id, auth.uid(), 'insert', NULL, to_jsonb(NEW)); RETURN NEW;
  ELSE INSERT INTO public.profile_audit_log(profile_id, changed_by, action, before, after) VALUES (NEW.id, auth.uid(), 'update', to_jsonb(OLD), to_jsonb(NEW)); RETURN NEW; END IF; END $function$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_hero_id text; v_pre public.pre_registrations%ROWTYPE; v_full_name text; v_role public.app_role;
BEGIN
  v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', ''); v_hero_id := public.generate_hero_id();
  SELECT * INTO v_pre FROM public.pre_registrations WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF NOT FOUND AND v_full_name <> '' THEN
    SELECT * INTO v_pre FROM public.pre_registrations WHERE name_normalized = public.normalize_name(v_full_name) AND claimed_by IS NULL LIMIT 1;
  END IF;
  INSERT INTO public.profiles (id, full_name, attraction, role_title, email, hero_id, negocio, setor)
  VALUES (NEW.id, coalesce(NULLIF(v_full_name,''), v_pre.full_name, ''), coalesce(NEW.raw_user_meta_data->>'attraction', v_pre.negocio),
    coalesce(NEW.raw_user_meta_data->>'role_title', v_pre.cargo), NEW.email, v_hero_id, v_pre.negocio, v_pre.setor)
  ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
    attraction = COALESCE(EXCLUDED.attraction, public.profiles.attraction), role_title = COALESCE(EXCLUDED.role_title, public.profiles.role_title),
    email = COALESCE(EXCLUDED.email, public.profiles.email), negocio = COALESCE(EXCLUDED.negocio, public.profiles.negocio), setor = COALESCE(EXCLUDED.setor, public.profiles.setor);
  v_role := public.map_perfil_to_role(v_pre.perfil);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
  IF v_pre.id IS NOT NULL THEN UPDATE public.pre_registrations SET claimed_by = NEW.id, claimed_at = now() WHERE id = v_pre.id; END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.my_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$ SELECT email FROM public.profiles WHERE id = auth.uid() $function$;
CREATE OR REPLACE FUNCTION public.complete_journey_step(_step_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ BEGIN END $function$;
CREATE OR REPLACE FUNCTION public.current_cycle_start() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$ select now() $function$;
CREATE OR REPLACE FUNCTION public.generate_evaluations_for_cycle(_cycle_id uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF; RETURN 0; END $function$;
CREATE OR REPLACE FUNCTION public.lookup_pre_registration(_email text, _full_name text) RETURNS TABLE(id uuid, full_name text, already_claimed boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT p.id, p.full_name, (p.claimed_by IS NOT NULL) FROM public.pre_registrations p WHERE lower(p.email) = lower(_email) OR p.name_normalized = public.normalize_name(_full_name) LIMIT 1 $function$;
CREATE OR REPLACE FUNCTION public.search_pre_registrations(_q text, _limit integer DEFAULT 5) RETURNS TABLE(id uuid, full_name text, already_claimed boolean, similarity real) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select p.id, p.full_name, (p.claimed_by is not null), 1::real from public.pre_registrations p where p.name_normalized ilike '%' || public.normalize_name(_q) || '%' limit _limit $function$;
-- grants de execução como em produção
grant execute on function public.lookup_pre_registration(text,text) to anon, authenticated, service_role;
grant execute on function public.search_pre_registrations(text,integer) to anon, authenticated, service_role;
grant all on all functions in schema public to service_role;

-- Triggers de produção
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger trg_protect_profile_sensitive_fields before update on public.profiles for each row execute function public.protect_profile_sensitive_fields();
create trigger profiles_audit_trg after insert or update on public.profiles for each row execute function public.trg_profile_audit();
create trigger award_checkin_points after insert on public.mood_checkins for each row execute function public.trg_award_checkin();
create trigger auto_complete_week after insert on public.mood_checkins for each row execute function public.trg_auto_complete_week();
create trigger award_kudos_points after insert on public.kudos for each row execute function public.trg_award_kudos();
create trigger award_schedule_points after insert or update on public.weekly_schedules for each row execute function public.trg_award_schedule();

-- RLS e policies de produção
alter table public.profiles enable row level security; alter table public.user_roles enable row level security;
alter table public.pre_registrations enable row level security; alter table public.mood_checkins enable row level security;
alter table public.kudos enable row level security; alter table public.weekly_schedules enable row level security;
alter table public.point_events enable row level security; alter table public.journey_absences enable row level security;
alter table public.journey_progress enable row level security; alter table public.job_requests enable row level security;
alter table public.evaluations enable row level security; alter table public.evaluation_evaluators enable row level security;
alter table public.evaluation_documents enable row level security; alter table public.nps_surveys enable row level security;
alter table public.nps_responses enable row level security; alter table public.profile_audit_log enable row level security;
create policy "admin manage profiles" on public.profiles for all to authenticated using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));
create policy "read all profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or has_role(auth.uid(), 'admin'));
create policy "admin manage pre_registrations" on public.pre_registrations for all to authenticated using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));
create policy "insert own mood" on public.mood_checkins for insert to authenticated with check (user_id = auth.uid());
create policy "read mood" on public.mood_checkins for select to authenticated using (user_id = auth.uid() or has_role(auth.uid(), 'lider') or has_role(auth.uid(), 'admin'));
create policy "insert own kudos" on public.kudos for insert to authenticated with check (from_user = auth.uid());
create policy "read own kudos" on public.kudos for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
create policy "leader write schedule" on public.weekly_schedules for all to authenticated using (has_role(auth.uid(), 'lider') or has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'lider') or has_role(auth.uid(), 'admin'));
create policy "read schedule" on public.weekly_schedules for select to authenticated using (user_id = auth.uid() or has_role(auth.uid(), 'lider') or has_role(auth.uid(), 'admin'));
create policy "read own or leadership/admin point events" on public.point_events for select to authenticated using (user_id = auth.uid() or has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'lider') or has_role(auth.uid(), 'gerente') or has_role(auth.uid(), 'direcao'));
create policy "owner manages own absences" on public.journey_absences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "leaders and admins read absences" on public.journey_absences for select to authenticated using (has_role(auth.uid(), 'lider') or has_role(auth.uid(), 'admin'));
create policy "read own journey" on public.journey_progress for select to authenticated using (user_id = auth.uid() or has_role(auth.uid(), 'lider') or has_role(auth.uid(), 'admin'));
create policy "jobs_insert_leader_or_admin" on public.job_requests for insert to authenticated with check (created_by = auth.uid() and (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'lider')));
create policy "jobs_select_owner_leader" on public.job_requests for select to authenticated using (created_by = auth.uid() and has_role(auth.uid(), 'lider'));
create policy "jobs_select_admin" on public.job_requests for select to authenticated using (has_role(auth.uid(), 'admin'));
create policy "jobs_update_leader_own_pending" on public.job_requests for update to authenticated
  using (created_by = auth.uid() and has_role(auth.uid(), 'lider') and status in ('pending','changes_requested'))
  with check (created_by = auth.uid() and status in ('pending','changes_requested'));
create policy "jobs_update_admin" on public.job_requests for update to authenticated using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));
create policy "evaluations_select_scoped" on public.evaluations for select to authenticated using (can_access_evaluation(id, auth.uid()));
create policy "evaluations_update_evaluators_admin" on public.evaluations for update to authenticated using (has_role(auth.uid(), 'admin') or is_evaluator_of(id, auth.uid())) with check (has_role(auth.uid(), 'admin') or is_evaluator_of(id, auth.uid()));
create policy "eval_evaluators_select" on public.evaluation_evaluators for select to authenticated using (can_access_evaluation(evaluation_id, auth.uid()));
create policy "docs_write_evaluators" on public.evaluation_documents for all to authenticated using (has_role(auth.uid(), 'admin') or is_evaluator_of(evaluation_id, auth.uid())) with check (has_role(auth.uid(), 'admin') or is_evaluator_of(evaluation_id, auth.uid()));
create policy "docs_select_scoped" on public.evaluation_documents for select to authenticated using (can_access_evaluation(evaluation_id, auth.uid()));
create policy "nps_surveys_read" on public.nps_surveys for select to authenticated using (true);
create policy nps_resp_insert_own on public.nps_responses for insert to authenticated with check (user_id = auth.uid());
create policy nps_resp_read_own on public.nps_responses for select to authenticated using (user_id = auth.uid() or has_role(auth.uid(), 'admin'));
create policy nps_resp_update_own on public.nps_responses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "absences owner read" on storage.objects for select to authenticated using (bucket_id = 'journey-absences' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "absences leaders read" on storage.objects for select to authenticated using (bucket_id = 'journey-absences' and (has_role(auth.uid(), 'leader') or has_role(auth.uid(), 'admin')));

-- Grants de tabela como em produção (ALL para anon/authenticated; journey_progress só SELECT)
grant all on all tables in schema public to anon, authenticated, service_role;
revoke insert, update, delete on public.journey_progress from anon, authenticated;
grant all on all sequences in schema public to anon, authenticated, service_role;
