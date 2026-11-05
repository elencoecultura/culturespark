-- Permissões de Usuários (tela de admin) + registro de acessos ao app.
-- Idempotente. Tudo é gravado pelo servidor (service role); o navegador não
-- escreve em nenhuma destas tabelas. Reversão no fim (comentada).
--
-- access_scopes: empresas (e setores dentro delas) que um usuário enxerga
--   inteiras. empresa = valor de profiles.attraction ou 'TODAS'; setor nulo =
--   a empresa toda.
-- leader_access_default: cópia da planilha base, usada pelo "Restaurar padrão".
-- user_permission_overrides: liberação/bloqueio de módulo ou ação por pessoa
--   (chave 'module:<id>' ou 'action:<id>'); sem linha = padrão do perfil.
-- permission_audit: quem alterou o quê, quando, com antes e depois.
-- app_access_log: um registro por pessoa/dia/módulo (para o relatório de
--   engajamento); só conta a partir desta migração.

create table if not exists public.access_scopes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  empresa text not null,
  setor text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, empresa, setor)
);

create table if not exists public.leader_access_default (
  leader_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  motivo text,
  primary key (leader_id, member_id)
);
insert into public.leader_access_default (leader_id, member_id, motivo)
  select leader_id, member_id, motivo from public.leader_access where source = 'planilha'
  on conflict do nothing;

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null check (key ~ '^(module|action):[a-z0-9_-]+$'),
  allowed boolean not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.permission_audit (
  id uuid primary key default gen_random_uuid(),
  target_user uuid not null,
  changed_by uuid,
  field text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists permission_audit_target_idx on public.permission_audit (target_user, created_at desc);

create table if not exists public.app_access_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  module text not null,
  hits int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, day, module)
);
create index if not exists app_access_log_day_idx on public.app_access_log (day);

do $$
declare t text;
begin
  foreach t in array array['access_scopes','leader_access_default','user_permission_overrides','permission_audit','app_access_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Própria pessoa lê as próprias liberações (o menu usa isso); admin lê tudo.
grant select on public.user_permission_overrides to authenticated;
drop policy if exists "overrides_read" on public.user_permission_overrides;
create policy "overrides_read" on public.user_permission_overrides for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Conta um acesso (pessoa, dia em São Paulo, módulo). Só o servidor chama.
create or replace function public.track_access(_user_id uuid, _module text)
returns void language sql security definer set search_path = public as $$
  insert into public.app_access_log (user_id, day, module)
  values (_user_id, (now() at time zone 'America/Sao_Paulo')::date, left(coalesce(nullif(_module, ''), 'home'), 40))
  on conflict (user_id, day, module) do update
    set hits = public.app_access_log.hits + 1, last_at = now();
$$;
revoke execute on function public.track_access(uuid, text) from public, anon, authenticated;
grant execute on function public.track_access(uuid, text) to service_role;

-- Regra de visibilidade: "modo lista" agora também vale para quem tem
-- empresa/setor liberado. Quem não tem nada disso segue a regra antiga.
create or replace function public.can_view_user_data(_target_user_id uuid, _viewer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_viewer_id, 'admin'::public.app_role)
    or (
      (exists (select 1 from public.leader_access a where a.leader_id = _viewer_id)
       or exists (select 1 from public.access_scopes s where s.user_id = _viewer_id))
      and (
        exists (select 1 from public.leader_access a where a.leader_id = _viewer_id and a.member_id = _target_user_id)
        or exists (
          select 1 from public.access_scopes s
          join public.profiles t on t.id = _target_user_id
          where s.user_id = _viewer_id
            and (s.empresa = 'TODAS' or (t.attraction = s.empresa and (s.setor = '' or t.setor = s.setor)))
        )
      )
    )
    or (
      not exists (select 1 from public.leader_access a where a.leader_id = _viewer_id)
      and not exists (select 1 from public.access_scopes s where s.user_id = _viewer_id)
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

-- Reversão:
-- drop function if exists public.track_access(uuid, text);
-- (recriar can_view_user_data da 20261104120000_acessos_da_planilha.sql)
-- drop table if exists public.app_access_log, public.permission_audit, public.user_permission_overrides,
--   public.leader_access_default, public.access_scopes;
