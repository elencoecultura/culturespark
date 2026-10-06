-- Momento Iluminari passa a ser reservado: só admin lê os relatos.
-- Antes, qualquer pessoa logada lia todos os momentos (policy SELECT USING true)
-- e todos os arquivos do bucket 'iluminari'. Agora:
--   * tabela iluminari_moments: leitura só admin (elenco continua podendo
--     INSERIR o próprio relato);
--   * arquivos (fotos/áudio): admin lê tudo; cada pessoa só enxerga a própria
--     pasta (<auth.uid()>/...). A leitura da própria pasta é mantida porque o
--     envio do arquivo pode precisar de SELECT no retorno do INSERT; não expõe
--     nada de ninguém.

do $$
declare p record;
begin
  -- derruba qualquer policy de leitura antiga, seja qual for o nome
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

create policy "iluminari leitura so admin" on public.iluminari_moments
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "iluminari arquivos leitura admin ou dono" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'iluminari'
    and (
      public.has_role(auth.uid(), 'admin')
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Conferência (aparece como resultado no SQL Editor): deve listar só
-- policies de leitura restritas.
select tablename, policyname, cmd, qual
from pg_policies
where (schemaname = 'public' and tablename = 'iluminari_moments')
   or (schemaname = 'storage' and tablename = 'objects' and coalesce(qual, '') ilike '%iluminari%')
order by tablename, cmd, policyname;
