-- Avaliações passam a seguir a mesma regra de escopo do resto do app
-- (can_view_user_data: lista "Pessoas específicas" em leader_access quando o
-- líder tem lista; senão hierarquia/casa). Antes olhavam só manager_id/
-- co_leader_id do perfil, e líder com time definido só na lista (ex.: Tais
-- Ansolin, 4 na lista e 0 no perfil) via Avaliações vazias.

create or replace function public.can_access_evaluation(_evaluation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin')
    or exists (
      select 1 from public.evaluations e
      where e.id = _evaluation_id and (
        e.evaluatee_id = _user_id
        or public.is_evaluator_of(e.id, _user_id)
        or public.can_view_user_data(e.evaluatee_id, _user_id)
      )
    );
$$;

revoke execute on function public.can_access_evaluation(uuid, uuid) from public, anon;
grant execute on function public.can_access_evaluation(uuid, uuid) to authenticated;
