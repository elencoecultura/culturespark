-- Registra quando um alerta de energia baixa (3 check-ins consecutivos)
-- já foi disparado pra liderança, evitando notificar de novo a cada check-in
-- enquanto a mesma sequência continuar.
create table if not exists public.low_energy_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  streak_len int not null
);

create index if not exists low_energy_alerts_user_idx
  on public.low_energy_alerts (user_id, triggered_at desc);

alter table public.low_energy_alerts enable row level security;

create policy "admin can read low energy alerts"
  on public.low_energy_alerts for select
  using (has_role(auth.uid(), 'admin'));
