-- Auditoria de segurança (23/10/2026). Tudo idempotente; rodar inteiro no
-- SQL Editor DEPOIS do deploy do código do mesmo commit (o código novo grava
-- check-in e elogio pelo servidor, que é o que passa a ser o único caminho).
-- Reversão: supabase/rollback/20261023120000_auditoria_seguranca_rollback.sql
--
-- O que muda (estado conferido no banco de produção, não só nas migrações —
-- a 20260821130000 nunca foi aplicada lá):
--  1. profiles: ninguém além do admin altera o próprio perfil (antes dava pra
--     gravar attraction='TODOS' e ganhar visão de toda a empresa).
--  2. can_view_user_data: 'TODOS' só vale com papel de gestão; líder também
--     enxerga o time em que é co-líder (alinha com o código).
--  3. handle_new_user: não confia mais em nome/atração/cargo mandados pelo
--     cliente no signup; pré-cadastro só pelo id que o servidor passa ou por
--     e-mail já confirmado.
--  4. profiles: e-mail, CPF, wifi_bypass e first_login_at deixam de ser
--     legíveis pelo browser (o REVOKE por coluna antigo não tinha efeito
--     porque o GRANT era da tabela inteira).
--  5. Escopo por hierarquia em humor, faltas, pontos, jornada e escalas (hoje
--     qualquer líder lê e escreve de todas as casas).
--  6. Check-in e elogio só pelo servidor (o INSERT direto aceitava created_at
--     retroativo e pulava limite diário, cooldown e filtro de termos).
--  7. Semana cumprida (+20 pts) não pode ser marcada na própria escala.
--  8. job_requests, evaluation_documents, evaluations, NPS: campos de decisão,
--     caminho de arquivo, avaliado/ciclo e janela da pesquisa travados.
--  9. Funções SECURITY DEFINER fora do alcance de anon; RPCs de pré-cadastro
--     só pelo servidor.
-- 10. Storage: tipos de arquivo permitidos e leitura de atestado escopada.

-- 1 -------------------------------------------------------------------------
drop policy if exists "update own profile" on public.profiles;

create or replace function public.protect_profile_sensitive_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  -- Defesa extra caso alguma policy de UPDATE volte a existir para não-admin.
  new.wifi_bypass    := old.wifi_bypass;
  new.first_login_at := old.first_login_at;
  new.hero_id        := old.hero_id;
  new.negocio        := old.negocio;
  new.setor          := old.setor;
  new.active         := old.active;
  new.email          := old.email;
  new.cpf            := old.cpf;
  new.manager_id     := old.manager_id;
  new.co_leader_id   := old.co_leader_id;
  new.area           := old.area;
  new.department     := old.department;
  new.attraction     := old.attraction;
  new.role_title     := old.role_title;
  new.weekly_hours   := old.weekly_hours;
  new.days_off       := old.days_off;
  return new;
end $$;

-- 2 -------------------------------------------------------------------------
create or replace function public.can_view_user_data(_target_user_id uuid, _viewer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_viewer_id, 'admin'::public.app_role)
    or exists (
      select 1 from public.profiles v
      where v.id = _viewer_id and (v.attraction = 'TODOS' or v.negocio = 'TODOS')
        and (public.has_role(_viewer_id, 'gerente'::public.app_role)
             or public.has_role(_viewer_id, 'direcao'::public.app_role))
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
      where t.id = _target_user_id
        and (t.manager_id = _viewer_id or t.co_leader_id = _viewer_id)
        and (public.has_role(_viewer_id, 'lider'::public.app_role)
             or public.has_role(_viewer_id, 'gerente'::public.app_role)
             or public.has_role(_viewer_id, 'direcao'::public.app_role))
    )
$$;

-- 3 -------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hero_id text;
  v_pre public.pre_registrations%rowtype;
  v_full_name text;
  v_pre_id uuid;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_hero_id := public.generate_hero_id();

  -- raw_app_meta_data só é gravável pelo service role (o servidor do app);
  -- raw_user_meta_data vem do cliente e não decide papel nem casa.
  begin
    v_pre_id := nullif(new.raw_app_meta_data->>'pre_registration_id', '')::uuid;
  exception when others then
    v_pre_id := null;
  end;

  if v_pre_id is not null then
    select * into v_pre from public.pre_registrations
     where id = v_pre_id and claimed_by is null;
  elsif new.email_confirmed_at is not null then
    select * into v_pre from public.pre_registrations
     where coalesce(email, '') <> '' and lower(email) = lower(new.email) and claimed_by is null
     limit 1;
  end if;

  insert into public.profiles (id, full_name, attraction, role_title, email, hero_id, negocio, setor)
  values (
    new.id,
    coalesce(nullif(v_full_name, ''), v_pre.full_name, ''),
    v_pre.negocio,
    v_pre.cargo,
    new.email,
    v_hero_id,
    v_pre.negocio,
    v_pre.setor
  )
  on conflict (id) do update set
    full_name  = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    attraction = coalesce(excluded.attraction, public.profiles.attraction),
    role_title = coalesce(excluded.role_title, public.profiles.role_title),
    email      = coalesce(excluded.email, public.profiles.email),
    negocio    = coalesce(excluded.negocio, public.profiles.negocio),
    setor      = coalesce(excluded.setor, public.profiles.setor);

  insert into public.user_roles (user_id, role)
  values (new.id, case when v_pre.id is null then 'elenco'::public.app_role
                       else public.map_perfil_to_role(v_pre.perfil) end)
  on conflict do nothing;

  if v_pre.id is not null then
    update public.pre_registrations set claimed_by = new.id, claimed_at = now() where id = v_pre.id;
  end if;

  return new;
end $$;

-- 4 -------------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke select on public.profiles from authenticated;
grant select (id, full_name, attraction, weekly_hours, days_off, active, created_at, updated_at,
              hero_id, role_title, negocio, setor, manager_id, co_leader_id, area, department, birth_date)
  on public.profiles to authenticated;

-- 5 -------------------------------------------------------------------------
drop policy if exists "read mood" on public.mood_checkins;
drop policy if exists "scoped read mood" on public.mood_checkins;
create policy "scoped read mood" on public.mood_checkins for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

drop policy if exists "leaders and admins read absences" on public.journey_absences;
drop policy if exists "scoped read absences" on public.journey_absences;
create policy "scoped read absences" on public.journey_absences for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

drop policy if exists "read own or leadership/admin point events" on public.point_events;
drop policy if exists "read own or leader/admin point events" on public.point_events;
drop policy if exists "scoped read point events" on public.point_events;
create policy "scoped read point events" on public.point_events for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

drop policy if exists "read own journey" on public.journey_progress;
drop policy if exists "scoped read journey" on public.journey_progress;
create policy "scoped read journey" on public.journey_progress for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

drop policy if exists "read schedule" on public.weekly_schedules;
drop policy if exists "scoped read schedule" on public.weekly_schedules;
create policy "scoped read schedule" on public.weekly_schedules for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

drop policy if exists "leader write schedule" on public.weekly_schedules;
drop policy if exists "scoped write schedule" on public.weekly_schedules;
create policy "scoped write schedule" on public.weekly_schedules for all to authenticated
  using (
    public.can_view_user_data(user_id, auth.uid())
    or (user_id = auth.uid() and (public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'gerente')
                                  or public.has_role(auth.uid(), 'direcao')))
  )
  with check (
    public.can_view_user_data(user_id, auth.uid())
    or (user_id = auth.uid() and (public.has_role(auth.uid(), 'lider') or public.has_role(auth.uid(), 'gerente')
                                  or public.has_role(auth.uid(), 'direcao')))
  );

-- 6 -------------------------------------------------------------------------
revoke insert, update, delete on public.mood_checkins from anon, authenticated;
revoke insert, update, delete on public.kudos from anon, authenticated;
drop policy if exists "insert own mood" on public.mood_checkins;
drop policy if exists "insert own kudos" on public.kudos;

-- 7 -------------------------------------------------------------------------
create or replace function public.trg_lock_own_completed_full()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- service role (servidor e o trigger de semana completa) e admin passam
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  if new.user_id = auth.uid() then
    if tg_op = 'INSERT' then
      new.completed_full := false;
    else
      new.completed_full := old.completed_full;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.trg_lock_own_completed_full() from public, anon, authenticated;
drop trigger if exists lock_own_completed_full on public.weekly_schedules;
create trigger lock_own_completed_full before insert or update on public.weekly_schedules
  for each row execute function public.trg_lock_own_completed_full();

-- 8 -------------------------------------------------------------------------
drop policy if exists "jobs_insert_leader_or_admin" on public.job_requests;
create policy "jobs_insert_leader_or_admin" on public.job_requests for insert to authenticated
  with check (
    created_by = auth.uid() and (
      public.has_role(auth.uid(), 'admin')
      or (public.has_role(auth.uid(), 'lider') and status = 'pending'
          and decided_by is null and decided_at is null and decision_note is null)
    )
  );

create or replace function public.trg_job_requests_lock_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.decided_by    := old.decided_by;
    new.decided_at    := old.decided_at;
    new.decision_note := old.decision_note;
    new.created_by    := old.created_by;
  end if;
  return new;
end $$;
revoke execute on function public.trg_job_requests_lock_decision() from public, anon, authenticated;
drop trigger if exists job_requests_lock_decision on public.job_requests;
create trigger job_requests_lock_decision before update on public.job_requests
  for each row execute function public.trg_job_requests_lock_decision();

drop policy if exists "docs_write_evaluators" on public.evaluation_documents;
create policy "docs_write_evaluators" on public.evaluation_documents for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_evaluator_of(evaluation_id, auth.uid()))
  with check (
    (public.has_role(auth.uid(), 'admin') or public.is_evaluator_of(evaluation_id, auth.uid()))
    and storage_path like evaluation_id::text || '/%'
    and storage_path not like '%..%'
    and (uploaded_by is null or uploaded_by = auth.uid())
  );

create or replace function public.trg_evaluations_lock_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.evaluatee_id := old.evaluatee_id;
    new.cycle_id     := old.cycle_id;
  end if;
  return new;
end $$;
revoke execute on function public.trg_evaluations_lock_identity() from public, anon, authenticated;
drop trigger if exists evaluations_lock_identity on public.evaluations;
create trigger evaluations_lock_identity before update on public.evaluations
  for each row execute function public.trg_evaluations_lock_identity();

drop policy if exists nps_resp_insert_own on public.nps_responses;
create policy nps_resp_insert_own on public.nps_responses for insert to authenticated
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.nps_surveys s
      where s.id = survey_id and s.active
        and (s.opens_at is null or s.opens_at <= now())
        and (s.closes_at is null or s.closes_at >= now())
    )
  );
drop policy if exists nps_resp_update_own on public.nps_responses;
create policy nps_resp_update_own on public.nps_responses for update to authenticated
  using (
    user_id = auth.uid() and exists (
      select 1 from public.nps_surveys s
      where s.id = survey_id and s.active
        and (s.opens_at is null or s.opens_at <= now())
        and (s.closes_at is null or s.closes_at >= now())
    )
  )
  with check (user_id = auth.uid());

-- 9 -------------------------------------------------------------------------
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_leader_of(uuid, uuid) from public, anon;
revoke execute on function public.is_manager_of(uuid, uuid) from public, anon;
revoke execute on function public.is_evaluator_of(uuid, uuid) from public, anon;
revoke execute on function public.can_access_evaluation(uuid, uuid) from public, anon;
revoke execute on function public.can_view_user_data(uuid, uuid) from public, anon;
revoke execute on function public.current_cycle_start() from public, anon;
revoke execute on function public.my_email() from public, anon;
revoke execute on function public.complete_journey_step(text) from public, anon;
revoke execute on function public.generate_evaluations_for_cycle(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_leader_of(uuid, uuid) to authenticated;
grant execute on function public.is_manager_of(uuid, uuid) to authenticated;
grant execute on function public.is_evaluator_of(uuid, uuid) to authenticated;
grant execute on function public.can_access_evaluation(uuid, uuid) to authenticated;
grant execute on function public.can_view_user_data(uuid, uuid) to authenticated;
grant execute on function public.current_cycle_start() to authenticated;
grant execute on function public.my_email() to authenticated;
grant execute on function public.complete_journey_step(text) to authenticated;
grant execute on function public.generate_evaluations_for_cycle(uuid) to authenticated;
-- Cadastro público usa essas duas via server function com service role.
revoke execute on function public.lookup_pre_registration(text, text) from public, anon, authenticated;
revoke execute on function public.search_pre_registrations(text, integer) from public, anon, authenticated;
grant execute on function public.lookup_pre_registration(text, text) to service_role;
grant execute on function public.search_pre_registrations(text, integer) to service_role;
revoke execute on function public.protect_profile_sensitive_fields() from public, anon, authenticated;
revoke execute on function public.trg_profile_audit() from public, anon, authenticated;
revoke execute on function public.trg_auto_complete_week() from public, anon, authenticated;

-- 10 ------------------------------------------------------------------------
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/*']
where id in ('journey-absences', 'evaluation-documents');
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/*', 'audio/*']
where id = 'iluminari';

drop policy if exists "absences leaders read" on storage.objects;
drop policy if exists "absences scoped read" on storage.objects;
create policy "absences scoped read" on storage.objects for select to authenticated
  using (
    bucket_id = 'journey-absences'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.can_view_user_data(((storage.foldername(name))[1])::uuid, auth.uid())
  );
