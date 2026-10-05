-- Tipo da pesquisa: 'nps' (pergunta de recomendação 0-10, entra no NPS e na
-- evolução mensal) ou 'quiz' (questionário: só notas de 0 a 10 por pergunta,
-- sem NPS). Pesquisas existentes continuam 'nps'.

alter table public.nps_surveys
  add column if not exists kind text not null default 'nps';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nps_surveys_kind_check'
  ) then
    alter table public.nps_surveys
      add constraint nps_surveys_kind_check check (kind in ('nps', 'quiz'));
  end if;
end $$;
