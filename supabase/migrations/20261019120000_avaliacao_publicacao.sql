-- Publicação da avaliação para o colaborador.
-- Até aqui o avaliado enxergava notas e PDIs assim que o avaliador começava a
-- preencher (rascunho vazava) e, ao mesmo tempo, não havia como "entregar" a
-- avaliação: o elenco nem tinha atalho para vê-la. Agora o avaliador publica
-- quando terminar, e só depois o avaliado enxerga (notas, espírito, PDIs, docs).
-- Avaliador, líder/gerente do time e admin continuam vendo tudo, como antes.

alter table public.evaluations
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

-- O que já está concluído já foi entregue: mantém visível.
update public.evaluations
   set published_at = coalesce(completed_at, now())
 where status = 'concluida' and published_at is null;

create or replace function public.can_access_evaluation(_evaluation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'admin')
    or exists (
      select 1 from public.evaluations e
      where e.id = _evaluation_id and (
        (e.evaluatee_id = _user_id and e.published_at is not null)
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
