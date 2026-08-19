-- Moderação leve do Elogio Rápido: sinaliza mensagens com termos sensíveis
-- pra revisão da gestão/RH. Não bloqueia o envio — só marca pra revisão.
ALTER TABLE public.kudos
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text;

CREATE INDEX IF NOT EXISTS kudos_flagged_idx ON public.kudos (flagged) WHERE flagged = true;

COMMENT ON COLUMN public.kudos.flagged IS 'true = contém termo sensível, aguardando revisão de RH/gestão';
COMMENT ON COLUMN public.kudos.flag_reason IS 'termo(s) que disparou(aram) a sinalização, pra contexto da revisão';
