// Conteúdo cultural oficial da Hector Studios.
// Fonte: "Manual da Magia — Hector Studios" (Espírito Mágico).
// Usado no app para pilares de avaliação, notificações e frase do dia.

export type PillarKey = "amar" | "honrar" | "verdadeiro" | "justo" | "servir";

export interface Pillar {
  key: PillarKey;
  name: string;
  tagline: string;
  essence: string;
  is: string[];
  isNot: string[];
  seal: string; // frase de encerramento do pilar
}

export const PILLARS: Pillar[] = [
  {
    key: "amar",
    name: "Amar",
    tagline: "Pessoas antes de processos.",
    essence:
      "Amar é lembrar, todos os dias, que pessoas vêm antes de processos, números e resultados. Aparece na forma como tratamos uns aos outros, no cuidado com os detalhes e na escolha de agir com humanidade.",
    is: [
      "Cuidar de pessoas de forma intencional.",
      "Tratar todos com dignidade e respeito.",
      "Ter empatia, paciência e humanidade.",
      "Proteger o outro, mesmo quando é mais difícil.",
      "Corrigir com amor, não com humilhação.",
    ],
    isNot: [
      "Passar por cima de alguém para crescer.",
      "Ignorar sentimentos ou limites.",
      "Ser frio, ríspido ou indiferente.",
      "Justificar desrespeito por pressão ou resultado.",
      "Confundir amor com permissividade.",
    ],
    seal: "Amar é cuidar da forma como ajudamos o outro a crescer.",
  },
  {
    key: "honrar",
    name: "Honrar",
    tagline: "Palavra dada é palavra cumprida.",
    essence:
      "Honrar é escolher agir com respeito, verdade e responsabilidade, mesmo quando ninguém está olhando. Nasce da convicção, protege relações e sustenta a cultura de pé.",
    is: [
      "Cumprir compromissos e acordos.",
      "Zelar pelo nome Hector.",
      "Respeitar colegas, convidados e parceiros.",
      "Preservar a história e os bastidores do Reino.",
      "Agir com postura elevada, sempre.",
    ],
    isNot: [
      "Expor conflitos, erros ou bastidores.",
      "Falar mal de pessoas ou da empresa.",
      "Quebrar acordos por conveniência.",
      "Agir de forma que manche a marca.",
      "Usar cargo ou poder para se impor.",
    ],
    seal: "Honrar é cuidar daquilo que foi confiado às nossas mãos.",
  },
  {
    key: "verdadeiro",
    name: "Ser Verdadeiro",
    tagline: "Coerência entre o que se fala e o que se faz.",
    essence:
      "Ser verdadeiro é sustentar a confiança pelo que se fala, se faz e se entrega. Aparece quando há coerência entre palavra, atitude e intenção — sem criar aparência.",
    is: [
      "Alinhar fala, atitude e entrega.",
      "Ser transparente e honesto.",
      "Assumir erros e aprender com eles.",
      "Comunicar com clareza e respeito.",
      "Corrigir informações quando necessário.",
    ],
    isNot: [
      "Mentir ou omitir o que é relevante.",
      "Prometer o que não pode ser entregue.",
      "Manipular informações ou discursos.",
      "Fingir que está tudo bem quando não está.",
      "Criar aparência em vez de realidade.",
    ],
    seal:
      "Ser verdadeiro é ter coragem de sustentar a verdade com respeito, clareza e responsabilidade.",
  },
  {
    key: "justo",
    name: "Ser Justo",
    tagline: "O certo, mesmo quando exige mais.",
    essence:
      "Ser justo é escolher o que é certo, mesmo quando isso exige mais de nós. Aparece na forma como ouvimos, decidimos, corrigimos e tratamos as pessoas ao nosso redor.",
    is: [
      "Ouvir antes de julgar.",
      "Decidir com ética e equilíbrio.",
      "Reconhecer méritos com honestidade.",
      "Corrigir sem favorecer nem punir por afeto.",
      "Sustentar o certo mesmo quando é impopular.",
    ],
    isNot: [
      "Fechar os olhos para o que precisa ser visto.",
      "Trocar o certo pelo mais conveniente.",
      "Julgar sem escutar todos os lados.",
      "Usar cargo para privilegiar quem gosta.",
      "Confundir justiça com dureza.",
    ],
    seal: "Ser justo é escolher o certo, todos os dias, especialmente quando dói.",
  },
  {
    key: "servir",
    name: "Servir",
    tagline: "Magia é entregar mais do que se espera.",
    essence:
      "Servir é a disposição genuína de ajudar, apoiar e entregar com qualidade. É o que transforma tarefa em experiência e faz cada convidado — e cada colega — sair melhor do que entrou.",
    is: [
      "Antecipar necessidades sem esperar pedido.",
      "Cuidar do detalhe que ninguém vê.",
      "Servir com sorriso e presença.",
      "Ajudar colegas mesmo fora da sua função.",
      "Buscar o encantamento acima do suficiente.",
    ],
    isNot: [
      "Fazer o mínimo e ir embora.",
      "Enxergar servir como submissão.",
      "Servir com má vontade ou pressa.",
      "Cobrar reconhecimento por cada gesto.",
      "Ignorar quem precisa por não ser 'sua área'.",
    ],
    seal: "Servir é o gesto silencioso que faz a magia acontecer.",
  },
];

// Frases motivacionais para a Home (rotação diária determinística).
// Baseadas no Manual da Magia. Curtas, primeira pessoa/plural, tom Hector.
export const DAILY_PHRASES: { text: string; pillar: PillarKey }[] = [
  { text: "A magia não acontece por acaso. Ela nasce do cuidado com cada detalhe.", pillar: "servir" },
  { text: "Pessoas vêm antes de processos, números e resultados.", pillar: "amar" },
  { text: "Corrigir com amor, não com humilhação.", pillar: "amar" },
  { text: "Amar é cuidar da forma como ajudamos o outro a crescer.", pillar: "amar" },
  { text: "Palavra dada é palavra cumprida.", pillar: "honrar" },
  { text: "Honrar é cuidar daquilo que foi confiado às nossas mãos.", pillar: "honrar" },
  { text: "Agir com postura elevada, sempre — mesmo quando ninguém está olhando.", pillar: "honrar" },
  { text: "O que se fala, o que se faz e o que se entrega precisam caminhar juntos.", pillar: "verdadeiro" },
  { text: "Assumir o erro é mais mágico do que fingir que está tudo bem.", pillar: "verdadeiro" },
  { text: "Verdade dita com respeito abre porta que aparência nenhuma abre.", pillar: "verdadeiro" },
  { text: "Ser justo é escolher o certo, todos os dias, especialmente quando dói.", pillar: "justo" },
  { text: "Ouça antes de julgar. Decida com equilíbrio.", pillar: "justo" },
  { text: "Servir é o gesto silencioso que faz a magia acontecer.", pillar: "servir" },
  { text: "Antecipe. Onde há atenção, há encantamento.", pillar: "servir" },
  { text: "Somos a história que alguém vai contar com um sorriso no rosto.", pillar: "amar" },
  { text: "Faça tão bem feito que as pessoas queiram voltar só pra ver de novo.", pillar: "servir" },
  { text: "A magia é aquilo que toca, marca e transforma.", pillar: "servir" },
  { text: "Cuidar do detalhe é cuidar de quem vai vivê-lo.", pillar: "amar" },
  { text: "Coerência é a forma mais silenciosa de coragem.", pillar: "verdadeiro" },
  { text: "Proteja o outro, mesmo quando é mais difícil.", pillar: "amar" },
  { text: "Preservar os bastidores do Reino é honrar quem constrói junto.", pillar: "honrar" },
  { text: "Reconheça méritos com honestidade. A justiça começa na palavra.", pillar: "justo" },
  { text: "Servir com sorriso muda o dia de alguém — o seu inclusive.", pillar: "servir" },
  { text: "Zelar pelo nome Hector é escolha diária, não obrigação.", pillar: "honrar" },
  { text: "Comunique com clareza. Verdade sem cuidado vira violência.", pillar: "verdadeiro" },
  { text: "Sustentar o certo mesmo quando é impopular também é liderar.", pillar: "justo" },
  { text: "Cada gesto pequeno cria uma memória grande.", pillar: "servir" },
  { text: "Empatia é o primeiro ato mágico do dia.", pillar: "amar" },
  { text: "Não somos apenas uma marca. Somos um universo vivo.", pillar: "honrar" },
  { text: "Onde há verdade, a confiança vira base — não decoração.", pillar: "verdadeiro" },
];

// Retorna a frase do dia (rotação determinística por data local).
export function getDailyPhrase(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  // Dias desde 2020-01-01 — estável em qualquer fuso.
  const days = Math.floor(Date.UTC(y, m, d) / 86_400_000);
  return DAILY_PHRASES[days % DAILY_PHRASES.length];
}

export function getPillar(key: PillarKey): Pillar {
  return PILLARS.find((p) => p.key === key)!;
}
