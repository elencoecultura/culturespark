-- Add tagline column if not present (soft addition)
ALTER TABLE public.evaluation_pillars ADD COLUMN IF NOT EXISTS tagline text;

-- Only wipe seed data if no scores exist yet
DO $$
DECLARE v_scores int;
BEGIN
  SELECT count(*) INTO v_scores FROM public.evaluation_scores;
  IF v_scores = 0 THEN
    DELETE FROM public.evaluation_competencies;
    DELETE FROM public.evaluation_pillars;
  END IF;
END $$;

INSERT INTO public.evaluation_pillars (slug, name, description, tagline, sort_order)
VALUES
  ('seguranca', 'SEGURANÇA', 'Base invisível da experiência: protege pessoas, processos, emoções, narrativas e a confiança na marca.', '"Sem segurança, não existe magia."', 1),
  ('alegria', 'ALEGRIA', 'Energia emocional da experiência: transforma ambientes, relações e momentos em memórias positivas e acolhedoras.', '"A magia precisa fazer as pessoas saírem melhores do que entraram."', 2),
  ('imersao', 'IMERSÃO', 'O que transforma um ambiente em um mundo vivo. Nasce da coerência entre história, narrativa, comportamento, linguagem e detalhes.', '"A magia acontece quando tudo conversa entre si."', 3),
  ('eficiencia', 'EFICIÊNCIA', 'Sustenta a experiência com organização, continuidade e inteligência operacional, sem que os bastidores apareçam mais do que a magia.', '"A magia precisa funcionar com fluidez."', 4)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      tagline = EXCLUDED.tagline,
      sort_order = EXCLUDED.sort_order;

WITH p AS (SELECT id, slug FROM public.evaluation_pillars)
INSERT INTO public.evaluation_competencies (pillar_id, code, name, description, expected_score, sort_order)
SELECT p.id, c.code, c.name, c.description, 4, c.sort_order
FROM (VALUES
  ('seguranca','seg_confiabilidade','Confiabilidade e responsabilidade','Capacidade de atuar com responsabilidade, ética e compromisso, transmitindo segurança através das atitudes, entregas e postura profissional.',1),
  ('seguranca','seg_disciplina','Disciplina e cumprimento de padrões','Respeito às normas, processos, combinados e padrões operacionais da Hector Studios.',2),
  ('seguranca','seg_assiduidade','Assiduidade e pontualidade','Compromisso com presença, horários e continuidade da operação.',3),
  ('seguranca','seg_atencao','Atenção aos detalhes e segurança operacional','Executar atividades com cuidado, atenção e percepção de riscos, evitando falhas que comprometam pessoas, operação ou experiência.',4),
  ('seguranca','seg_convidado','Segurança do convidado e cuidado com a experiência','Agir de forma preventiva e responsável para garantir a segurança física, emocional e operacional dos convidados durante toda a jornada.',5),
  ('alegria','ale_empatia','Empatia e acolhimento','Ouvir, compreender e respeitar as necessidades e sentimentos das pessoas, promovendo relações humanas e acolhedoras.',1),
  ('alegria','ale_servico','Espírito de serviço','Disposição genuína para ajudar, apoiar e servir com qualidade, contribuindo para experiências positivas.',2),
  ('alegria','ale_simpatia','Simpatia e energia positiva','Contribuir para uma atmosfera leve, agradável e emocionalmente positiva através da postura, comunicação e presença.',3),
  ('alegria','ale_equipe','Trabalho em equipe e senso de elenco','Atuar de forma colaborativa, fortalecendo o espírito coletivo e entendendo que a magia é construída em conjunto.',4),
  ('alegria','ale_memorias','Criar memórias mágicas','Criar memórias encantadas que permanecem vivas no coração dos convidados.',5),
  ('alegria','ale_sorrir','Sorrir','Sorrir e criar sorrisos que permanecem por muito tempo depois do momento vivido.',6),
  ('imersao','ime_compromisso','Compromisso com a experiência','Compreender que o trabalho vai além da tarefa, considerando o impacto da sua atuação na experiência final do convidado.',1),
  ('imersao','ime_comunicacao','Comunicação clara e acessível','Transmitir informações, orientações e interações de forma clara, simples e coerente com a experiência Hector Studios.',2),
  ('imersao','ime_presenca','Presença cênica e coerência narrativa','Sustentar a verdade do universo Hector através da postura, linguagem, comportamento e atenção à história.',3),
  ('imersao','ime_orientacao','Orientação à experiência do convidado','Atuar considerando constantemente o impacto das ações na jornada imersiva, emocional e sensorial do convidado.',4),
  ('eficiencia','efi_fluidez','Fluidez operacional e eficiência','Executar atividades com organização, ritmo, clareza e continuidade, garantindo fluidez na operação.',1),
  ('eficiencia','efi_adapta','Adaptabilidade e resiliência','Lidar com mudanças, pressões, imprevistos e desafios mantendo equilíbrio, qualidade e efetividade.',2),
  ('eficiencia','efi_iniciativa','Iniciativa e resolução','Agir de forma proativa, buscando soluções e fazendo o necessário sem depender constantemente de direcionamentos.',3),
  ('eficiencia','efi_sistemica','Visão sistêmica e melhoria contínua','Compreender o funcionamento do ecossistema Hector Studios, colaborando entre áreas e buscando evolução constante dos processos.',4),
  ('eficiencia','efi_recursos','Gestão inteligente de recursos','Administrar tempo, materiais, equipamentos e recursos com responsabilidade, evitando desperdícios e priorizando o que gera valor.',5)
) AS c(pillar_slug, code, name, description, sort_order)
JOIN p ON p.slug = c.pillar_slug
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      pillar_id = EXCLUDED.pillar_id,
      sort_order = EXCLUDED.sort_order,
      expected_score = 4;

-- Official 1..5 scale
CREATE TABLE IF NOT EXISTS public.evaluation_scale (
  score int PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL
);
GRANT SELECT ON public.evaluation_scale TO authenticated, anon;
GRANT ALL ON public.evaluation_scale TO service_role;
ALTER TABLE public.evaluation_scale ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read scale" ON public.evaluation_scale;
CREATE POLICY "read scale" ON public.evaluation_scale
  FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.evaluation_scale (score, label, description) VALUES
  (1, 'A magia não acontece', 'A competência não está presente no comportamento observado.'),
  (2, 'A magia acontece raramente', 'A competência aparece de forma inconsistente e necessita desenvolvimento.'),
  (3, 'A magia acontece algumas vezes', 'A competência está presente em momentos importantes, mas ainda oscila.'),
  (4, 'A magia acontece na maior parte do tempo', 'A competência é percebida com consistência e contribui positivamente para a experiência.'),
  (5, 'A magia acontece de forma extraordinária', 'A competência está sempre presente e inspira outras pessoas através do exemplo.')
ON CONFLICT (score) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;
