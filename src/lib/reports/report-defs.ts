// Relatórios (somente Administrador). Definições compartilhadas entre a tela
// e o servidor.

export type ReportKey =
  | "elogios_recebidos"
  | "elogios_enviados"
  | "engajamento"
  | "aniversariantes"
  | "tempo_de_casa"
  | "enps"
  | "clima"
  | "avaliacoes_realizadas"
  | "avaliacoes_pendentes"
  | "ranking_lideres_avaliacoes"
  | "disc";

export const REPORTS: { key: ReportKey; group: string; label: string; individual: boolean }[] = [
  {
    key: "elogios_recebidos",
    group: "Reconhecimento",
    label: "Quem mais recebeu elogios",
    individual: true,
  },
  {
    key: "elogios_enviados",
    group: "Reconhecimento",
    label: "Quem mais elogia os outros",
    individual: true,
  },
  {
    key: "engajamento",
    group: "Engajamento",
    label: "Acessos ao app (e quem não acessou)",
    individual: true,
  },
  { key: "aniversariantes", group: "Aniversários", label: "Aniversariantes", individual: false },
  {
    key: "tempo_de_casa",
    group: "Aniversários",
    label: "Aniversário de empresa (tempo de casa)",
    individual: false,
  },
  { key: "enps", group: "e-NPS e Clima", label: "Resultados de e-NPS", individual: false },
  { key: "clima", group: "e-NPS e Clima", label: "Pesquisa de clima", individual: false },
  {
    key: "avaliacoes_realizadas",
    group: "Avaliações",
    label: "Avaliações realizadas",
    individual: true,
  },
  {
    key: "avaliacoes_pendentes",
    group: "Avaliações",
    label: "Avaliações pendentes",
    individual: false,
  },
  {
    key: "ranking_lideres_avaliacoes",
    group: "Avaliações",
    label: "Líderes que mais avaliaram",
    individual: false,
  },
  { key: "disc", group: "Bússola do Time", label: "Bússola do Time (DISC)", individual: false },
];

export type ReportFilters = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  empresa?: string | null; // profiles.attraction
  setor?: string | null;
  cargo?: string | null;
  lider?: string | null; // id do líder: pessoas que ele vê
  person?: string | null; // visão individual
};

export type ReportSection = {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  note?: string;
};

export type ReportResult = {
  key: ReportKey;
  title: string;
  group: string;
  filtersLabel: string[];
  sections: ReportSection[];
  notes: string[];
};

// Atalhos de período (fuso de São Paulo).
export function periodPreset(
  preset: "semana" | "mes" | "trimestre" | "ano",
  now = new Date(),
): { from: string; to: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  const today = new Date(Date.UTC(y, m - 1, d));
  if (preset === "semana") {
    const dow = (today.getUTCDay() + 6) % 7;
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - dow);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { from: iso(start), to: iso(end) };
  }
  if (preset === "mes")
    return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  if (preset === "trimestre") {
    // último trimestre fechado
    const q = Math.floor((m - 1) / 3);
    const start = new Date(Date.UTC(y, (q - 1) * 3, 1));
    const end = new Date(Date.UTC(y, q * 3, 0));
    return { from: iso(start), to: iso(end) };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
