-- Data de nascimento do elenco (para a aba de Aniversários da semana)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.profiles.birth_date IS 'Data de nascimento; usada na aba Aniversários (dia/mês). Ano pode ser aproximado quando desconhecido.';

-- A policy "read all profiles" já existente permite que todo o elenco veja os aniversários.
