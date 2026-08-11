// Bússola das Quatro Essências — mapeamento comportamental (inspirado em DISC).
// Uso interno de autopercepção; NÃO é diagnóstico psicológico nem teste validado.

export type Essence = "D" | "I" | "S" | "C";

export type EssenceInfo = {
  key: Essence;
  name: string; // Desbravador / Inspirador / Guardião / Alquimista
  dimension: string; // Dominância / Influência / Estabilidade / Conformidade e Precisão
  phrase: string;
  forcas: string[];
  atencao: string[];
  ativadores: string[];
  sobPressao: string;
  comunicacao: string;
  missao: string;
};

export const ESSENCES: Record<Essence, EssenceInfo> = {
  D: {
    key: "D",
    name: "Desbravador",
    dimension: "Dominância",
    phrase: "Você transforma obstáculos em territórios a serem conquistados.",
    forcas: [
      "Coragem para decidir",
      "Foco em resultados",
      "Agilidade diante de problemas",
      "Competitividade saudável",
      "Capacidade de liderança",
      "Facilidade para enfrentar situações difíceis",
    ],
    atencao: [
      "Impaciência com processos lentos",
      "Comunicação excessivamente direta",
      "Tendência a decidir sem ouvir todas as perspectivas",
      "Dificuldade em lidar com excesso de detalhes",
      "Risco de assumir responsabilidades demais",
    ],
    ativadores: [
      "Metas claras",
      "Autonomia",
      "Desafios relevantes",
      "Poder de decisão",
      "Ambientes dinâmicos",
      "Reconhecimento por resultados",
    ],
    sobPressao:
      "Pode se tornar mais controlador, impaciente ou confrontador. Sua tendência é acelerar ainda mais quando o ambiente pede escuta e análise.",
    comunicacao:
      "Seja objetivo. Apresente o desafio, o impacto esperado, os limites e a decisão necessária. Evite explicações excessivamente longas antes de chegar ao ponto principal.",
    missao:
      "Praticar a escuta, envolver outras pessoas nas decisões e compreender que consistência também gera velocidade no longo prazo.",
  },
  I: {
    key: "I",
    name: "Inspirador",
    dimension: "Influência",
    phrase: "Você acende energia nas pessoas e transforma ideias em movimento coletivo.",
    forcas: [
      "Comunicação",
      "Criatividade",
      "Persuasão",
      "Entusiasmo",
      "Construção de relacionamentos",
      "Capacidade de mobilização",
    ],
    atencao: [
      "Dificuldade em manter foco por longos períodos",
      "Tendência a prometer mais do que consegue executar",
      "Desorganização diante de muitas ideias",
      "Necessidade elevada de reconhecimento",
      "Possibilidade de evitar conversas desconfortáveis",
    ],
    ativadores: [
      "Interação com pessoas",
      "Reconhecimento",
      "Liberdade para criar",
      "Ambientes colaborativos",
      "Novidades",
      "Oportunidades de apresentar ideias",
    ],
    sobPressao:
      "Pode falar mais do que escutar, perder foco ou buscar aprovação antes de tomar decisões difíceis.",
    comunicacao:
      "Conecte a mensagem a pessoas, possibilidades e impacto. Permita espaço para diálogo, mas finalize com responsabilidades, prazos e próximos passos claros.",
    missao:
      "Transformar entusiasmo em consistência, registrar acordos e fortalecer a disciplina de execução.",
  },
  S: {
    key: "S",
    name: "Guardião",
    dimension: "Estabilidade",
    phrase: "Você sustenta a jornada quando o caminho exige confiança, constância e cooperação.",
    forcas: [
      "Lealdade",
      "Paciência",
      "Cooperação",
      "Escuta",
      "Constância",
      "Construção de confiança",
    ],
    atencao: [
      "Resistência a mudanças abruptas",
      "Dificuldade em dizer não",
      "Tendência a evitar conflitos",
      "Possibilidade de aceitar sobrecarga",
      "Demora para comunicar desconfortos",
    ],
    ativadores: [
      "Segurança",
      "Previsibilidade",
      "Relações de confiança",
      "Orientações claras",
      "Tempo para adaptação",
      "Reconhecimento por consistência",
    ],
    sobPressao:
      "Pode se fechar, evitar posicionamentos ou aceitar decisões com as quais não concorda para preservar a harmonia.",
    comunicacao:
      "Apresente mudanças com contexto, etapas e segurança. Demonstre respeito pelo ritmo de adaptação e abra espaço real para dúvidas.",
    missao:
      "Comunicar limites, posicionar-se com mais clareza e compreender que conversas difíceis também podem proteger relações.",
  },
  C: {
    key: "C",
    name: "Alquimista",
    dimension: "Conformidade e Precisão",
    phrase: "Você transforma informação em qualidade, estrutura e confiança.",
    forcas: [
      "Organização",
      "Pensamento analítico",
      "Atenção aos detalhes",
      "Planejamento",
      "Controle de qualidade",
      "Capacidade de identificar riscos",
    ],
    atencao: [
      "Excesso de análise",
      "Perfeccionismo",
      "Dificuldade em agir com informações incompletas",
      "Comunicação excessivamente técnica",
      "Tendência a concentrar-se nos erros antes dos avanços",
    ],
    ativadores: [
      "Critérios claros",
      "Dados confiáveis",
      "Tempo para análise",
      "Padrões definidos",
      "Autonomia técnica",
      "Ambientes organizados",
    ],
    sobPressao:
      "Pode ficar mais crítico, rígido ou indeciso. Sua busca por segurança pode atrasar decisões que exigem experimentação.",
    comunicacao:
      "Apresente contexto, dados, critérios e expectativas. Evite pressionar por uma resposta imediata quando uma análise responsável for necessária.",
    missao:
      "Aceitar versões iniciais, diferenciar excelência de perfeccionismo e agir quando já existem informações suficientes.",
  },
};

export type Question = {
  n: number;
  prompt: string;
  options: { label: "A" | "B" | "C" | "D"; text: string; key: Essence }[];
};

// Cada opção já carrega a essência correspondente (mapeamento oficial da estrutura).
export const QUESTIONS: Question[] = [
  {
    n: 1,
    prompt:
      "Uma nova missão começa, mas ainda existem muitas informações indefinidas. Você tende a:",
    options: [
      {
        label: "A",
        key: "D",
        text: "Assumir a frente, definir uma direção inicial e começar a avançar.",
      },
      {
        label: "B",
        key: "S",
        text: "Aguardar os principais alinhamentos e ajudar o grupo a manter a organização.",
      },
      {
        label: "C",
        key: "I",
        text: "Conversar com as pessoas envolvidas para construir entusiasmo e conexão.",
      },
      {
        label: "D",
        key: "C",
        text: "Levantar dados, riscos e informações antes de definir os próximos passos.",
      },
    ],
  },
  {
    n: 2,
    prompt: "Durante uma reunião, surgem opiniões muito diferentes. Você costuma:",
    options: [
      {
        label: "A",
        key: "S",
        text: "Ouvir todos e buscar uma solução que preserve a colaboração.",
      },
      {
        label: "B",
        key: "C",
        text: "Comparar as propostas com os critérios e objetivos definidos.",
      },
      {
        label: "C",
        key: "D",
        text: "Defender uma direção clara para que a decisão não fique parada.",
      },
      {
        label: "D",
        key: "I",
        text: "Facilitar a conversa e aproximar os diferentes pontos de vista.",
      },
    ],
  },
  {
    n: 3,
    prompt: "Um prazo importante foi reduzido inesperadamente. Sua primeira reação é:",
    options: [
      {
        label: "A",
        key: "I",
        text: "Mobilizar o grupo e transmitir energia para enfrentar o desafio.",
      },
      {
        label: "B",
        key: "D",
        text: "Redefinir prioridades e eliminar tudo que não for essencial.",
      },
      {
        label: "C",
        key: "C",
        text: "Reorganizar o planejamento e criar novos pontos de controle.",
      },
      {
        label: "D",
        key: "S",
        text: "Distribuir as atividades com calma e apoiar quem estiver sobrecarregado.",
      },
    ],
  },
  {
    n: 4,
    prompt: "Uma nova pessoa entra para o time. Você naturalmente:",
    options: [
      { label: "A", key: "C", text: "Explica os processos, ferramentas e padrões necessários." },
      {
        label: "B",
        key: "I",
        text: "Recebe a pessoa com entusiasmo e apresenta o restante da equipe.",
      },
      {
        label: "C",
        key: "S",
        text: "Acompanha seus primeiros dias e se coloca disponível para ajudar.",
      },
      {
        label: "D",
        key: "D",
        text: "Apresenta rapidamente os objetivos e dá espaço para que ela comece a agir.",
      },
    ],
  },
  {
    n: 5,
    prompt: "Você identifica um erro em uma entrega importante. Sua tendência é:",
    options: [
      {
        label: "A",
        key: "S",
        text: "Conversar com os envolvidos e resolver o problema sem gerar tensão desnecessária.",
      },
      {
        label: "B",
        key: "D",
        text: "Corrigir rapidamente o que for necessário e proteger o resultado.",
      },
      {
        label: "C",
        key: "C",
        text: "Investigar a origem do erro e evitar que ele volte a acontecer.",
      },
      {
        label: "D",
        key: "I",
        text: "Chamar as pessoas certas, alinhar a comunicação e recuperar a confiança.",
      },
    ],
  },
  {
    n: 6,
    prompt: "Em atividades muito repetitivas, você geralmente:",
    options: [
      {
        label: "A",
        key: "I",
        text: "Procura envolver outras pessoas e deixar o processo mais dinâmico.",
      },
      { label: "B", key: "C", text: "Busca aperfeiçoar o método e reduzir falhas." },
      {
        label: "C",
        key: "D",
        text: "Questiona se a atividade pode ser eliminada, automatizada ou acelerada.",
      },
      {
        label: "D",
        key: "S",
        text: "Mantém a constância e garante que tudo seja concluído corretamente.",
      },
    ],
  },
  {
    n: 7,
    prompt: "Um planejamento muda de última hora. Você tende a:",
    options: [
      { label: "A", key: "D", text: "Adaptar a estratégia rapidamente e seguir em frente." },
      { label: "B", key: "I", text: "Comunicar a mudança de forma positiva e engajar as pessoas." },
      { label: "C", key: "S", text: "Ajudar o grupo a realizar a transição com tranquilidade." },
      { label: "D", key: "C", text: "Revisar os impactos antes de executar o novo plano." },
    ],
  },
  {
    n: 8,
    prompt: "Você percebe que o time está desmotivado. Sua reação mais natural é:",
    options: [
      {
        label: "A",
        key: "C",
        text: "Analisar o que está prejudicando o desempenho e propor ajustes.",
      },
      { label: "B", key: "S", text: "Escutar as pessoas individualmente e oferecer apoio." },
      { label: "C", key: "I", text: "Criar um momento de conexão, reconhecimento ou inspiração." },
      { label: "D", key: "D", text: "Reforçar o objetivo e desafiar o grupo a recuperar o ritmo." },
    ],
  },
  {
    n: 9,
    prompt: "Uma decisão precisa ser tomada com poucas informações. Você costuma:",
    options: [
      {
        label: "A",
        key: "D",
        text: "Decidir com base no que está disponível e ajustar durante o caminho.",
      },
      { label: "B", key: "C", text: "Buscar rapidamente os dados mínimos necessários." },
      { label: "C", key: "I", text: "Consultar pessoas que possam trazer diferentes percepções." },
      {
        label: "D",
        key: "S",
        text: "Avaliar como a decisão afetará a equipe e a continuidade do trabalho.",
      },
    ],
  },
  {
    n: 10,
    prompt: "Ao apresentar uma nova ideia, você prefere:",
    options: [
      {
        label: "A",
        key: "S",
        text: "Mostrar como ela beneficiará as pessoas e facilitará a rotina.",
      },
      {
        label: "B",
        key: "I",
        text: "Contar a ideia de maneira envolvente e despertar entusiasmo.",
      },
      { label: "C", key: "C", text: "Apresentar dados, estrutura, riscos e viabilidade." },
      {
        label: "D",
        key: "D",
        text: "Ir direto ao objetivo, aos resultados e à decisão necessária.",
      },
    ],
  },
  {
    n: 11,
    prompt: "Quando recebe um feedback crítico, você tende a:",
    options: [
      {
        label: "A",
        key: "C",
        text: "Analisar os exemplos e verificar exatamente o que precisa ser ajustado.",
      },
      {
        label: "B",
        key: "D",
        text: "Questionar, entender o impacto e buscar uma solução imediata.",
      },
      { label: "C", key: "S", text: "Escutar com calma e refletir antes de responder." },
      {
        label: "D",
        key: "I",
        text: "Conversar abertamente para compreender a percepção da outra pessoa.",
      },
    ],
  },
  {
    n: 12,
    prompt: "Você identifica um processo lento e pouco eficiente. Sua tendência é:",
    options: [
      { label: "A", key: "I", text: "Reunir as pessoas envolvidas e estimular novas ideias." },
      {
        label: "B",
        key: "S",
        text: "Fazer melhorias graduais sem comprometer a estabilidade da operação.",
      },
      { label: "C", key: "D", text: "Propor uma mudança direta e acelerar sua implementação." },
      { label: "D", key: "C", text: "Mapear cada etapa antes de redesenhar o processo." },
    ],
  },
  {
    n: 13,
    prompt: "Duas pessoas da equipe entram em conflito. Você normalmente:",
    options: [
      { label: "A", key: "S", text: "Escuta os dois lados e ajuda a reconstruir a confiança." },
      { label: "B", key: "I", text: "Facilita uma conversa franca e reduz a tensão." },
      {
        label: "C",
        key: "D",
        text: "Direciona o grupo para uma decisão e evita que o conflito paralise o trabalho.",
      },
      {
        label: "D",
        key: "C",
        text: "Separa fatos de interpretações e analisa a origem do problema.",
      },
    ],
  },
  {
    n: 14,
    prompt: "Você recebe uma tarefa de grande responsabilidade. Sua tendência é:",
    options: [
      { label: "A", key: "C", text: "Planejar cuidadosamente e definir padrões de qualidade." },
      { label: "B", key: "D", text: "Assumir o controle e buscar um resultado expressivo." },
      { label: "C", key: "I", text: "Envolver pessoas estratégicas e gerar comprometimento." },
      { label: "D", key: "S", text: "Organizar uma rotina constante para garantir a execução." },
    ],
  },
  {
    n: 15,
    prompt: "Um cliente ou visitante demonstra insatisfação. Você costuma:",
    options: [
      {
        label: "A",
        key: "I",
        text: "Criar conexão, conversar e recuperar a experiência da pessoa.",
      },
      { label: "B", key: "S", text: "Escutar com paciência e demonstrar acolhimento." },
      { label: "C", key: "C", text: "Verificar os fatos e encontrar a solução mais adequada." },
      { label: "D", key: "D", text: "Agir rapidamente para resolver a situação." },
    ],
  },
  {
    n: 16,
    prompt: "Ao aprender uma nova ferramenta, você prefere:",
    options: [
      { label: "A", key: "D", text: "Explorar diretamente e descobrir as funções durante o uso." },
      { label: "B", key: "C", text: "Ler orientações, entender a lógica e testar com cuidado." },
      {
        label: "C",
        key: "S",
        text: "Aprender em um ritmo constante, com acompanhamento quando necessário.",
      },
      {
        label: "D",
        key: "I",
        text: "Trocar experiências com outras pessoas e aprender de forma colaborativa.",
      },
    ],
  },
  {
    n: 17,
    prompt: "Quando existem muitas demandas simultâneas, você tende a:",
    options: [
      { label: "A", key: "C", text: "Criar uma estrutura de prioridades, prazos e controles." },
      { label: "B", key: "I", text: "Conversar com os envolvidos e manter todos informados." },
      {
        label: "C",
        key: "D",
        text: "Escolher as entregas de maior impacto e avançar rapidamente.",
      },
      {
        label: "D",
        key: "S",
        text: "Organizar uma sequência sustentável e executar uma tarefa por vez.",
      },
    ],
  },
  {
    n: 18,
    prompt: "Quando uma entrega alcança um grande resultado, você prefere:",
    options: [
      {
        label: "A",
        key: "S",
        text: "Reconhecer o esforço coletivo e valorizar a contribuição de todos.",
      },
      { label: "B", key: "D", text: "Celebrar a conquista e já pensar no próximo desafio." },
      {
        label: "C",
        key: "I",
        text: "Compartilhar o resultado e contagiar as pessoas com a conquista.",
      },
      { label: "D", key: "C", text: "Avaliar o que funcionou e registrar os aprendizados." },
    ],
  },
  {
    n: 19,
    prompt: "O líder da missão está indisponível e uma decisão precisa ser tomada. Você tende a:",
    options: [
      { label: "A", key: "D", text: "Assumir a responsabilidade e decidir." },
      { label: "B", key: "S", text: "Buscar consenso entre as pessoas envolvidas." },
      { label: "C", key: "C", text: "Consultar orientações, registros e critérios já existentes." },
      { label: "D", key: "I", text: "Conversar com o grupo e construir apoio para a decisão." },
    ],
  },
  {
    n: 20,
    prompt: "Uma regra importante não está sendo seguida. Você costuma:",
    options: [
      { label: "A", key: "C", text: "Verificar a regra, sua finalidade e os fatos envolvidos." },
      { label: "B", key: "D", text: "Intervir de forma direta e corrigir o comportamento." },
      { label: "C", key: "I", text: "Conversar com as pessoas e explicar a importância da regra." },
      { label: "D", key: "S", text: "Orientar com paciência e acompanhar a mudança." },
    ],
  },
  {
    n: 21,
    prompt: "Durante uma sessão de criação, você geralmente:",
    options: [
      {
        label: "A",
        key: "I",
        text: "Gera possibilidades, conecta ideias e estimula a participação.",
      },
      { label: "B", key: "C", text: "Avalia a viabilidade e identifica inconsistências." },
      {
        label: "C",
        key: "S",
        text: "Escuta, organiza as contribuições e ajuda o grupo a construir em conjunto.",
      },
      { label: "D", key: "D", text: "Direciona a discussão para uma solução concreta." },
    ],
  },
  {
    n: 22,
    prompt: "Em um projeto longo, você tende a:",
    options: [
      { label: "A", key: "S", text: "Manter um ritmo constante e apoiar a continuidade do grupo." },
      {
        label: "B",
        key: "C",
        text: "Criar controles, padrões e registros para acompanhar a evolução.",
      },
      { label: "C", key: "D", text: "Cobrar avanços e impedir que o projeto perca velocidade." },
      {
        label: "D",
        key: "I",
        text: "Manter as pessoas conectadas e renovar o entusiasmo ao longo da jornada.",
      },
    ],
  },
  {
    n: 23,
    prompt: "Surge um problema inesperado no dia de um grande evento. Você tende a:",
    options: [
      { label: "A", key: "D", text: "Tomar uma decisão rápida e reorganizar a operação." },
      { label: "B", key: "I", text: "Manter a comunicação ativa e transmitir confiança." },
      { label: "C", key: "C", text: "Analisar a causa e escolher a solução com menor risco." },
      { label: "D", key: "S", text: "Ajudar cada pessoa a manter a calma e cumprir sua função." },
    ],
  },
  {
    n: 24,
    prompt: "Ao escolher seu papel em uma grande missão, você normalmente prefere:",
    options: [
      {
        label: "A",
        key: "C",
        text: "Estruturar o plano, controlar detalhes e garantir a qualidade.",
      },
      { label: "B", key: "S", text: "Sustentar a operação e garantir que todos tenham suporte." },
      { label: "C", key: "I", text: "Representar a missão, conectar pessoas e comunicar ideias." },
      { label: "D", key: "D", text: "Liderar decisões, enfrentar desafios e buscar resultados." },
    ],
  },
];

// Combinações (pares). Chave canônica na ordem de rank D < I < S < C.
export const RANK: Record<Essence, number> = { D: 0, I: 1, S: 2, C: 3 };

export const COMBINATIONS: Record<string, { name: string; desc: string; atencao: string }> = {
  "D+I": {
    name: "Líder Catalisador",
    desc: "Combina decisão, energia e capacidade de mobilização. Costuma liderar pelo entusiasmo e transformar ideias em ação rapidamente.",
    atencao:
      "Pode acelerar decisões, assumir compromissos demais ou perder interesse durante etapas mais operacionais.",
  },
  "D+S": {
    name: "Guardião de Missões",
    desc: "Combina firmeza com responsabilidade pelas pessoas. Busca resultados, mas valoriza estabilidade, confiança e proteção da equipe.",
    atencao: "Pode alternar entre confrontar problemas e evitar tensões para preservar relações.",
  },
  "D+C": {
    name: "Arquiteto de Conquistas",
    desc: "Combina ambição, análise e controle. Costuma definir objetivos elevados e construir estruturas para alcançá-los.",
    atencao:
      "Pode tornar-se exigente, crítico ou controlador quando os resultados não seguem o padrão esperado.",
  },
  "I+S": {
    name: "Embaixador da Tribo",
    desc: "Combina comunicação, acolhimento e conexão. Costuma unir pessoas, fortalecer a cultura e criar ambientes colaborativos.",
    atencao:
      "Pode evitar decisões impopulares ou priorizar o clima do grupo acima de problemas que precisam ser enfrentados.",
  },
  "I+C": {
    name: "Narrador Estratégico",
    desc: "Combina criatividade, comunicação e pensamento estruturado. Consegue transformar informações complexas em mensagens envolventes.",
    atencao:
      "Pode oscilar entre espontaneidade e perfeccionismo, atrasando entregas enquanto busca a melhor forma de apresentar uma ideia.",
  },
  "S+C": {
    name: "Mestre da Excelência",
    desc: "Combina consistência, organização e responsabilidade. Costuma sustentar processos e proteger a qualidade das entregas.",
    atencao: "Pode resistir a mudanças rápidas ou manter processos que já deveriam ser revistos.",
  },
};

export function comboFor(
  a: Essence,
  b: Essence,
): { name: string; desc: string; atencao: string } | null {
  if (a === b) return null;
  const key = [a, b].sort((x, y) => RANK[x] - RANK[y]).join("+");
  return COMBINATIONS[key] ?? null;
}

// Casa o perfil da pessoa (primária/secundária) com o personagem Hector mais próximo.
export function characterFor(
  primary: Essence,
  secondary: Essence | null,
): { name: string; profile: string } | null {
  const match = (target: string) => CHARACTERS.find((c) => c.profile.toUpperCase() === target);
  if (secondary) {
    return (
      match(`${primary}/${secondary}`) ??
      match(`${secondary}/${primary}`) ??
      CHARACTERS.find((c) => c.profile.toUpperCase().startsWith(`${primary}/`)) ??
      null
    );
  }
  return CHARACTERS.find((c) => c.profile.toUpperCase().startsWith(`${primary}/`)) ?? null;
}

// Perfis comportamentais dos personagens Hector (referência).
export const CHARACTERS: { name: string; profile: string }[] = [
  { name: "Hector", profile: "I/S" },
  { name: "Professor Kines", profile: "C/S" },
  { name: "Asdrúbal", profile: "D/I" },
  { name: "Lady Lince", profile: "S/C" },
  { name: "Gruga Grinstone", profile: "D/I" },
  { name: "Merina", profile: "I/S" },
  { name: "Táchy", profile: "S/I" },
  { name: "Professor Stan", profile: "C/D" },
  { name: "Gronk", profile: "S/I" },
  { name: "Keoma", profile: "I/D" },
  { name: "Kóry", profile: "S/C" },
  { name: "Layla", profile: "I/S" },
  { name: "Rênya", profile: "D/C" },
];
