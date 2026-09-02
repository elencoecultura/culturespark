import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LineChart, TrendingDown, TrendingUp, Minus, Search, X, ArrowLeft } from "lucide-react";
import { getWellbeingTimeline } from "@/lib/wellbeing-timeline.functions";
import { listAnalyticsMembers } from "@/lib/gamification-analytics.functions";
import { PeriodPicker, type PeriodValue } from "./PeriodPicker";

// Paleta categórica validada (slots do tema padrão, passo escuro — ver skill
// dataviz/references/palette.md), conferida contra o roxo/azul de fundo do
// app: contraste, separação de daltonismo e faixa de luminância OK.
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#e66767"];

function bucketLabel(key: string) {
  // "YYYY-MM-DD" -> "2/set" · "YYYY-MM" -> "set"
  const parts = key.split("-");
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  if (parts.length === 3) return `${Number(parts[2])}/${monthNames[Number(parts[1]) - 1]}`;
  return monthNames[Number(parts[1]) - 1];
}

// Catmull-Rom -> Bézier: linha curva suave em vez de segmentos retos, mesma
// quantidade de pontos, só muda a interpolação entre eles.
function smoothPath(points: Array<[number, number]>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function lastValue(values: (number | null)[]): { idx: number; value: number } | null {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return { idx: i, value: values[i]! };
  return null;
}

// Um cartão por série (casa/setor) em vez de várias linhas na mesma área —
// com 5+ séries de humor médio, as linhas convergem quase sempre (todas
// entre 3.5 e 5), então uma única área com todas juntas vira um emaranhado
// ilegível. Separado em cartões, cada um só precisa contar a própria
// história: sem legenda pra decorar, sem rótulos disputando espaço.
export function TrendCard({
  label,
  color,
  buckets,
  values,
}: {
  label: string;
  color: string;
  buckets: string[];
  values: (number | null)[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 300;
  const H = 84;
  const padY = 10;
  const minY = 1;
  const maxY = 5;
  const n = buckets.length;

  const xFor = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const yFor = (v: number) => H - padY - ((v - minY) / (maxY - minY)) * (H - padY * 2);

  const last = lastValue(values);
  const prevPoint = last ? lastValue(values.slice(0, last.idx)) : null;
  const delta = last && prevPoint ? Math.round((last.value - prevPoint.value) * 10) / 10 : 0;

  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push([xFor(i), yFor(v)]);
  });
  if (current.length) segments.push(current);

  const gradientId = `wb-fill-${label.replace(/\W/g, "")}`;
  const shown = active !== null ? values[active] : last?.value ?? null;
  const shownLabel = active !== null ? bucketLabel(buckets[active]) : "atual";

  return (
    <div className="glass-strong rounded-[22px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate text-[13px] font-semibold text-white">{label}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[26px] font-black tracking-[-0.02em] text-white">
              {shown !== null ? shown.toFixed(1) : "—"}
            </span>
            <span className="text-[11px] text-white/50">{shownLabel}</span>
          </div>
        </div>
        {delta !== 0 && (
          <div
            className={`flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-semibold ${
              delta > 0 ? "bg-magic-green/20 text-magic-green" : "bg-magic-red/20 text-magic-red"
            }`}
          >
            {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta).toFixed(1)}
          </div>
        )}
        {delta === 0 && prevPoint && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/60">
            <Minus size={12} />
          </div>
        )}
      </div>

      <div className="mt-2" style={{ height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {segments.map((seg, i) => (
            <path
              key={`fill-${i}`}
              d={seg.length > 1 ? `${smoothPath(seg)} L ${seg[seg.length - 1][0]},${H} L ${seg[0][0]},${H} Z` : ""}
              fill={`url(#${gradientId})`}
              stroke="none"
            />
          ))}
          {segments.map((seg, i) => (
            <path key={`line-${i}`} d={smoothPath(seg)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {values.map((v, i) =>
            v === null ? null : (
              <circle
                key={i}
                cx={xFor(i)}
                cy={yFor(v)}
                r={active === i ? 4.5 : i === last?.idx ? 3.5 : 0}
                fill={color}
                stroke="#1c1440"
                strokeWidth={1.5}
              />
            ),
          )}
          {buckets.map((_, i) => {
            const left = i === 0 ? 0 : (xFor(i - 1) + xFor(i)) / 2;
            const right = i === n - 1 ? W : (xFor(i) + xFor(i + 1)) / 2;
            return (
              <rect
                key={i}
                x={left}
                y={0}
                width={Math.max(0, right - left)}
                height={H}
                fill="transparent"
                onClick={() => setActive(active === i ? null : i)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

type Member = { id: string; name: string; attraction: string | null; negocio: string | null };

export default function WellbeingTimelineScreen() {
  const [periodValue, setPeriodValue] = useState<PeriodValue>({ kind: "preset", period: "mes" });
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<Member | null>(null);

  const fn = useServerFn(getWellbeingTimeline);
  const membersFn = useServerFn(listAnalyticsMembers);
  const membersQ = useQuery({ queryKey: ["wellbeing-members"], queryFn: () => membersFn() });

  const dateArgs = periodValue.kind === "preset" ? { period: periodValue.period } : { from: periodValue.from, to: periodValue.to };
  const q = useQuery({
    queryKey: ["wellbeing-timeline", dateArgs, person?.id ?? null],
    queryFn: () =>
      fn({
        data: person
          ? { ...dateArgs, mode: "individual" as const, user_id: person.id }
          : { ...dateArgs, mode: "department" as const },
      }),
  });

  const matches = useMemo(() => {
    const list = membersQ.data?.members ?? [];
    const q2 = query.trim().toLowerCase();
    if (!q2) return [];
    return list.filter((m) => m.name.toLowerCase().includes(q2)).slice(0, 8);
  }, [membersQ.data, query]);

  return (
    <div className="text-white">
      <div className="mb-3 px-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/60">
          <LineChart size={13} /> Bem-estar
        </div>
        <h2 className="mt-1 font-display text-[22px] font-black tracking-[-0.03em] text-white">Evolução do bem-estar</h2>
        <p className="mt-1 text-[12.5px] text-white/60">
          {person ? `Histórico de humor de ${person.name}.` : "Humor médio ao longo do tempo, área por área."} Toque num gráfico pra ver um dia específico.
        </p>
      </div>

      <div className="grid gap-2 px-1 mb-4">
        <PeriodPicker value={periodValue} onChange={setPeriodValue} />

        {person ? (
          <button
            type="button"
            onClick={() => setPerson(null)}
            className="glass-chip flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white/85"
          >
            <ArrowLeft size={13} /> Voltar pra visão por área
          </button>
        ) : (
          <div className="relative">
            <div className="glass-input flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
              <Search size={14} className="shrink-0 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por pessoa"
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="shrink-0 text-white/50">
                  <X size={14} />
                </button>
              )}
            </div>
            {matches.length > 0 && (
              <div className="glass-strong absolute inset-x-0 top-full z-10 mt-1.5 grid gap-0.5 rounded-2xl p-1.5">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPerson(m);
                      setQuery("");
                    }}
                    className="rounded-xl px-3 py-2 text-left text-[13px] text-white hover:bg-white/10"
                  >
                    {m.name}
                    <span className="ml-1.5 text-[11px] text-white/50">{m.attraction ?? m.negocio ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      )}

      {q.isError && (
        <div className="glass-chip rounded-2xl py-6 text-center text-[13px] text-white/60">
          {(q.error as Error)?.message === "Forbidden"
            ? "Você não tem acesso ao histórico individual dessa pessoa."
            : "Não consegui carregar."}
        </div>
      )}

      {q.data && q.data.series.length === 0 && (
        <div className="glass-chip rounded-2xl py-10 text-center text-[13px] text-white/60">
          Sem check-ins de humor nesse período ainda.
        </div>
      )}

      {q.data && q.data.series.length > 0 && (
        <div className="grid gap-3">
          {q.data.series.map((s, i) => (
            <TrendCard
              key={s.label}
              label={s.label}
              color={SERIES_COLORS[i % SERIES_COLORS.length]}
              buckets={q.data.buckets}
              values={s.values}
            />
          ))}
        </div>
      )}
    </div>
  );
}
