// Regras puras da Celebração da Magia (aniversário de empresa), sem I/O,
// com teste em celebration-rules.test.ts.

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export type WeekSP = { days: string[]; today: string };

// Semana atual (segunda a domingo) no fuso America/Sao_Paulo, em YYYY-MM-DD.
export function weekRangeSP(now: Date): WeekSP {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(now);
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const dow = (base.getUTCDay() + 6) % 7; // 0 = segunda
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(base);
    x.setUTCDate(base.getUTCDate() - dow + i);
    days.push(x.toISOString().slice(0, 10));
  }
  return { days, today };
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// Se a admissão faz aniversário em algum dia da semana, devolve o dia e
// quantos anos de casa a pessoa completa (só 1 ano ou mais). Admissão em
// 29/02 comemora em 28/02 nos anos que não são bissextos.
export function companyAnniversaryThisWeek(admission: string | null | undefined, week: WeekSP) {
  if (!admission || !/^\d{4}-\d{2}-\d{2}/.test(admission)) return null;
  const [ay, am, ad] = admission.slice(0, 10).split("-").map(Number);
  for (const day of week.days) {
    const [y, m, d] = day.split("-").map(Number);
    const targetDay = am === 2 && ad === 29 && !isLeap(y) ? 28 : ad;
    if (m === am && d === targetDay) {
      const years = y - ay;
      if (years < 1) return null;
      return {
        date: day,
        years,
        anniversaryYear: y,
        weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
        isToday: day === week.today,
      };
    }
  }
  return null;
}
