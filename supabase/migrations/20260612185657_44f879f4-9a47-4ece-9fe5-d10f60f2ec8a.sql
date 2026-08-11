
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'elenco';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'direcao';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS negocio text,
  ADD COLUMN IF NOT EXISTS setor text;
