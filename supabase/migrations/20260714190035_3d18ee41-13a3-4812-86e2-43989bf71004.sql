
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ BEGIN CREATE TYPE public.evaluation_cycle_status AS ENUM ('rascunho','aberto','em_andamento','encerrado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.evaluation_status AS ENUM ('nao_iniciada','em_andamento','pendente_lancamento','pendente_documento','concluida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.pdi_status AS ENUM ('aberto','em_andamento','concluido','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.spirit_level AS ENUM ('abaixo','no_esperado','acima'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.evaluation_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL, name text NOT NULL, description text,
  sort_order int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evaluation_pillars TO authenticated;
GRANT ALL ON public.evaluation_pillars TO service_role;
ALTER TABLE public.evaluation_pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pillars_read_all_auth" ON public.evaluation_pillars FOR SELECT TO authenticated USING (true);
CREATE POLICY "pillars_admin_write" ON public.evaluation_pillars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.evaluation_pillars (slug,name,description,sort_order) VALUES
  ('amar','Amar','Ame profundamente as pessoas com quem trabalha e a quem serve.',1),
  ('honrar','Honrar','Honre compromissos, palavras e a confiança recebida.',2),
  ('verdadeiro','Ser Verdadeiro','Seja verdadeiro em intenções, palavras e atos.',3),
  ('justo','Ser Justo','Seja justo em decisões, feedbacks e reconhecimentos.',4),
  ('servir','Servir','Sirva com excelência, criando magia para o hóspede e para o time.',5)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.evaluation_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id uuid NOT NULL REFERENCES public.evaluation_pillars(id) ON DELETE RESTRICT,
  code text UNIQUE NOT NULL, name text NOT NULL, description text,
  expected_score numeric(3,1) NOT NULL DEFAULT 4.0 CHECK (expected_score BETWEEN 1 AND 5),
  sort_order int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evaluation_competencies TO authenticated;
GRANT ALL ON public.evaluation_competencies TO service_role;
ALTER TABLE public.evaluation_competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_read_all_auth" ON public.evaluation_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "comp_admin_write" ON public.evaluation_competencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

WITH p AS (SELECT id, slug FROM public.evaluation_pillars)
INSERT INTO public.evaluation_competencies (pillar_id, code, name, description, expected_score, sort_order)
SELECT (SELECT id FROM p WHERE slug = v.slug), v.code, v.name, v.description, 4.0, v.sort_order
FROM (VALUES
  ('amar','AMAR_01','Empatia','Coloca-se no lugar do outro em cada interação.',1),
  ('amar','AMAR_02','Cuidado com o Elenco','Zela pelo bem-estar do time no dia a dia.',2),
  ('amar','AMAR_03','Encantamento do Hóspede','Cria momentos memoráveis para quem visita.',3),
  ('amar','AMAR_04','Trabalho em Equipe','Colabora ativamente para o resultado coletivo.',4),
  ('honrar','HONRAR_01','Comprometimento','Cumpre o que combina, no prazo e com qualidade.',1),
  ('honrar','HONRAR_02','Pontualidade e Presença','Está no lugar certo, na hora certa, pronto para atuar.',2),
  ('honrar','HONRAR_03','Cuidado com o Cenário','Zela por uniforme, materiais e ambientação.',3),
  ('honrar','HONRAR_04','Postura Profissional','Representa Hector Studios com orgulho dentro e fora do palco.',4),
  ('verdadeiro','VERD_01','Comunicação Clara','Fala e escreve com clareza, sem ruídos.',1),
  ('verdadeiro','VERD_02','Feedback Aberto','Dá e recebe feedback com verdade e respeito.',2),
  ('verdadeiro','VERD_03','Coerência','Age de acordo com o que fala e defende.',3),
  ('verdadeiro','VERD_04','Transparência','Compartilha informações relevantes com o time.',4),
  ('justo','JUSTO_01','Imparcialidade','Trata todos com equidade, sem favoritismos.',1),
  ('justo','JUSTO_02','Reconhecimento','Reconhece publicamente boas atitudes do elenco.',2),
  ('justo','JUSTO_03','Tomada de Decisão','Decide com base em critérios claros e justos.',3),
  ('justo','JUSTO_04','Escuta Ativa','Ouve antes de responder, considera diferentes vozes.',4),
  ('servir','SERVIR_01','Excelência Operacional','Entrega com qualidade acima do esperado.',1),
  ('servir','SERVIR_02','Proatividade','Antecipa necessidades do hóspede e do time.',2),
  ('servir','SERVIR_03','Resolução de Problemas','Resolve com criatividade e agilidade.',3),
  ('servir','SERVIR_04','Espírito de Servir','Serve com alegria, sem esperar retorno.',4)
) AS v(slug,code,name,description,sort_order)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.evaluation_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, quarter text,
  starts_on date NOT NULL, ends_on date NOT NULL,
  status public.evaluation_cycle_status NOT NULL DEFAULT 'rascunho',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
GRANT SELECT ON public.evaluation_cycles TO authenticated;
GRANT ALL ON public.evaluation_cycles TO service_role;
ALTER TABLE public.evaluation_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cycles_read_auth" ON public.evaluation_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycles_admin_write" ON public.evaluation_cycles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_evaluation_cycles_updated BEFORE UPDATE ON public.evaluation_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.evaluation_cycles(id) ON DELETE CASCADE,
  evaluatee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.evaluation_status NOT NULL DEFAULT 'nao_iniciada',
  overall_score numeric(3,2),
  spirit_amar public.spirit_level, spirit_honrar public.spirit_level,
  spirit_verdadeiro public.spirit_level, spirit_justo public.spirit_level,
  spirit_servir public.spirit_level,
  notes text, meeting_at timestamptz, submitted_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, evaluatee_id)
);
CREATE INDEX IF NOT EXISTS evaluations_evaluatee_idx ON public.evaluations (evaluatee_id);
CREATE INDEX IF NOT EXISTS evaluations_cycle_idx ON public.evaluations (cycle_id);
GRANT SELECT, INSERT, UPDATE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_evaluations_updated BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.evaluation_evaluators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'lider' CHECK (role IN ('lider','co_lider','gerente','convidado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, evaluator_id)
);
CREATE INDEX IF NOT EXISTS eval_evaluators_evaluator_idx ON public.evaluation_evaluators (evaluator_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_evaluators TO authenticated;
GRANT ALL ON public.evaluation_evaluators TO service_role;
ALTER TABLE public.evaluation_evaluators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_evaluator_of(_evaluation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.evaluation_evaluators
    WHERE evaluation_id = _evaluation_id AND evaluator_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_evaluation(_evaluation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin')
    OR EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = _evaluation_id AND (
        e.evaluatee_id = _user_id
        OR public.is_evaluator_of(e.id, _user_id)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = e.evaluatee_id
          AND (p.manager_id = _user_id OR p.co_leader_id = _user_id))
      )
    );
$$;

CREATE POLICY "evaluations_select_scoped" ON public.evaluations FOR SELECT TO authenticated
  USING (public.can_access_evaluation(id, auth.uid()));
CREATE POLICY "evaluations_update_evaluators_admin" ON public.evaluations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(id, auth.uid()));
CREATE POLICY "evaluations_insert_admin" ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "eval_evaluators_select" ON public.evaluation_evaluators FOR SELECT TO authenticated
  USING (public.can_access_evaluation(evaluation_id, auth.uid()));
CREATE POLICY "eval_evaluators_admin_write" ON public.evaluation_evaluators FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.evaluation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES public.evaluation_competencies(id) ON DELETE RESTRICT,
  score numeric(3,1) NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text, scored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, competency_id)
);
CREATE INDEX IF NOT EXISTS eval_scores_eval_idx ON public.evaluation_scores (evaluation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_scores TO authenticated;
GRANT ALL ON public.evaluation_scores TO service_role;
ALTER TABLE public.evaluation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_select_scoped" ON public.evaluation_scores FOR SELECT TO authenticated
  USING (public.can_access_evaluation(evaluation_id, auth.uid()));
CREATE POLICY "scores_write_evaluators" ON public.evaluation_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(evaluation_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(evaluation_id, auth.uid()));
CREATE TRIGGER trg_eval_scores_updated BEFORE UPDATE ON public.evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.evaluation_pdis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES public.evaluation_competencies(id) ON DELETE SET NULL,
  objective text NOT NULL, actions text, due_on date,
  status public.pdi_status NOT NULL DEFAULT 'aberto',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS pdis_eval_idx ON public.evaluation_pdis (evaluation_id);
CREATE INDEX IF NOT EXISTS pdis_status_due_idx ON public.evaluation_pdis (status, due_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_pdis TO authenticated;
GRANT ALL ON public.evaluation_pdis TO service_role;
ALTER TABLE public.evaluation_pdis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdis_select_scoped" ON public.evaluation_pdis FOR SELECT TO authenticated
  USING (public.can_access_evaluation(evaluation_id, auth.uid()));
CREATE POLICY "pdis_write_evaluators" ON public.evaluation_pdis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(evaluation_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(evaluation_id, auth.uid()));
CREATE TRIGGER trg_pdis_updated BEFORE UPDATE ON public.evaluation_pdis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.evaluation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gerado','assinado')),
  storage_path text NOT NULL, mime_type text NOT NULL DEFAULT 'application/pdf',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eval_docs_eval_idx ON public.evaluation_documents (evaluation_id);
GRANT SELECT, INSERT, DELETE ON public.evaluation_documents TO authenticated;
GRANT ALL ON public.evaluation_documents TO service_role;
ALTER TABLE public.evaluation_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select_scoped" ON public.evaluation_documents FOR SELECT TO authenticated
  USING (public.can_access_evaluation(evaluation_id, auth.uid()));
CREATE POLICY "docs_write_evaluators" ON public.evaluation_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(evaluation_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_evaluator_of(evaluation_id, auth.uid()));

CREATE POLICY "eval_docs_bucket_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'evaluation-documents' AND (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.evaluation_documents d
    WHERE d.storage_path = storage.objects.name
      AND public.can_access_evaluation(d.evaluation_id, auth.uid()))
));
CREATE POLICY "eval_docs_bucket_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evaluation-documents' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "eval_docs_bucket_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'evaluation-documents' AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.generate_evaluations_for_cycle(_cycle_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; r record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode gerar avaliações do ciclo';
  END IF;
  FOR r IN SELECT p.id AS evaluatee_id, p.manager_id, p.co_leader_id
    FROM public.profiles p WHERE p.active IS TRUE AND p.manager_id IS NOT NULL
  LOOP
    INSERT INTO public.evaluations (cycle_id, evaluatee_id) VALUES (_cycle_id, r.evaluatee_id)
      ON CONFLICT (cycle_id, evaluatee_id) DO NOTHING;
    INSERT INTO public.evaluation_evaluators (evaluation_id, evaluator_id, role)
      SELECT e.id, r.manager_id, 'lider' FROM public.evaluations e
      WHERE e.cycle_id = _cycle_id AND e.evaluatee_id = r.evaluatee_id
      ON CONFLICT DO NOTHING;
    IF r.co_leader_id IS NOT NULL THEN
      INSERT INTO public.evaluation_evaluators (evaluation_id, evaluator_id, role)
        SELECT e.id, r.co_leader_id, 'co_lider' FROM public.evaluations e
        WHERE e.cycle_id = _cycle_id AND e.evaluatee_id = r.evaluatee_id
        ON CONFLICT DO NOTHING;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.generate_evaluations_for_cycle(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.generate_evaluations_for_cycle(uuid) TO authenticated;
