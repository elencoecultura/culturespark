-- Pesquisa com várias perguntas (cada uma nota de 0 a 10), numa única pesquisa.
-- A pergunta principal continua em nps_surveys.question / nps_responses.score
-- (é a que alimenta o NPS e o histórico). As perguntas extras vão em jsonb:
--   nps_surveys.extra_questions = [{"id":"q2","text":"..."}, ...]
--   nps_responses.extra_scores  = {"q2": 8, "q3": 10}
-- Colunas novas com default, então pesquisas e respostas antigas seguem
-- valendo sem nenhum ajuste. RLS e grants existentes cobrem as colunas.

alter table public.nps_surveys
  add column if not exists extra_questions jsonb not null default '[]'::jsonb;

alter table public.nps_responses
  add column if not exists extra_scores jsonb not null default '{}'::jsonb;
