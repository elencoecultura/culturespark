// Cálculo de janela de datas compartilhado pelos painéis de indicadores
// (checkins-dashboard, wellbeing-timeline). Servidor roda em UTC (Vercel) —
// se o "hoje"/início do período fosse calculado com Date.getFullYear/
// getMonth/getDate (hora local do processo, ou seja, UTC) e as chaves dos
// baldes formatadas em America/Sao_Paulo (3h atrás de UTC), o balde de
// "hoje" nunca batia com o dia real em São Paulo e boa parte do check-in do
// dia sumia do painel. Por isso tudo aqui roda em cima de chaves
// "YYYY-MM-DD" já no fuso de SP, nunca misturando com Date local do processo.

const tz = "America/Sao_Paulo";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

export const PERIODS = ["dia", "mes", "ano"] as const;
export type Period = (typeof PERIODS)[number];

export function todayKey(): string {
  return fmt.format(new Date());
}

export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function periodStartKey(period: Period, today: string): string {
  const [y, m] = today.split("-");
  if (period === "dia") return today;
  if (period === "mes") return `${y}-${m}-01`;
  return `${y}-01-01`;
}

export type DateRangeInput = { period?: Period; from?: string; to?: string };

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Um período pré-definido (dia/mês/ano, sempre terminando hoje) ou uma
// janela personalizada (de/até, qualquer intervalo no passado). Janelas com
// mais de 62 dias (ou o preset "ano") agrupam o gráfico por mês em vez de
// por dia, senão vira uma parede de barrinhas ilegível.
export function resolveDateBuckets(input: DateRangeInput) {
  const today = todayKey();
  let startKey: string;
  let endKey: string;

  if (input.from && input.to && DAY_KEY_RE.test(input.from) && DAY_KEY_RE.test(input.to)) {
    startKey = input.from <= input.to ? input.from : input.to;
    endKey = input.from <= input.to ? input.to : input.from;
    if (endKey > today) endKey = today; // não busca o futuro
  } else {
    startKey = periodStartKey(input.period ?? "mes", today);
    endKey = today;
  }

  const dayKeys: string[] = [];
  for (let k = startKey; k <= endKey; k = addDaysToKey(k, 1)) dayKeys.push(k);

  const groupByMonth = input.period === "ano" || dayKeys.length > 62;
  const bucketKeys = groupByMonth ? Array.from(new Set(dayKeys.map((k) => k.slice(0, 7)))) : dayKeys;
  const keyFor = (iso: string) => {
    const day = fmt.format(new Date(iso));
    return groupByMonth ? day.slice(0, 7) : day;
  };

  return {
    startKey,
    endKey,
    dayKeys,
    bucketKeys,
    groupByMonth,
    sinceIso: `${startKey}T00:00:00-03:00`,
    untilIso: `${addDaysToKey(endKey, 1)}T00:00:00-03:00`,
    keyFor,
  };
}
