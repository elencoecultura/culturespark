-- Quem foi excluído do pré-cadastro (ex.: saiu da empresa) não volta quando a
-- planilha mestre for importada de novo. Cadastrar a pessoa manualmente tira
-- ela daqui (recontratação). Só o servidor lê/escreve (service role).

create table if not exists public.pre_registration_exclusions (
  name_normalized text primary key,
  full_name text not null,
  email text,
  excluded_by uuid,
  excluded_at timestamptz not null default now()
);
create index if not exists pre_registration_exclusions_email_idx
  on public.pre_registration_exclusions (lower(email));

alter table public.pre_registration_exclusions enable row level security;
revoke all on public.pre_registration_exclusions from anon, authenticated;
grant all on public.pre_registration_exclusions to service_role;
