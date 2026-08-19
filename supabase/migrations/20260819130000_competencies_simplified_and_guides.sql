-- Simplifica os textos das 20 competências (linguagem de comportamento
-- observável, não de definição abstrata) e adiciona um guia prático de
-- "como avaliar" pra cada uma, usado pelo avaliador durante o preenchimento.
alter table public.evaluation_competencies
  add column if not exists how_to_evaluate text;

-- SEGURANÇA
update public.evaluation_competencies set
  description = 'Cumpre o que promete, é ético nas atitudes e assume responsabilidade pelas próprias entregas.',
  how_to_evaluate = 'Observe se a pessoa cumpre prazos e combinados sem precisar ser cobrada, se assume erros ao invés de esconder ou culpar outros, e se mantém a palavra mesmo quando é mais fácil não cumprir.'
where code = 'seg_confiabilidade';

update public.evaluation_competencies set
  description = 'Segue as normas, processos e padrões operacionais definidos pela Hector Studios, mesmo sem supervisão direta.',
  how_to_evaluate = 'Verifique se a pessoa segue os procedimentos padrão (checklists, protocolos, roteiros) mesmo quando ninguém está olhando, e como reage quando é corrigida sobre um padrão que não seguiu.'
where code = 'seg_disciplina';

update public.evaluation_competencies set
  description = 'Chega no horário combinado e mantém presença constante, sem faltas ou atrasos recorrentes.',
  how_to_evaluate = 'Consulte o histórico de presença/escala do período. Considere também: a pessoa avisa com antecedência quando não pode comparecer? Chega pronta pra começar no horário, ou "chega e ainda se arruma"?'
where code = 'seg_assiduidade';

update public.evaluation_competencies set
  description = 'Executa as atividades com cuidado, percebe riscos antes que virem problema e evita falhas que afetem pessoas ou a operação.',
  how_to_evaluate = 'Pense em situações em que a pessoa percebeu (ou deixou passar) um risco — um equipamento com defeito, um fluxo perigoso, um detalhe fora do padrão. Ela age preventivamente ou só reage depois que o problema já aconteceu?'
where code = 'seg_atencao';

update public.evaluation_competencies set
  description = 'Age de forma preventiva pra garantir a segurança física e emocional do convidado durante toda a visita.',
  how_to_evaluate = 'Observe a postura da pessoa em momentos de fluxo intenso ou situações de risco com convidados (crianças, idosos, PCD). Ela antecipa problemas ou só resolve quando já viraram reclamação?'
where code = 'seg_convidado';

-- ALEGRIA
update public.evaluation_competencies set
  description = 'Escuta e se coloca no lugar das pessoas, tratando cada convidado e colega com respeito e atenção genuína.',
  how_to_evaluate = 'Veja como a pessoa reage a um convidado ou colega frustrado, cansado ou com necessidade especial — ela escuta antes de responder, ou parte direto pra solução sem entender o que a pessoa sente?'
where code = 'ale_empatia';

update public.evaluation_competencies set
  description = 'Ajuda com disposição genuína, sem esperar ser pedida, contribuindo pra uma experiência melhor pra quem está por perto.',
  how_to_evaluate = 'Repare se a pessoa se oferece pra ajudar (colega sobrecarregado, convidado perdido) antes de ser chamada, ou só age quando é explicitamente solicitada.'
where code = 'ale_servico';

update public.evaluation_competencies set
  description = 'Mantém um clima leve e positivo através da postura, do tom de voz e da forma como se comunica.',
  how_to_evaluate = 'Observe o tom da pessoa em dias difíceis ou de operação puxada — ela consegue manter a energia positiva sem parecer forçada ou automática?'
where code = 'ale_simpatia';

update public.evaluation_competencies set
  description = 'Colabora com o time, ajuda colegas e entende que a magia é resultado do trabalho de todo mundo, não só do individual.',
  how_to_evaluate = 'Pense em como a pessoa se comporta quando o time está sobrecarregado — ela sai do próprio posto pra ajudar, compartilha informação, ou trabalha isolada só na própria função?'
where code = 'ale_equipe';

update public.evaluation_competencies set
  description = 'Cria momentos especiais e surpreendentes que ficam na memória do convidado depois da visita.',
  how_to_evaluate = 'Pergunte-se: existe algum momento em que essa pessoa foi além do script pra criar uma surpresa, um gesto ou uma interação que marcou um convidado? Isso é hábito ou exceção?'
where code = 'ale_memorias';

update public.evaluation_competencies set
  description = 'Sorri com frequência e genuinamente, contagiando quem está por perto.',
  how_to_evaluate = 'Observe se o sorriso é presente e parece natural, inclusive em momentos de cansaço ou operação corrida — não precisa ser 100% do tempo, mas deve ser recorrente e verdadeiro.'
where code = 'ale_sorrir';

-- IMERSÃO
update public.evaluation_competencies set
  description = 'Entende que cada ação impacta a experiência final do convidado, e não trata o trabalho como só "bater a tarefa".',
  how_to_evaluate = 'Veja se a pessoa pensa no impacto do que faz na experiência do convidado (ex.: caprichar mesmo quando ninguém vai perceber) ou se faz só o mínimo pra "estar feito".'
where code = 'ime_compromisso';

update public.evaluation_competencies set
  description = 'Explica informações e orientações de forma simples e clara, sem soar robótico ou confuso.',
  how_to_evaluate = 'Observe como a pessoa explica algo pra um convidado ou colega novo — a explicação é fácil de entender de primeira, ou precisa ser repetida/reformulada?'
where code = 'ime_comunicacao';

update public.evaluation_competencies set
  description = 'Sustenta a postura, a linguagem e o comportamento condizentes com o universo Hector Studios, sem "quebrar a magia".',
  how_to_evaluate = 'Note se a pessoa mantém a coerência do personagem/papel mesmo em situações inesperadas (imprevistos, perguntas fora do roteiro), sem sair do tom ou "cair de personagem" desnecessariamente.'
where code = 'ime_presenca';

update public.evaluation_competencies set
  description = 'Age pensando constantemente em como a própria atuação afeta a jornada emocional e sensorial do convidado.',
  how_to_evaluate = 'Pense em decisões do dia a dia — a pessoa escolhe o caminho mais fácil pra ela, ou o que garante a melhor experiência pro convidado, mesmo quando dá mais trabalho?'
where code = 'ime_orientacao';

-- EFICIÊNCIA
update public.evaluation_competencies set
  description = 'Executa as atividades com organização e ritmo, mantendo a operação fluindo sem gargalos.',
  how_to_evaluate = 'Observe o ritmo de trabalho em momentos de pico — a pessoa mantém organização e fluidez, ou gera filas/atrasos por desorganização própria?'
where code = 'efi_fluidez';

update public.evaluation_competencies set
  description = 'Mantém o equilíbrio e a qualidade do trabalho mesmo diante de imprevistos, pressão ou mudanças de última hora.',
  how_to_evaluate = 'Pense numa mudança de escala, imprevisto técnico ou pico inesperado de demanda — como a pessoa reagiu? Manteve a calma e se ajustou, ou travou/reclamou/perdeu a qualidade?'
where code = 'efi_adapta';

update public.evaluation_competencies set
  description = 'Age de forma proativa pra resolver problemas, sem precisar que alguém diga o que fazer o tempo todo.',
  how_to_evaluate = 'Veja se a pessoa identifica e resolve problemas por conta própria (dentro do que é permitido) ou sempre espera uma ordem direta antes de agir, mesmo diante de algo óbvio.'
where code = 'efi_iniciativa';

update public.evaluation_competencies set
  description = 'Entende como sua área se conecta com o restante da Hector Studios e contribui com ideias pra melhorar processos.',
  how_to_evaluate = 'Considere se a pessoa já trouxe alguma sugestão de melhoria, ou se entende o impacto do próprio trabalho em outras áreas — ou se enxerga só a própria função, isolada do resto.'
where code = 'efi_sistemica';

update public.evaluation_competencies set
  description = 'Utiliza materiais, alimentos, equipamentos e demais recursos seguindo os padrões definidos e evitando desperdícios.',
  how_to_evaluate = 'Observe o uso de materiais e insumos no dia a dia — a pessoa segue as quantidades/padrões definidos, ou desperdiça por falta de atenção ou pressa?'
where code = 'efi_recursos';
