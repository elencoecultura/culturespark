-- Curtida (coração) num elogio — só reagir, sem comentário. Mesma
-- visibilidade do elogio em si: só quem mandou ou recebeu aquele elogio
-- pode ver/curtir (nunca um feed público).

create table if not exists public.kudos_likes (
  id uuid primary key default gen_random_uuid(),
  kudos_id uuid not null references public.kudos(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (kudos_id, user_id)
);

grant select, insert, delete on public.kudos_likes to authenticated;
grant all on public.kudos_likes to service_role;
alter table public.kudos_likes enable row level security;

create policy "read likes of kudos you can see" on public.kudos_likes
  for select to authenticated
  using (
    exists (
      select 1 from public.kudos k
      where k.id = kudos_likes.kudos_id
        and (k.from_user = auth.uid() or k.to_user = auth.uid())
    )
  );

create policy "like kudos you can see" on public.kudos_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.kudos k
      where k.id = kudos_likes.kudos_id
        and (k.from_user = auth.uid() or k.to_user = auth.uid())
    )
  );

create policy "unlike own like" on public.kudos_likes
  for delete to authenticated
  using (user_id = auth.uid());

create index if not exists kudos_likes_kudos_id_idx on public.kudos_likes(kudos_id);
