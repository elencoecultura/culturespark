-- Acesso por localização: além do IP do Wi-Fi (que o provedor troca sem
-- avisar), login e check-in passam a aceitar a pessoa estar dentro do raio de
-- uma unidade. Leitura/escrita só pelo servidor (service role), depois da
-- checagem de admin nas server functions.

create table if not exists public.allowed_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m integer not null default 200 check (radius_m between 50 and 3000),
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Uma linha por decisão de login/check-in de quem passa pela trava. NÃO guarda
-- coordenadas (LGPD) — só a unidade mais próxima e a distância até ela.
create table if not exists public.access_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  context text not null check (context in ('login', 'checkin')),
  method text not null,
  allowed boolean not null,
  reason text not null,
  ip text,
  nearest_location text,
  distance_m integer,
  accuracy_m integer,
  created_at timestamptz not null default now()
);
create index if not exists access_attempts_created_idx on public.access_attempts (created_at desc);
create index if not exists access_attempts_user_idx on public.access_attempts (user_id, created_at desc);

alter table public.allowed_locations enable row level security;
alter table public.access_attempts enable row level security;
revoke all on public.allowed_locations from anon, authenticated;
revoke all on public.access_attempts from anon, authenticated;
grant all on public.allowed_locations to service_role;
grant all on public.access_attempts to service_role;
