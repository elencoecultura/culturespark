-- Desfaz 20261006120000_iluminari_somente_admin: a leitura dos momentos
-- Iluminari volta a ser de qualquer pessoa logada (como era antes), até a
-- data em que o relato passar a ser reservado de novo.

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'iluminari_moments' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.iluminari_moments', p.policyname);
  end loop;

  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
      and coalesce(qual, '') ilike '%iluminari%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "read iluminari" on public.iluminari_moments
  for select to authenticated using (true);

create policy "read iluminari files" on storage.objects
  for select to authenticated
  using (bucket_id = 'iluminari');

select tablename, policyname, cmd, qual
from pg_policies
where (schemaname = 'public' and tablename = 'iluminari_moments')
   or (schemaname = 'storage' and tablename = 'objects' and coalesce(qual, '') ilike '%iluminari%')
order by tablename, cmd, policyname;
