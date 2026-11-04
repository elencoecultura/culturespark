-- Acessos por líder vindos da planilha oficial (Colaboradores_Ativos_Grupo_Hector_App_Cultura.xlsx).
-- Idempotente. Reversão no fim do arquivo (comentada).
--
-- 1) leader_access: par líder -> colaborador, com o motivo da planilha. Quando
--    um líder tem QUALQUER linha aqui, ele vê exatamente essas pessoas (nem
--    mais nem menos). Líder sem linha (Trupe, Hector Studios) segue a regra
--    antiga. Admin vê tudo, como antes.
-- 2) leader_access_pending: acesso a quem ainda não tem conta (está só no
--    pré-cadastro); vira leader_access quando a conta é criada.
-- 3) Campos novos do perfil: WhatsApp, data de admissão, código e situação.
--    Situação e WhatsApp não são legíveis pelo navegador (só pelo servidor,
--    que mostra situação apenas a admin). Admissão é legível (Celebração da Magia).

alter table public.profiles
  add column if not exists whatsapp text,
  add column if not exists admission_date date,
  add column if not exists employee_code text,
  add column if not exists situacao text;
grant select (admission_date) on public.profiles to authenticated;

alter table public.pre_registrations
  add column if not exists whatsapp text,
  add column if not exists admission_date date,
  add column if not exists birth_date date,
  add column if not exists employee_code text,
  add column if not exists situacao text,
  add column if not exists lider_direto text;

create table if not exists public.leader_access (
  leader_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  motivo text,
  source text not null default 'planilha',
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (leader_id, member_id),
  check (leader_id <> member_id)
);
create index if not exists leader_access_member_idx on public.leader_access (member_id);
alter table public.leader_access enable row level security;
revoke all on public.leader_access from anon, authenticated;
grant select on public.leader_access to authenticated;
grant all on public.leader_access to service_role;
drop policy if exists "leader_access_read" on public.leader_access;
create policy "leader_access_read" on public.leader_access for select to authenticated
  using (leader_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table if not exists public.leader_access_pending (
  leader_id uuid not null references public.profiles(id) on delete cascade,
  pre_registration_id uuid not null references public.pre_registrations(id) on delete cascade,
  motivo text,
  created_at timestamptz not null default now(),
  primary key (leader_id, pre_registration_id)
);
alter table public.leader_access_pending enable row level security;
revoke all on public.leader_access_pending from anon, authenticated;
grant all on public.leader_access_pending to service_role;
drop policy if exists "leader_access_pending_admin" on public.leader_access_pending;
create policy "leader_access_pending_admin" on public.leader_access_pending for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Regra única de visibilidade (RLS e server functions usam a mesma).
create or replace function public.can_view_user_data(_target_user_id uuid, _viewer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_viewer_id, 'admin'::public.app_role)
    or (
      exists (select 1 from public.leader_access a where a.leader_id = _viewer_id)
      and exists (select 1 from public.leader_access a where a.leader_id = _viewer_id and a.member_id = _target_user_id)
    )
    or (
      not exists (select 1 from public.leader_access a where a.leader_id = _viewer_id)
      and (
        exists (
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
      )
    )
$$;

-- Lista de quem o usuário vê (para as telas de liderança). Só responde sobre
-- si mesmo (ou qualquer um, para admin e para o servidor).
create or replace function public.visible_user_ids(_viewer_id uuid)
returns setof uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and _viewer_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Forbidden';
  end if;
  return query
    select p.id from public.profiles p
    where p.id <> _viewer_id and public.can_view_user_data(p.id, _viewer_id);
end $$;
revoke execute on function public.visible_user_ids(uuid) from public, anon;
grant execute on function public.visible_user_ids(uuid) to authenticated, service_role;

-- Reversão:
-- drop function if exists public.visible_user_ids(uuid);
-- (recriar can_view_user_data da 20261023120000_auditoria_seguranca.sql)
-- drop table if exists public.leader_access_pending; drop table if exists public.leader_access;
-- alter table public.profiles drop column if exists whatsapp, drop column if exists admission_date,
--   drop column if exists employee_code, drop column if exists situacao;
