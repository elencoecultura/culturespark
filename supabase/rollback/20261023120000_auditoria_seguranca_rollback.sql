-- Reversão da 20261023120000_auditoria_seguranca.sql: devolve o banco ao
-- estado de produção de 23/10/2026 (definições e policies lidas do banco
-- vivo antes da migração). Só usar se algo legítimo quebrar; reabre as
-- falhas corrigidas. Se reverter o banco, reverta também o deploy do código
-- se precisar que o browser volte a gravar check-in/elogio direto.

-- 1
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create or replace function public.protect_profile_sensitive_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
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

-- 2
create or replace function public.can_view_user_data(_target_user_id uuid, _viewer_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select
    public.has_role(_viewer_id, 'admin'::public.app_role)
    or exists (
      select 1 from public.profiles v
      where v.id = _viewer_id and (v.attraction = 'TODOS' or v.negocio = 'TODOS')
    )
    or exists (
      select 1 from public.profiles v
      join public.profiles t on t.id = _target_user_id
      where v.id = _viewer_id
        and (public.has_role(_viewer_id, 'gerente'::public.app_role)
             or public.has_role(_viewer_id, 'direcao'::public.app_role))
        and v.attraction = t.attraction
    )
    or exists (
      select 1 from public.profiles t
      where t.id = _target_user_id and t.manager_id = _viewer_id
        and (public.has_role(_viewer_id, 'lider'::public.app_role)
             or public.has_role(_viewer_id, 'leader'::public.app_role)
             or public.has_role(_viewer_id, 'gerente'::public.app_role)
             or public.has_role(_viewer_id, 'direcao'::public.app_role))
    )
$function$;

-- 3
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
DECLARE
  v_hero_id text;
  v_pre public.pre_registrations%ROWTYPE;
  v_full_name text;
  v_role public.app_role;
BEGIN
  v_full_name := coalesce(NEW.raw_user_meta_data->>'full_name', '');
  v_hero_id := public.generate_hero_id();
  SELECT * INTO v_pre FROM public.pre_registrations WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF NOT FOUND AND v_full_name <> '' THEN
    SELECT * INTO v_pre FROM public.pre_registrations
    WHERE name_normalized = public.normalize_name(v_full_name) AND claimed_by IS NULL LIMIT 1;
  END IF;
  INSERT INTO public.profiles (id, full_name, attraction, role_title, email, hero_id, negocio, setor)
  VALUES (NEW.id, coalesce(NULLIF(v_full_name,''), v_pre.full_name, ''),
    coalesce(NEW.raw_user_meta_data->>'attraction', v_pre.negocio),
    coalesce(NEW.raw_user_meta_data->>'role_title', v_pre.cargo),
    NEW.email, v_hero_id, v_pre.negocio, v_pre.setor)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
    attraction = COALESCE(EXCLUDED.attraction, public.profiles.attraction),
    role_title = COALESCE(EXCLUDED.role_title, public.profiles.role_title),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    negocio = COALESCE(EXCLUDED.negocio, public.profiles.negocio),
    setor = COALESCE(EXCLUDED.setor, public.profiles.setor);
  v_role := public.map_perfil_to_role(v_pre.perfil);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;
  IF v_pre.id IS NOT NULL THEN
    UPDATE public.pre_registrations SET claimed_by = NEW.id, claimed_at = now() WHERE id = v_pre.id;
  END IF;
  RETURN NEW;
END $function$;

-- 4
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to anon;

-- 5
drop policy if exists "scoped read mood" on public.mood_checkins;
create policy "read mood" on public.mood_checkins for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'admin'));
drop policy if exists "scoped read absences" on public.journey_absences;
create policy "leaders and admins read absences" on public.journey_absences for select to authenticated
  using (public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'admin'));
drop policy if exists "scoped read point events" on public.point_events;
create policy "read own or leadership/admin point events" on public.point_events for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'lider')
         or public.has_role(auth.uid(), 'gerente') or public.has_role(auth.uid(), 'direcao'));
drop policy if exists "scoped read journey" on public.journey_progress;
create policy "read own journey" on public.journey_progress for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'admin'));
drop policy if exists "scoped read schedule" on public.weekly_schedules;
create policy "read schedule" on public.weekly_schedules for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'admin'));
drop policy if exists "scoped write schedule" on public.weekly_schedules;
create policy "leader write schedule" on public.weekly_schedules for all to authenticated
  using (public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'admin'));

-- 6
grant insert, update, delete on public.mood_checkins to anon, authenticated;
grant insert, update, delete on public.kudos to anon, authenticated;
create policy "insert own mood" on public.mood_checkins for insert to authenticated with check (user_id = auth.uid());
create policy "insert own kudos" on public.kudos for insert to authenticated with check (from_user = auth.uid());

-- 7
drop trigger if exists lock_own_completed_full on public.weekly_schedules;
drop function if exists public.trg_lock_own_completed_full();

-- 8
drop policy if exists "jobs_insert_leader_or_admin" on public.job_requests;
create policy "jobs_insert_leader_or_admin" on public.job_requests for insert to authenticated
  with check (created_by = auth.uid() and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'lider')));
drop trigger if exists job_requests_lock_decision on public.job_requests;
drop function if exists public.trg_job_requests_lock_decision();
drop policy if exists "docs_write_evaluators" on public.evaluation_documents;
create policy "docs_write_evaluators" on public.evaluation_documents for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_evaluator_of(evaluation_id, auth.uid()))
  with check (public.has_role(auth.uid(), 'admin') or public.is_evaluator_of(evaluation_id, auth.uid()));
drop trigger if exists evaluations_lock_identity on public.evaluations;
drop function if exists public.trg_evaluations_lock_identity();
drop policy if exists nps_resp_insert_own on public.nps_responses;
create policy nps_resp_insert_own on public.nps_responses for insert to authenticated with check (user_id = auth.uid());
drop policy if exists nps_resp_update_own on public.nps_responses;
create policy nps_resp_update_own on public.nps_responses for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 9
grant execute on function public.has_role(uuid, public.app_role) to public, anon;
grant execute on function public.is_leader_of(uuid, uuid) to public, anon;
grant execute on function public.is_manager_of(uuid, uuid) to public, anon;
grant execute on function public.is_evaluator_of(uuid, uuid) to public, anon;
grant execute on function public.can_access_evaluation(uuid, uuid) to public, anon;
grant execute on function public.can_view_user_data(uuid, uuid) to public, anon;
grant execute on function public.current_cycle_start() to public, anon;
grant execute on function public.my_email() to anon;
grant execute on function public.complete_journey_step(text) to anon;
grant execute on function public.generate_evaluations_for_cycle(uuid) to anon;
grant execute on function public.lookup_pre_registration(text, text) to anon, authenticated;
grant execute on function public.search_pre_registrations(text, integer) to anon, authenticated;

-- 10
update storage.buckets set file_size_limit = 10000000, allowed_mime_types = null
where id in ('journey-absences', 'evaluation-documents', 'iluminari');
drop policy if exists "absences scoped read" on storage.objects;
create policy "absences leaders read" on storage.objects for select to authenticated
  using (bucket_id = 'journey-absences' and (public.has_role(auth.uid(), 'leader') or public.has_role(auth.uid(), 'admin')));
