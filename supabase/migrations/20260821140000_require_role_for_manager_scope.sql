-- Fecha uma brecha estrutural: can_view_user_data() e can_access_evaluation()
-- liberavam acesso de "líder" só por causa de manager_id/co_leader_id apontar
-- pro chamador, sem checar se o chamador de fato tem um papel de liderança
-- (user_roles). Hoje não há nenhum manager_id mal configurado apontando pra
-- uma conta elenco, mas a checagem de papel é a segunda camada que impede
-- isso de virar um vazamento se um manager_id for setado errado no futuro.

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
        and (public.has_role(_viewer_id, 'lider'::public.app_role)
             or public.has_role(_viewer_id, 'leader'::public.app_role)
             or public.has_role(_viewer_id, 'gerente'::public.app_role)
             or public.has_role(_viewer_id, 'direcao'::public.app_role))
    )
$$;

create or replace function public.can_access_evaluation(_evaluation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'admin')
    or exists (
      select 1 from public.evaluations e
      where e.id = _evaluation_id and (
        e.evaluatee_id = _user_id
        or public.is_evaluator_of(e.id, _user_id)
        or exists (
          select 1 from public.profiles p where p.id = e.evaluatee_id
            and (p.manager_id = _user_id or p.co_leader_id = _user_id)
            and (public.has_role(_user_id,'lider')
                 or public.has_role(_user_id,'leader')
                 or public.has_role(_user_id,'gerente')
                 or public.has_role(_user_id,'direcao'))
        )
      )
    );
$$;
