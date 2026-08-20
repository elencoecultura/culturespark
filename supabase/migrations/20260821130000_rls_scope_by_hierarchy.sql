-- As policies antigas davam acesso total (org inteira) a qualquer "lider"
-- ou "admin" em mood_checkins, journey_absences, point_events,
-- weekly_schedules e journey_progress — mesmo depois de escopar isso no
-- código do app (listTodayCheckins), o RLS ainda permitia qualquer líder
-- consultar a tabela direto (via supabase-js no navegador) e ver a
-- organização inteira. Essa migration escopa o RLS de verdade:
--   - admin, ou attraction/negocio = 'TODOS': vê tudo
--   - gerente/direção: vê quem está na mesma atração/negócio
--   - líder ("lider"): vê só quem tem manager_id apontando pra ele
--     (o próprio time direto — várias lideranças podem dividir a
--     mesma atração, então escopo de líder nunca é por atração)

create or replace function public.can_view_user_data(_target_user_id uuid, _viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
    )
$$;

revoke all on function public.can_view_user_data(uuid, uuid) from public;
grant execute on function public.can_view_user_data(uuid, uuid) to authenticated;

-- journey_absences
drop policy if exists "leaders and admins read absences" on public.journey_absences;
create policy "scoped read absences" on public.journey_absences
  for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

-- mood_checkins
drop policy if exists "read mood" on public.mood_checkins;
create policy "scoped read mood" on public.mood_checkins
  for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

-- point_events
drop policy if exists "read own or leader/admin point events" on public.point_events;
create policy "scoped read point events" on public.point_events
  for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

-- weekly_schedules (era FOR ALL — liberava leitura E escrita da org inteira)
drop policy if exists "leader write schedule" on public.weekly_schedules;
create policy "scoped write schedule" on public.weekly_schedules
  for all to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()))
  with check (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

drop policy if exists "read schedule" on public.weekly_schedules;
create policy "scoped read schedule" on public.weekly_schedules
  for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

-- journey_progress
drop policy if exists "read own journey" on public.journey_progress;
create policy "scoped read journey" on public.journey_progress
  for select to authenticated
  using (user_id = auth.uid() or public.can_view_user_data(user_id, auth.uid()));

-- cpf nunca foi liberado pra UI nenhuma, mas a policy "read all profiles"
-- (USING true) deixava qualquer pessoa logada ler o CPF de todo mundo
-- direto do banco. Fecha essa coluna como já foi feito com email/wifi_bypass.
revoke select (cpf) on public.profiles from authenticated;
revoke select (cpf) on public.profiles from anon;
