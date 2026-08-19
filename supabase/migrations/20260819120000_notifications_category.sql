-- Categoria opcional pra permitir dedupe de notificações automáticas
-- (ex.: "disc_unlocked"), sem afetar notificações existentes (ficam NULL).
alter table public.notifications
  add column if not exists category text;

create index if not exists notifications_category_user_idx
  on public.notifications (category, user_id);
