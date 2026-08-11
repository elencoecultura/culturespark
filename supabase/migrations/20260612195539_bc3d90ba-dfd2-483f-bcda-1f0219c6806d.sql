create extension if not exists pg_trgm with schema public;

create index if not exists pre_registrations_name_norm_trgm
  on public.pre_registrations using gin (name_normalized public.gin_trgm_ops);

create or replace function public.search_pre_registrations(_q text, _limit int default 5)
returns table (
  id uuid,
  full_name text,
  cargo text,
  setor text,
  perfil text,
  negocio text,
  already_claimed boolean,
  similarity real
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select public.normalize_name(coalesce(_q,'')) as qn
  )
  select
    p.id,
    p.full_name,
    p.cargo,
    p.setor,
    p.perfil,
    p.negocio,
    (p.claimed_by is not null) as already_claimed,
    similarity(p.name_normalized, (select qn from q)) as similarity
  from public.pre_registrations p, q
  where length(q.qn) >= 2
    and (
      p.name_normalized % q.qn
      or p.name_normalized ilike '%' || q.qn || '%'
    )
  order by similarity desc, p.full_name asc
  limit greatest(1, least(_limit, 20));
$$;

grant execute on function public.search_pre_registrations(text, int) to anon, authenticated;