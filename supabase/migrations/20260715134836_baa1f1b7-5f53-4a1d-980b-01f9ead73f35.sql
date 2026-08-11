
-- Align evaluation_competencies text with the source spreadsheet
DO $$
DECLARE
  seg uuid := (SELECT id FROM public.evaluation_pillars WHERE name = 'SEGURANÇA');
  ale uuid := (SELECT id FROM public.evaluation_pillars WHERE name = 'ALEGRIA');
  ime uuid := (SELECT id FROM public.evaluation_pillars WHERE name = 'IMERSÃO');
  efi uuid := (SELECT id FROM public.evaluation_pillars WHERE name = 'EFICIÊNCIA');
BEGIN

-- SEGURANÇA
UPDATE public.evaluation_competencies SET
  name = 'Confiabilidade e responsabilidade',
  description = 'Capacidade de atuar com responsabilidade, ética e compromisso, transmitindo segurança através das atitudes, entregas e postura profissional.'
WHERE pillar_id = seg AND sort_order = 1;

UPDATE public.evaluation_competencies SET
  name = 'Disciplina e cumprimento de padrões',
  description = 'Refere-se ao respeito às normas, processos, combinados e padrões operacionais da Hector Studios.'
WHERE pillar_id = seg AND sort_order = 2;

UPDATE public.evaluation_competencies SET
  name = 'Assiduidade e pontualidade',
  description = 'Compromisso com presença, horários e continuidade da operação, contribuindo para a estabilidade e organização do elenco.'
WHERE pillar_id = seg AND sort_order = 3;

UPDATE public.evaluation_competencies SET
  name = 'Atenção aos detalhes e segurança operacional',
  description = 'Capacidade de executar atividades com cuidado, atenção e percepção de riscos, evitando falhas que possam comprometer pessoas, operação ou experiência.'
WHERE pillar_id = seg AND sort_order = 4;

UPDATE public.evaluation_competencies SET
  name = 'Segurança do convidado e cuidado com a experiência',
  description = E'Capacidade de agir de forma preventiva e responsável para garantir a segurança física, emocional e operacional dos convidados durante toda a jornada.\nInclui atenção aos ambientes, alimentos, fluxos, interações, comunicação e qualquer situação que possa gerar risco, desconforto ou quebra de confiança.'
WHERE pillar_id = seg AND sort_order = 5;

-- ALEGRIA
UPDATE public.evaluation_competencies SET
  name = 'Empatia e Acolhimento',
  description = 'Capacidade de ouvir, compreender e respeitar as necessidades e sentimentos das pessoas, promovendo relações humanas e acolhedoras.'
WHERE pillar_id = ale AND sort_order = 1;

UPDATE public.evaluation_competencies SET
  name = 'Espírito de serviço',
  description = 'Disposição genuína para ajudar, apoiar e servir com qualidade, contribuindo para experiências positivas para convidados e equipe.'
WHERE pillar_id = ale AND sort_order = 2;

UPDATE public.evaluation_competencies SET
  name = 'Simpatia e energia positiva',
  description = 'Capacidade de contribuir para uma atmosfera leve, agradável e emocionalmente positiva através da postura, comunicação e presença.'
WHERE pillar_id = ale AND sort_order = 3;

UPDATE public.evaluation_competencies SET
  name = 'Trabalho em equipe e senso de elenco',
  description = 'Habilidade de atuar de forma colaborativa, fortalecendo o espírito coletivo e entendendo que a magia é construída em conjunto.'
WHERE pillar_id = ale AND sort_order = 4;

UPDATE public.evaluation_competencies SET
  name = 'Criar Memórias Mágicas',
  description = 'Capacidade de criar memórias encantadas que permanecem vivas no coração dos clientes.'
WHERE pillar_id = ale AND sort_order = 5;

UPDATE public.evaluation_competencies SET
  name = 'Sorrir',
  description = 'Habilidade de sorrir e criar sorrisos que permanecem por muito tempo depois do momento vivido.'
WHERE pillar_id = ale AND sort_order = 6;

-- IMERSÃO
UPDATE public.evaluation_competencies SET
  name = 'Compromisso com a experiência',
  description = 'Capacidade de compreender que o trabalho vai além da tarefa, considerando o impacto da sua atuação na experiência final do convidado.'
WHERE pillar_id = ime AND sort_order = 1;

UPDATE public.evaluation_competencies SET
  name = 'Comunicação clara e acessível',
  description = 'Capacidade de transmitir informações, orientações e interações de forma clara, simples e coerente com a experiência Hector Studios.'
WHERE pillar_id = ime AND sort_order = 2;

UPDATE public.evaluation_competencies SET
  name = 'Presença cênica e coerência narrativa',
  description = 'Capacidade de sustentar a verdade do universo Hector através da postura, linguagem, comportamento e atenção à história.'
WHERE pillar_id = ime AND sort_order = 3;

UPDATE public.evaluation_competencies SET
  name = 'Orientação à experiência do convidado',
  description = 'Capacidade de atuar considerando constantemente o impacto das ações na jornada imersiva, emocional e sensorial do convidado.'
WHERE pillar_id = ime AND sort_order = 4;

-- EFICIÊNCIA
UPDATE public.evaluation_competencies SET
  name = 'Fluidez operacional e eficiência',
  description = 'Capacidade de executar atividades com organização, ritmo, clareza e continuidade, garantindo fluidez na operação.'
WHERE pillar_id = efi AND sort_order = 1;

UPDATE public.evaluation_competencies SET
  name = 'Adaptabilidade e resiliência',
  description = 'Capacidade de lidar com mudanças, pressões, imprevistos e desafios mantendo equilíbrio, qualidade e efetividade.'
WHERE pillar_id = efi AND sort_order = 2;

UPDATE public.evaluation_competencies SET
  name = 'Iniciativa e resolução',
  description = 'Capacidade de agir de forma proativa, buscando soluções e fazendo o necessário sem depender constantemente de direcionamentos.'
WHERE pillar_id = efi AND sort_order = 3;

UPDATE public.evaluation_competencies SET
  name = 'Visão sistêmica e melhoria contínua',
  description = 'Capacidade de compreender o funcionamento do ecossistema Hector Studios, colaborando entre áreas e buscando evolução constante dos processos e experiências.'
WHERE pillar_id = efi AND sort_order = 4;

UPDATE public.evaluation_competencies SET
  name = 'Gestão inteligente de recursos',
  description = 'Capacidade de administrar tempo, materiais, equipamentos e recursos financeiros com responsabilidade e consciência, evitando desperdícios, priorizando o que gera valor e contribuindo para a sustentabilidade e eficiência da operação.'
WHERE pillar_id = efi AND sort_order = 5;

END $$;
