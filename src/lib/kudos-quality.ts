// Qualidade do elogio: o elogio é ilimitado, então o que segura o "elogio só
// pra pontuar" é o conteúdo. Regras (todas locais, sem IA externa, pra não
// mandar mensagem do elenco pra fora):
//   1. mínimo de 6 palavras;
//   2. sem palavra/frase repetida em sequência ("parabéns parabéns...");
//   3. sem sequência aleatória de letras ou palavras soltas sem ligação;
//   4. precisa ter contexto: pelo menos 2 palavras que contem o QUE a pessoa
//      fez, além de elogio genérico ("bom trabalho", "você é demais");
//   5. não pode ser praticamente igual a um elogio que a MESMA pessoa já
//      mandou (trocar uma palavra ou dois emojis não engana a comparação).
// A comparação do item 5 é só com o histórico de quem envia: duas pessoas
// mandando elogios parecidos por atitudes parecidas não é manipulação.

export const KUDOS_MIN_WORDS = 6;
export const KUDOS_SIMILARITY_LIMIT = 0.75;

export const KUDOS_GENTLE_MESSAGE =
  "Que tal contar um pouquinho mais sobre esse momento? Queremos reconhecer atitudes que realmente fazem a diferença na nossa história!";

export type KudosRejectReason = "too_short" | "repeated_words" | "gibberish" | "no_context" | "duplicate";

export type KudosVerdict = { ok: true } | { ok: false; reason: KudosRejectReason; hint: string };

const HINTS: Record<KudosRejectReason, string> = {
  too_short: `Escreva pelo menos ${KUDOS_MIN_WORDS} palavras contando o que a pessoa fez.`,
  repeated_words: "Evite repetir as mesmas palavras. Conte o que aconteceu.",
  gibberish: "Parece que o texto ficou sem sentido. Conte com suas palavras o que a pessoa fez.",
  no_context: "Conte qual atitude ou momento você quer reconhecer (o que a pessoa fez, quando, com quem).",
  duplicate: "Esse elogio ficou muito parecido com um que você já mandou. Conte o que foi especial dessa vez.",
};

const reject = (reason: KudosRejectReason): KudosVerdict => ({ ok: false, reason, hint: HINTS[reason] });

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palavras normalizadas: minúsculas, sem acento, letras repetidas 3+ vezes viram 1 ("trabalhooo" → "trabalho"). */
export function tokenize(text: string): string[] {
  const words = stripAccents(text.toLowerCase()).match(/[a-z0-9ç]+/g) ?? [];
  return words.map((w) => w.replace(/(.)\1{2,}/g, "$1")).filter((w) => /[a-zç]/.test(w));
}

// Palavras de ligação: frase de verdade em português sempre tem algumas.
const FUNCTION_WORDS = new Set(
  (
    "a o as os um uma uns umas de da do das dos dum duma em no na nos nas num numa por pelo pela pelos pelas " +
    "para pra pro pras pros com sem sob sobre ate apos entre e ou mas que se como quando onde porque pois " +
    "ja nao sim tambem mais menos muito muita muitos muitas tao bem so ainda sempre nunca hoje ontem amanha " +
    "eu tu ele ela nos vos eles elas voce voces vc vcs me te lhe nos vos meu minha meus minhas teu tua teus " +
    "tuas seu sua seus suas nosso nossa nossos nossas dele dela deles delas isso isto aquilo esse essa esses " +
    "essas este esta estes estas aquele aquela todo toda todos todas cada qualquer outro outra outros outras " +
    "ao aos a la lo foi era e sao ser estar esta estao tem ter fez faz fazer " +
    "q pq tb tbm vai vou ta to tamo tmj ne"
  ).split(/\s+/),
);

// Vocabulário de elogio genérico: sozinho não conta o que aconteceu.
const GENERIC_WORDS = new Set(
  (
    "bom boa bons boas otimo otima otimos otimas excelente excelentes maravilhoso maravilhosa incrivel incriveis " +
    "top show demais legal massa fantastico fantastica sensacional espetacular perfeito perfeita lindo linda " +
    "querido querida amigo amiga amigos amigas mano brother parceiro parceira pessoa pessoas profissional " +
    "parabens obrigado obrigada obg valeu agradeco agradecer gratidao grato grata feliz felicidade sucesso " +
    "trabalho trabalhos trabalhar dia dias semana semanas mes ano inicio final tarde noite manha " +
    "deus abencoe abencoado abencoada ilumine luz paz amor carinho fe forca forcas coracao vida " +
    "tenha tenham continue continua seja sejam siga sendo ser fazendo faz fazer jeito sempre mesmo assim " +
    "especial especiais unico unica melhor melhores admiro admiracao orgulho exemplo inspiracao inspiradora inspirador " +
    "magia magico magica brilho brilhar brilhando ai ali aqui la ok kk kkk"
  ).split(/\s+/),
);

const VOWELS = /[aeiouy]/;
const KEYBOARD_RUNS = ["qwer", "wert", "erty", "rtyu", "tyui", "yuio", "uiop", "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "zxcv", "xcvb", "cvbn", "vbnm"];

function isGibberishToken(token: string): boolean {
  if (token.length > 25) return true;
  if (token.length >= 4 && !VOWELS.test(token)) return true;
  if (/[^aeiouy\s]{5,}/.test(token)) return true;
  if (KEYBOARD_RUNS.some((k) => token.includes(k))) return true;
  return false;
}

function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) out.push(`${tokens[i]} ${tokens[i + 1]}`);
  return out;
}

/** Regras que olham só o próprio texto (itens 1 a 4). */
export function assessKudosText(text: string, opts: { requireContext?: boolean } = {}): KudosVerdict {
  const tokens = tokenize(text);
  if (tokens.length < KUDOS_MIN_WORDS) return reject("too_short");

  // Lixo de teclado / letras soltas: "asdfgh kkkkk xptz..."
  const gibberish = tokens.filter(isGibberishToken).length;
  if (gibberish >= 2 && gibberish / tokens.length >= 0.25) return reject("gibberish");

  // Repetição: palavra que domina a frase, pouca variedade, ou frase repetida.
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [t, n] of counts) {
    if (!FUNCTION_WORDS.has(t) && n >= 3 && n / tokens.length >= 0.3) return reject("repeated_words");
  }
  if (tokens.length <= 30 && counts.size / tokens.length < 0.5) return reject("repeated_words");
  const bg = bigrams(tokens);
  if (bg.length >= 4) {
    const repeatedBigrams = bg.length - new Set(bg).size;
    if (repeatedBigrams / bg.length >= 0.34) return reject("repeated_words");
  }

  // Palavras soltas sem ligação nenhuma ("cadeira azul feliz rapido mesa sol").
  if (!tokens.some((t) => FUNCTION_WORDS.has(t))) return reject("gibberish");

  if (opts.requireContext ?? true) {
    const specific = new Set(
      tokens.filter((t) => t.length >= 3 && !FUNCTION_WORDS.has(t) && !GENERIC_WORDS.has(t) && !isGibberishToken(t)),
    );
    if (specific.size < 2) return reject("no_context");
  }
  return { ok: true };
}

function trigrams(text: string): Set<string> {
  const s = ` ${tokenize(text).join(" ")} `;
  const out = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
}

/**
 * Quão parecidos são dois textos (0 a 1), por trigramas de letras: pega
 * troca de uma palavra, emoji, pontuação e acento. Se um texto é quase todo
 * o outro (colou o mesmo elogio e acrescentou "valeu!"), também conta.
 */
export function kudosSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const g of ta) if (tb.has(g)) inter++;
  const dice = (2 * inter) / (ta.size + tb.size);
  const small = Math.min(ta.size, tb.size);
  const big = Math.max(ta.size, tb.size);
  const overlap = small / big >= 0.5 ? inter / small : 0;
  return Math.max(dice, overlap * 0.95);
}

/** Item 5: compara com elogios anteriores da mesma pessoa. */
export function findNearDuplicate(text: string, previous: string[], limit = KUDOS_SIMILARITY_LIMIT): string | null {
  for (const p of previous) if (kudosSimilarity(text, p) >= limit) return p;
  return null;
}

export function evaluateKudos(
  text: string,
  previous: string[],
  opts: { requireContext?: boolean; checkDuplicates?: boolean } = {},
): KudosVerdict {
  const own = assessKudosText(text, opts);
  if (!own.ok) return own;
  if ((opts.checkDuplicates ?? true) && findNearDuplicate(text, previous)) return reject("duplicate");
  return { ok: true };
}
