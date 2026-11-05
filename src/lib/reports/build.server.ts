// Server-only: monta os relatórios (somente Administrador chama, via
// reports.functions.ts). Recebe o cliente service role por parâmetro para
// poder ser usado também pelo script que gera os exemplos.
import { fetchAllRows } from "@/lib/db-pagination";
import {
  REPORTS,
  type ReportFilters,
  type ReportKey,
  type ReportResult,
  type ReportSection,
} from "@/lib/reports/report-defs";

type SB = any;
type Person = {
  id: string;
  full_name: string;
  attraction: string | null;
  setor: string | null;
  role_title: string | null;
  manager_id: string | null;
  active: boolean;
  birth_date: string | null;
  admission_date: string | null;
};

const MIN_ANON = 3; // recortes com menos respondentes não são exibidos
const EMPRESA_LABEL: Record<string, string> = {
  "PIZZARIA ONYRA": "Ônyra",
  "ERA DO FOGO": "Era do Fogo",
  "FERROVIA SECRETA": "Ferrovia Secreta",
  TRUPE: "Trupe",
  "HECTOR STUDIOS": "Hector Studios",
  TODOS: "Diretoria",
};
const emp = (a: string | null) => (a ? (EMPRESA_LABEL[a] ?? a) : "—");
const br = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const round1 = (n: number) => Math.round(n * 10) / 10;
const startTs = (d: string) => `${d}T00:00:00-03:00`;
const endTs = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return `${x.toISOString().slice(0, 10)}T00:00:00-03:00`;
};
function daysIn(from: string, to: string): string[] {
  const out: string[] = [];
  const x = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let i = 0; x <= end && i < 800; i++) {
    out.push(x.toISOString().slice(0, 10));
    x.setUTCDate(x.getUTCDate() + 1);
  }
  return out;
}
function topN(counter: Map<string, number>, n: number, label: (k: string) => string) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${label(k)} (${v})`)
    .join(", ");
}

async function loadPeople(sb: SB): Promise<Person[]> {
  return fetchAllRows<Person>((a, b) =>
    sb
      .from("profiles")
      .select(
        "id, full_name, attraction, setor, role_title, manager_id, active, birth_date, admission_date",
      )
      .order("full_name")
      .range(a, b),
  );
}

async function population(sb: SB, people: Person[], f: ReportFilters): Promise<Person[]> {
  let pop = people.filter((p) => p.active && p.attraction !== "TODOS");
  if (f.empresa) pop = pop.filter((p) => p.attraction === f.empresa);
  if (f.setor) pop = pop.filter((p) => (p.setor ?? "") === f.setor);
  if (f.cargo) pop = pop.filter((p) => (p.role_title ?? "") === f.cargo);
  if (f.lider) {
    const { data } = await sb.rpc("visible_user_ids", { _viewer_id: f.lider });
    const vis = new Set(((data ?? []) as string[]).map(String));
    pop = pop.filter((p) => vis.has(p.id));
  }
  if (f.person) pop = pop.filter((p) => p.id === f.person);
  return pop;
}

function filtersLabel(f: ReportFilters, people: Person[]): string[] {
  const byId = new Map(people.map((p) => [p.id, p.full_name]));
  const out = [`Período: ${br(startTs(f.from))} a ${br(startTs(f.to))}`];
  out.push(`Empresa: ${f.empresa ? emp(f.empresa) : "todas"}`);
  if (f.setor) out.push(`Setor: ${f.setor}`);
  if (f.cargo) out.push(`Cargo: ${f.cargo}`);
  if (f.lider) out.push(`Líder: ${byId.get(f.lider) ?? f.lider}`);
  if (f.person) out.push(`Pessoa: ${byId.get(f.person) ?? f.person}`);
  return out;
}

// ---------------------------------------------------------------- relatórios

async function elogios(
  sb: SB,
  people: Person[],
  pop: Person[],
  f: ReportFilters,
  recebidos: boolean,
): Promise<ReportSection[]> {
  const ids = new Set(pop.map((p) => p.id));
  const name = new Map(people.map((p) => [p.id, p.full_name]));
  const rows = await fetchAllRows<any>((a, b) =>
    sb
      .from("kudos")
      .select("from_user, to_user, message, category, created_at")
      .gte("created_at", startTs(f.from))
      .lt("created_at", endTs(f.to))
      .order("created_at", { ascending: false })
      .range(a, b),
  );
  const key = recebidos ? "to_user" : "from_user";
  const other = recebidos ? "from_user" : "to_user";
  const mine = rows.filter((k) => ids.has(k[key]));
  const cat = (c: string | null) => (c === "aniversario" ? "Aniversário" : "Sem categoria");
  if (f.person) {
    return [
      {
        title: recebidos ? "Elogios recebidos" : "Elogios enviados",
        columns: ["Data", recebidos ? "De" : "Para", "Categoria", "Mensagem"],
        rows: mine.map((k) => [
          br(k.created_at),
          name.get(k[other]) ?? "—",
          cat(k.category),
          k.message,
        ]),
      },
    ];
  }
  const agg = new Map<string, { total: number; others: Map<string, number>; aniv: number }>();
  for (const k of mine) {
    const a = agg.get(k[key]) ?? { total: 0, others: new Map(), aniv: 0 };
    a.total++;
    a.others.set(k[other], (a.others.get(k[other]) ?? 0) + 1);
    if (k.category === "aniversario") a.aniv++;
    agg.set(k[key], a);
  }
  const byId = new Map(pop.map((p) => [p.id, p]));
  const ranked = [...agg.entries()].sort((a, b) => b[1].total - a[1].total);
  return [
    {
      title: recebidos ? "Ranking de elogios recebidos" : "Ranking de elogios enviados",
      columns: recebidos
        ? [
            "#",
            "Nome",
            "Empresa",
            "Setor",
            "Recebidos",
            "Remetentes diferentes",
            "Sem categoria",
            "Aniversário",
          ]
        : [
            "#",
            "Nome",
            "Empresa",
            "Setor",
            "Enviados",
            "Pessoas diferentes",
            "Para quem mais (top 3)",
          ],
      rows: ranked.map(([id, a], i) => {
        const p = byId.get(id)!;
        return recebidos
          ? [
              i + 1,
              p.full_name,
              emp(p.attraction),
              p.setor ?? "—",
              a.total,
              a.others.size,
              a.total - a.aniv,
              a.aniv,
            ]
          : [
              i + 1,
              p.full_name,
              emp(p.attraction),
              p.setor ?? "—",
              a.total,
              a.others.size,
              topN(a.others, 3, (x) => name.get(x) ?? "—"),
            ];
      }),
    },
  ];
}

async function engajamento(
  sb: SB,
  people: Person[],
  pop: Person[],
  f: ReportFilters,
): Promise<ReportSection[]> {
  const ids = new Set(pop.map((p) => p.id));
  const log = await fetchAllRows<any>((a, b) =>
    sb
      .from("app_access_log")
      .select("user_id, day, module, hits, last_at")
      .gte("day", f.from)
      .lte("day", f.to)
      .range(a, b),
  );
  const mine = log.filter((l) => ids.has(l.user_id));
  if (f.person) {
    return [
      {
        title: "Acessos por dia e módulo",
        columns: ["Dia", "Módulo", "Acessos", "Último acesso"],
        rows: mine
          .sort((a, b) => (a.day < b.day ? 1 : -1))
          .map((l) => [
            br(startTs(l.day)),
            l.module,
            l.hits,
            new Date(l.last_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          ]),
      },
    ];
  }
  const agg = new Map<
    string,
    { hits: number; days: Set<string>; last: string; mods: Map<string, number> }
  >();
  for (const l of mine) {
    const a = agg.get(l.user_id) ?? { hits: 0, days: new Set(), last: "", mods: new Map() };
    a.hits += l.hits;
    a.days.add(l.day);
    if (l.last_at > a.last) a.last = l.last_at;
    a.mods.set(l.module, (a.mods.get(l.module) ?? 0) + l.hits);
    agg.set(l.user_id, a);
  }
  const byId = new Map(pop.map((p) => [p.id, p]));
  const ranked = [...agg.entries()].sort((a, b) => b[1].hits - a[1].hits);
  const sem = pop.filter((p) => !agg.has(p.id));
  return [
    {
      title: "Quem mais acessou",
      columns: [
        "#",
        "Nome",
        "Empresa",
        "Setor",
        "Acessos",
        "Dias ativos",
        "Último acesso",
        "Módulos mais usados",
      ],
      rows: ranked.map(([id, a], i) => {
        const p = byId.get(id)!;
        return [
          i + 1,
          p.full_name,
          emp(p.attraction),
          p.setor ?? "—",
          a.hits,
          a.days.size,
          new Date(a.last).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          topN(a.mods, 3, (m) => m),
        ];
      }),
    },
    {
      title: `Não acessaram no período (${sem.length})`,
      columns: ["Nome", "Empresa", "Setor", "Cargo"],
      rows: sem.map((p) => [p.full_name, emp(p.attraction), p.setor ?? "—", p.role_title ?? "—"]),
    },
  ];
}

function aniversariantes(pop: Person[], f: ReportFilters): ReportSection[] {
  const mdSet = new Map(daysIn(f.from, f.to).map((d) => [d.slice(5), d]));
  const rows = pop
    .filter((p) => p.birth_date && mdSet.has(p.birth_date.slice(5, 10)))
    .map((p) => ({ p, day: mdSet.get(p.birth_date!.slice(5, 10))! }))
    .sort((a, b) => a.day.localeCompare(b.day));
  return [
    {
      title: `Aniversariantes (${rows.length})`,
      columns: ["Data", "Nome", "Empresa", "Setor", "Cargo"],
      rows: rows.map(({ p, day }) => [
        dm(day),
        p.full_name,
        emp(p.attraction),
        p.setor ?? "—",
        p.role_title ?? "—",
      ]),
    },
  ];
}

async function tempoDeCasa(sb: SB, pop: Person[], f: ReportFilters): Promise<ReportSection[]> {
  const days = daysIn(f.from, f.to);
  const hits: { p: Person; day: string; years: number }[] = [];
  for (const p of pop) {
    if (!p.admission_date) continue;
    const [ay, am, ad] = p.admission_date.split("-").map(Number);
    const day = days.find(
      (d) =>
        Number(d.slice(5, 7)) === am && Number(d.slice(8, 10)) === ad && Number(d.slice(0, 4)) > ay,
    );
    if (day) hits.push({ p, day, years: Number(day.slice(0, 4)) - ay });
  }
  hits.sort((a, b) => a.day.localeCompare(b.day));
  const { data: wishes } = hits.length
    ? await sb
        .from("company_anniversary_wishes")
        .select("to_user, anniversary_year")
        .in(
          "to_user",
          hits.map((h) => h.p.id),
        )
    : { data: [] };
  const wishCount = (id: string, year: number) =>
    (wishes ?? []).filter((w: any) => w.to_user === id && w.anniversary_year === year).length;
  const ref = new Date(`${f.to}T00:00:00Z`);
  const band = (adm: string) => {
    const y = (ref.getTime() - new Date(`${adm}T00:00:00Z`).getTime()) / (365.25 * 86400000);
    return y < 1
      ? "Menos de 1 ano"
      : y < 3
        ? "1 a 2 anos"
        : y < 6
          ? "3 a 5 anos"
          : "Mais de 5 anos";
  };
  const bands = ["Menos de 1 ano", "1 a 2 anos", "3 a 5 anos", "Mais de 5 anos"];
  const withAdm = pop.filter((p) => p.admission_date);
  return [
    {
      title: `Aniversários de empresa no período (${hits.length})`,
      columns: [
        "Data",
        "Nome",
        "Empresa",
        "Setor",
        "Cargo",
        "Admissão",
        "Completa",
        "Felicitações recebidas",
      ],
      rows: hits.map((h) => [
        dm(h.day),
        h.p.full_name,
        emp(h.p.attraction),
        h.p.setor ?? "—",
        h.p.role_title ?? "—",
        br(startTs(h.p.admission_date!)),
        `${h.years} ${h.years === 1 ? "ano" : "anos"}`,
        wishCount(h.p.id, Number(h.day.slice(0, 4))),
      ]),
    },
    {
      title: "Tempo de casa (na data final do período)",
      columns: ["Faixa", "Pessoas", "%"],
      rows: bands.map((b) => {
        const n = withAdm.filter((p) => band(p.admission_date!) === b).length;
        return [b, n, pct(n, withAdm.length)];
      }),
      note: `${pop.length - withAdm.length} pessoa(s) do recorte sem data de admissão no app (Trupe e Hector Studios ainda não têm esse dado).`,
    },
  ];
}

async function npsLike(
  sb: SB,
  pop: Person[],
  f: ReportFilters,
  kind: "nps" | "quiz",
): Promise<ReportSection[]> {
  const { data: surveys } = await sb
    .from("nps_surveys")
    .select("id, title, question, opens_at, closes_at, extra_questions, kind")
    .eq("kind", kind)
    .lte("opens_at", endTs(f.to))
    .gte("closes_at", startTs(f.from))
    .order("opens_at");
  const ids = new Set(pop.map((p) => p.id));
  const sections: ReportSection[] = [];
  const evo: (string | number | null)[][] = [];
  for (const s of surveys ?? []) {
    const resp = await fetchAllRows<any>((a, b) =>
      sb
        .from("nps_responses")
        .select("user_id, score, comment, extra_scores")
        .eq("survey_id", s.id)
        .range(a, b),
    );
    const mine = resp.filter((r) => ids.has(r.user_id));
    const n = mine.length;
    const taxa = pct(n, pop.length);
    if (n < MIN_ANON) {
      sections.push({
        title: `${s.title} (${br(s.opens_at)})`,
        columns: ["Resultado"],
        rows: [["Amostra insuficiente (menos de 3 respostas neste recorte)"]],
      });
      evo.push([s.title, br(s.opens_at), n, "amostra insuficiente", taxa]);
      continue;
    }
    if (kind === "nps") {
      const prom = mine.filter((r) => r.score >= 9).length;
      const det = mine.filter((r) => r.score <= 6).length;
      const neu = n - prom - det;
      const enps = Math.round(((prom - det) / n) * 100);
      sections.push({
        title: `${s.title} (${br(s.opens_at)} a ${br(s.closes_at)})`,
        columns: [
          "e-NPS",
          "Respostas",
          "Taxa de resposta",
          "Promotores (9-10)",
          "Neutros (7-8)",
          "Detratores (0-6)",
        ],
        rows: [
          [
            enps,
            n,
            taxa,
            `${prom} (${pct(prom, n)})`,
            `${neu} (${pct(neu, n)})`,
            `${det} (${pct(det, n)})`,
          ],
        ],
      });
      const comments = mine.map((r) => (r.comment ?? "").trim()).filter(Boolean);
      if (comments.length)
        sections.push({
          title: `Comentários (${comments.length}, anônimos)`,
          columns: ["Comentário"],
          rows: comments.map((c) => [c]),
        });
      evo.push([s.title, br(s.opens_at), n, enps, taxa]);
    } else {
      const questions = [
        { id: "_main", text: s.question },
        ...((s.extra_questions ?? []) as { id: string; text: string }[]),
      ];
      sections.push({
        title: `${s.title} (${br(s.opens_at)})`,
        columns: ["Pergunta", "Média (0-10)", "Respostas"],
        rows: questions.map((q) => {
          const vals = mine
            .map((r) => (q.id === "_main" ? r.score : r.extra_scores?.[q.id]))
            .filter((v) => typeof v === "number");
          return [
            q.text,
            vals.length >= MIN_ANON
              ? round1(vals.reduce((a, b) => a + b, 0) / vals.length)
              : "amostra insuficiente",
            vals.length,
          ];
        }),
        note: `Taxa de resposta: ${taxa}. O módulo de pesquisas ainda não tem "dimensão"; o resultado é por pergunta.`,
      });
      evo.push([s.title, br(s.opens_at), n, "—", taxa]);
    }
  }
  if (!(surveys ?? []).length)
    return [
      {
        title: "Sem pesquisas no período",
        columns: ["Resultado"],
        rows: [
          [
            kind === "nps"
              ? "Nenhuma pesquisa de e-NPS no período."
              : "Nenhuma pesquisa de clima (questionário) no período.",
          ],
        ],
      },
    ];
  return [
    {
      title: "Evolução entre pesquisas",
      columns: [
        "Pesquisa",
        "Abertura",
        "Respostas no recorte",
        kind === "nps" ? "e-NPS" : "—",
        "Taxa de resposta",
      ],
      rows: evo,
    },
    ...sections,
  ];
}

async function avaliacoes(
  sb: SB,
  people: Person[],
  pop: Person[],
  f: ReportFilters,
  mode: "realizadas" | "pendentes" | "ranking",
): Promise<ReportSection[]> {
  const byId = new Map(people.map((p) => [p.id, p]));
  const ids = new Set(pop.map((p) => p.id));
  const { data: cycles } = await sb
    .from("evaluation_cycles")
    .select("id, name, starts_on, ends_on, status");
  const cycleOk = new Map<string, any>(
    (cycles ?? [])
      .filter((c: any) => f.person || (c.starts_on <= f.to && c.ends_on >= f.from))
      .map((c: any) => [c.id, c]),
  );
  const evals = (
    await fetchAllRows<any>((a, b) =>
      sb
        .from("evaluations")
        .select("id, cycle_id, evaluatee_id, status, completed_at, published_at, overall_score")
        .range(a, b),
    )
  ).filter((e) => ids.has(e.evaluatee_id) && cycleOk.has(e.cycle_id));
  const evIds = evals.map((e) => e.id);
  const evaluators = evIds.length
    ? ((
        await sb
          .from("evaluation_evaluators")
          .select("evaluation_id, evaluator_id, role")
          .in("evaluation_id", evIds)
      ).data ?? [])
    : [];
  const scores = evIds.length
    ? await fetchAllRows<any>((a, b) =>
        sb
          .from("evaluation_scores")
          .select("evaluation_id, competency_id, score")
          .in("evaluation_id", evIds)
          .range(a, b),
      )
    : [];
  const { data: comps } = await sb
    .from("evaluation_competencies")
    .select("id, name, pillar_id, sort_order");
  const { data: pillars } = await sb
    .from("evaluation_pillars")
    .select("id, name, sort_order")
    .order("sort_order");
  const compById = new Map<string, any>((comps ?? []).map((c: any) => [c.id, c]));
  const done = (e: any) => e.status === "concluida" || !!e.published_at;
  const evName = (eid: string) =>
    evaluators
      .filter((x: any) => x.evaluation_id === eid)
      .map((x: any) => byId.get(x.evaluator_id)?.full_name ?? "—")
      .join(", ") || "—";
  const scoreOf = (eid: string) => scores.filter((s) => s.evaluation_id === eid);
  const finalOf = (e: any) => {
    const s = scoreOf(e.id);
    return (
      e.overall_score ??
      (s.length ? round1(s.reduce((a, b) => a + Number(b.score), 0) / s.length) : null)
    );
  };
  const pillarAvg = (eid: string, pid: string) => {
    const s = scoreOf(eid).filter((x) => compById.get(x.competency_id)?.pillar_id === pid);
    return s.length ? round1(s.reduce((a, b) => a + Number(b.score), 0) / s.length) : null;
  };

  if (mode === "realizadas") {
    const real = evals.filter(done);
    const pcols = (pillars ?? []).map((p: any) => p.name);
    const main: ReportSection = {
      title: f.person ? "Histórico de avaliações" : `Avaliações realizadas (${real.length})`,
      columns: [
        "Avaliado",
        "Empresa",
        "Setor",
        "Cargo",
        "Ciclo",
        "Avaliador(es)",
        "Data",
        ...pcols,
        "Nota final",
      ],
      rows: (f.person ? evals : real).map((e) => {
        const p = byId.get(e.evaluatee_id)!;
        return [
          p.full_name,
          emp(p.attraction),
          p.setor ?? "—",
          p.role_title ?? "—",
          cycleOk.get(e.cycle_id)?.name ?? "—",
          evName(e.id),
          br(e.completed_at ?? e.published_at),
          ...(pillars ?? []).map((pl: any) => pillarAvg(e.id, pl.id)),
          finalOf(e),
        ];
      }),
    };
    const criterios: ReportSection = {
      title: "Notas por critério",
      columns: ["Avaliado", "Ciclo", "Pilar", "Critério", "Nota"],
      rows: (f.person ? evals : real).flatMap((e) =>
        scoreOf(e.id)
          .map((s) => {
            const c: any = compById.get(s.competency_id);
            return [
              byId.get(e.evaluatee_id)?.full_name ?? "—",
              cycleOk.get(e.cycle_id)?.name ?? "—",
              (pillars ?? []).find((p: any) => p.id === c?.pillar_id)?.name ?? "—",
              c?.name ?? "—",
              Number(s.score),
            ];
          })
          .sort((a, b) => String(a[3]).localeCompare(String(b[3]))),
      ),
    };
    if (f.person) return [main, criterios];
    const groupAvg = (label: string, keyOf: (e: any) => string) => {
      const g = new Map<string, number[]>();
      for (const e of real) {
        const v = finalOf(e);
        if (v == null) continue;
        const k = keyOf(e);
        g.set(k, [...(g.get(k) ?? []), Number(v)]);
      }
      return {
        title: `Média por ${label}`,
        columns: [label[0].toUpperCase() + label.slice(1), "Avaliações", "Média"],
        rows: [...g.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => [k, v.length, round1(v.reduce((a, b) => a + b, 0) / v.length)]),
      } as ReportSection;
    };
    const leaderOf = (e: any) =>
      evaluators.find((x: any) => x.evaluation_id === e.id && x.role === "lider")?.evaluator_id;
    return [
      main,
      groupAvg("empresa", (e) => emp(byId.get(e.evaluatee_id)?.attraction ?? null)),
      groupAvg("setor", (e) => byId.get(e.evaluatee_id)?.setor ?? "—"),
      groupAvg("cargo", (e) => byId.get(e.evaluatee_id)?.role_title ?? "—"),
      groupAvg("líder", (e) => byId.get(leaderOf(e) ?? "")?.full_name ?? "—"),
      criterios,
    ];
  }

  const today = new Date().toISOString().slice(0, 10);
  if (mode === "pendentes") {
    const pend = evals.filter((e) => !done(e));
    return [
      {
        title: `Avaliações pendentes (${pend.length})`,
        columns: [
          "Avaliado",
          "Empresa",
          "Setor",
          "Líder responsável",
          "Ciclo",
          "Prazo",
          "Dias de atraso",
          "Situação",
        ],
        rows: pend
          .map((e) => {
            const p = byId.get(e.evaluatee_id)!;
            const c: any = cycleOk.get(e.cycle_id);
            const atraso =
              c && c.ends_on < today
                ? Math.round((Date.parse(today) - Date.parse(c.ends_on)) / 86400000)
                : 0;
            return [
              p.full_name,
              emp(p.attraction),
              p.setor ?? "—",
              evName(e.id),
              c?.name ?? "—",
              br(startTs(c?.ends_on)),
              atraso,
              e.status.replace(/_/g, " "),
            ];
          })
          .sort((a, b) => Number(b[6]) - Number(a[6])),
      },
    ];
  }

  // ranking de líderes
  const agg = new Map<string, { done: number; pend: number }>();
  for (const e of evals)
    for (const x of evaluators.filter((y: any) => y.evaluation_id === e.id)) {
      const a = agg.get(x.evaluator_id) ?? { done: 0, pend: 0 };
      done(e) ? a.done++ : a.pend++;
      agg.set(x.evaluator_id, a);
    }
  return [
    {
      title: "Líderes que mais avaliaram",
      columns: ["#", "Líder", "Empresa", "Realizadas", "Pendentes", "% de conclusão da equipe"],
      rows: [...agg.entries()]
        .sort((a, b) => b[1].done - a[1].done || a[1].pend - b[1].pend)
        .map(([id, a], i) => [
          i + 1,
          byId.get(id)?.full_name ?? "—",
          emp(byId.get(id)?.attraction ?? null),
          a.done,
          a.pend,
          pct(a.done, a.done + a.pend),
        ]),
    },
  ];
}

async function disc(sb: SB, pop: Person[]): Promise<ReportSection[]> {
  const tests = await fetchAllRows<any>((a, b) =>
    sb
      .from("behavioral_tests")
      .select("user_id, taken_at, score_d, score_i, score_s, score_c, primary_essence")
      .order("taken_at", { ascending: false })
      .range(a, b),
  );
  const latest = new Map<string, any>();
  for (const t of tests) if (!latest.has(t.user_id)) latest.set(t.user_id, t);
  const ESS: Record<string, string> = {
    D: "Dominância (D)",
    I: "Influência (I)",
    S: "Estabilidade (S)",
    C: "Conformidade (C)",
  };
  const group = (label: string, keyOf: (p: Person) => string): ReportSection => {
    const g = new Map<string, { n: number; sem: number; d: Record<string, number> }>();
    for (const p of pop) {
      const k = keyOf(p);
      const a = g.get(k) ?? { n: 0, sem: 0, d: { D: 0, I: 0, S: 0, C: 0 } };
      const t = latest.get(p.id);
      if (t) {
        a.n++;
        a.d[t.primary_essence] = (a.d[t.primary_essence] ?? 0) + 1;
      } else a.sem++;
      g.set(k, a);
    }
    return {
      title: `Perfil por ${label}`,
      columns: [
        label[0].toUpperCase() + label.slice(1),
        "Fizeram o teste",
        "D",
        "I",
        "S",
        "C",
        "Mais presente",
        "Ainda não fizeram",
      ],
      rows: [...g.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, a]) => {
          const top = Object.entries(a.d).sort((x, y) => y[1] - x[1])[0];
          return [
            k,
            a.n,
            pct(a.d.D, a.n),
            pct(a.d.I, a.n),
            pct(a.d.S, a.n),
            pct(a.d.C, a.n),
            a.n ? ESS[top[0]] : "—",
            a.sem,
          ];
        }),
    };
  };
  return [
    {
      title: "Resultado por pessoa",
      columns: [
        "Nome",
        "Empresa",
        "Setor",
        "Cargo",
        "Perfil predominante",
        "D",
        "I",
        "S",
        "C",
        "Data do teste",
      ],
      rows: pop
        .filter((p) => latest.has(p.id))
        .map((p) => {
          const t = latest.get(p.id);
          return [
            p.full_name,
            emp(p.attraction),
            p.setor ?? "—",
            p.role_title ?? "—",
            ESS[t.primary_essence] ?? t.primary_essence,
            t.score_d,
            t.score_i,
            t.score_s,
            t.score_c,
            br(t.taken_at),
          ];
        }),
    },
    group("cargo", (p) => p.role_title ?? "—"),
    group("empresa", (p) => emp(p.attraction)),
    group("setor", (p) => p.setor ?? "—"),
  ];
}

export async function buildReport(sb: SB, key: ReportKey, f: ReportFilters): Promise<ReportResult> {
  const def = REPORTS.find((r) => r.key === key)!;
  const people = await loadPeople(sb);
  const pop = await population(sb, people, f);
  const notes: string[] = [];
  let sections: ReportSection[];
  switch (key) {
    case "elogios_recebidos":
      sections = await elogios(sb, people, pop, f, true);
      notes.push(
        "Os elogios do app não têm o valor do Espírito Mágico marcado: a divisão usa a categoria gravada (aniversário ou sem categoria).",
      );
      break;
    case "elogios_enviados":
      sections = await elogios(sb, people, pop, f, false);
      break;
    case "engajamento":
      sections = await engajamento(sb, people, pop, f);
      notes.push(
        "Os acessos são registrados a partir de 05/11/2026 (um registro por pessoa, dia e módulo).",
      );
      break;
    case "aniversariantes":
      sections = aniversariantes(pop, f);
      break;
    case "tempo_de_casa":
      sections = await tempoDeCasa(sb, pop, f);
      break;
    case "enps":
      sections = await npsLike(sb, pop, f, "nps");
      notes.push(
        "Anônimo: nenhuma resposta é identificada e recortes com menos de 3 respondentes aparecem como amostra insuficiente.",
      );
      break;
    case "clima":
      sections = await npsLike(sb, pop, f, "quiz");
      notes.push(
        "Anônimo: nenhuma resposta é identificada e recortes com menos de 3 respondentes aparecem como amostra insuficiente.",
      );
      break;
    case "avaliacoes_realizadas":
      sections = await avaliacoes(sb, people, pop, f, "realizadas");
      break;
    case "avaliacoes_pendentes":
      sections = await avaliacoes(sb, people, pop, f, "pendentes");
      break;
    case "ranking_lideres_avaliacoes":
      sections = await avaliacoes(sb, people, pop, f, "ranking");
      break;
    case "disc":
      sections = await disc(sb, pop);
      break;
  }
  return {
    key,
    title: def.label,
    group: def.group,
    filtersLabel: filtersLabel(f, people),
    sections,
    notes,
  };
}
