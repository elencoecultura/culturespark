-- Bússola das Quatro Essências (mapeamento comportamental inspirado em DISC).
-- Instrumento interno de autopercepção — não é diagnóstico psicológico.

CREATE TABLE IF NOT EXISTS public.behavioral_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  score_d int NOT NULL,
  score_i int NOT NULL,
  score_s int NOT NULL,
  score_c int NOT NULL,
  primary_essence text NOT NULL,          -- D | I | S | C
  secondary_essence text,                 -- D | I | S | C
  combination text,                       -- ex.: "Líder Catalisador"
  profile_type text NOT NULL DEFAULT 'single', -- single | dupla | versatil
  answers jsonb,                          -- respostas cruas [{n, label}]
  share_with_leadership boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS behavioral_tests_user_idx ON public.behavioral_tests (user_id, taken_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.behavioral_tests TO authenticated;
GRANT ALL ON public.behavioral_tests TO service_role;

ALTER TABLE public.behavioral_tests ENABLE ROW LEVEL SECURITY;

-- Cada pessoa lê/gerencia apenas os próprios resultados.
CREATE POLICY "read own behavioral test" ON public.behavioral_tests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own behavioral test" ON public.behavioral_tests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own behavioral test" ON public.behavioral_tests
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Liderança (admin) pode ver resultados de quem consentiu explicitamente.
CREATE POLICY "leadership reads shared behavioral tests" ON public.behavioral_tests
  FOR SELECT TO authenticated
  USING (share_with_leadership = true AND public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.behavioral_tests IS 'Bússola das Quatro Essências — autopercepção comportamental. Não usar isoladamente para decisões de RH.';
