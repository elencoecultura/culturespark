-- Relatórios: auditoria de quem gerou/exportou o quê, quando e com quais
-- filtros. Gravação só pelo servidor; leitura só de admin. Idempotente.
create table if not exists public.report_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  report text not null,
  action text not null check (action in ('gerar', 'pdf', 'excel')),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists report_audit_created_idx on public.report_audit (created_at desc);
alter table public.report_audit enable row level security;
revoke all on public.report_audit from anon, authenticated;
grant select on public.report_audit to authenticated;
grant all on public.report_audit to service_role;
drop policy if exists "report_audit_admin_read" on public.report_audit;
create policy "report_audit_admin_read" on public.report_audit for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
-- Reversão: drop table if exists public.report_audit;
