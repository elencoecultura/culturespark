
CREATE TABLE public.nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Como está sua experiência este mês?',
  question text NOT NULL DEFAULT 'Em uma escala de 0 a 10, o quanto você recomendaria trabalhar na Hector Studios para um amigo?',
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nps_surveys TO authenticated;
GRANT ALL ON public.nps_surveys TO service_role;
ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY nps_surveys_read ON public.nps_surveys FOR SELECT TO authenticated USING (true);
CREATE POLICY nps_surveys_admin_write ON public.nps_surveys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.nps_surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, user_id)
);

GRANT SELECT, INSERT ON public.nps_responses TO authenticated;
GRANT ALL ON public.nps_responses TO service_role;
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY nps_resp_read_own ON public.nps_responses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY nps_resp_insert_own ON public.nps_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_nps_surveys_window ON public.nps_surveys(active, opens_at, closes_at);
CREATE INDEX idx_nps_responses_survey ON public.nps_responses(survey_id);
