create unique index if not exists pre_registrations_email_unique
  on public.pre_registrations (lower(email))
  where email is not null;

create unique index if not exists pre_registrations_name_unclaimed_unique
  on public.pre_registrations (name_normalized)
  where claimed_by is null;