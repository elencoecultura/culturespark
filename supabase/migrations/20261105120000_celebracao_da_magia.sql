-- Celebração da Magia: felicitações de aniversário de empresa (tempo de casa).
-- Idempotente. Regras:
--  - uma felicitação por remetente, para cada aniversariante, em cada
--    aniversário de empresa (anniversary_year); ninguém felicita a si mesmo
--  - gravação só pelo servidor (o navegador só lê o que enviou/recebeu)
--  - 3 pontos para quem envia, no histórico com o tipo "celebracao_magia"
-- Reversão no fim (comentada).

create table if not exists public.company_anniversary_wishes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  anniversary_year int not null,
  years int not null check (years >= 1),
  message text not null check (char_length(message) between 2 and 280),
  created_at timestamptz not null default now(),
  unique (from_user, to_user, anniversary_year),
  check (from_user <> to_user)
);
create index if not exists company_anniversary_wishes_to_idx on public.company_anniversary_wishes (to_user, anniversary_year);
alter table public.company_anniversary_wishes enable row level security;
revoke all on public.company_anniversary_wishes from anon, authenticated;
grant select on public.company_anniversary_wishes to authenticated;
grant all on public.company_anniversary_wishes to service_role;
drop policy if exists "anniversary_wishes_read" on public.company_anniversary_wishes;
create policy "anniversary_wishes_read" on public.company_anniversary_wishes for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- novo tipo de pontuação
alter table public.point_events drop constraint if exists point_events_kind_check;
alter table public.point_events add constraint point_events_kind_check
  check (kind = any (array['checkin','kudos_sent','kudos_received','schedule_completed','journey_step','celebracao_magia']));

-- Reversão:
-- delete from public.point_events where kind = 'celebracao_magia';
-- alter table public.point_events drop constraint if exists point_events_kind_check;
-- alter table public.point_events add constraint point_events_kind_check
--   check (kind = any (array['checkin','kudos_sent','kudos_received','schedule_completed','journey_step']));
-- drop table if exists public.company_anniversary_wishes;
