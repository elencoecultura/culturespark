import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LineChart } from "lucide-react";
import { getWellbeingTimeline } from "@/lib/wellbeing-timeline.functions";

const PERIOD_LABEL: Record<"dia" | "mes" | "ano", string> = { dia: "Dia", mes: "Mês", ano: "Ano" };

// Paleta categórica validada (5 primeiros slots do tema padrão, passo escuro —
// ver skill dataviz/references/palette.md), conferida contra o roxo/azul de
// fundo do app: contraste, separação de daltonismo e faixa de luminância OK.
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#e66767"];
const SURFACE = "#241a4d";

function bucketLabel(key: string) {
  // "YYYY-MM-DD" -> "2/set" · "YYYY-MM" -> "set"
  const parts = key.split("-");
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  if (parts.length === 3) return `${Number(parts[2])}/${monthNames[Number(parts[1]) - 1]}`;
  return monthNames[Number(parts[1]) - 1];
}

function moodLabel(v: number) {
  if (v >= 4.5) return "ótima";
  if (v >= 3.5) return "boa";
  if (v >= 2.5) return "ok";
  if (v >= 1.5) return "baixa";
  return "muito baixa";
}

// Catmull-Rom -> Bézier, pra linha curva suave em vez de segmentos retos —
// mesma quantidade de pontos, só a interpolação entre eles muda.
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

export function LineChartSvg({ buckets, series }: { buckets: string[]; series: Array<{ label: string; values: (number | null)[] }> }) {
  const W = 640;
  const H = 260;
  const padL = 26;
  const padR = 10;
  const padT = 14;
  const padB = 26;
  const minY = 1;
  const maxY = 5;
  const n = buckets.length;
  const [active, setActive] = useState<number | null>(null);

  const xFor = (i: number) => (n <= 1 ? (W - padL - padR) / 2 + padL : padL + (i / (n - 1)) * (W - padL - padR));
  const yFor = (v: number) => H - padB - ((v - minY) / (maxY - minY)) * (H - padT - padB);

  // Rótulos do eixo X: no máximo ~7, pra não empilhar em cima do outro.
  const xTickEvery = Math.max(1, Math.ceil(n / 7));
  const xTicks = buckets.map((_, i) => i).filter((i) => i % xTickEvery === 0 || i === n - 1);

  const seriesWithColor = series.map((s, i) => ({ ...s, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

  // Rótulos do valor final de cada série — empilha do maior pro menor e
  // afasta verticalmente quem colidiria, em vez de sobrepor.
  const endLabels = useMemo(() => {
    const items = seriesWithColor
      .map((s) => {
        let lastIdx = -1;
        for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null) { lastIdx = i; break; }
        if (lastIdx === -1) return null;
        return { label: s.label, color: s.color, value: s.values[lastIdx]!, y: yFor(s.values[lastIdx]!) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.y - a.y);
    const minGap = 15;
    for (let i = 1; i < items.length; i++) {
      if (items[i].y > items[i - 1].y - minGap) items[i].y = items[i - 1].y - minGap;
    }
    return items;
  }, [series]);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
        <defs>
          {seriesWithColor.map((s) => (
            <linearGradient key={s.label} id={`wb-fill-${s.label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yFor(v)} y2={yFor(v)} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />
            <text x={padL - 6} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="rgba(255,255,255,0.45)">
              {v}
            </text>
          </g>
        ))}
        <text x={2} y={padT - 4} fontSize="8" fill="rgba(255,255,255,0.35)">alta</text>
        <text x={2} y={H - padB + 4} fontSize="8" fill="rgba(255,255,255,0.35)">baixa</text>

        {xTicks.map((i) => (
          <text key={i} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.45)">
            {bucketLabel(buckets[i])}
          </text>
        ))}

        {active !== null && (
          <line x1={xFor(active)} x2={xFor(active)} y1={padT} y2={H - padB} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="3,3" />
        )}

        {seriesWithColor.map((s) => {
          const pts: Array<[number, number]> = [];
          const segments: Array<Array<[number, number]>> = [];
          let current: Array<[number, number]> = [];
          s.values.forEach((v, i) => {
            if (v === null) {
              if (current.length) segments.push(current);
              current = [];
              return;
            }
            const p: [number, number] = [xFor(i), yFor(v)];
            pts.push(p);
            current.push(p);
          });
          if (current.length) segments.push(current);
          const fillId = `wb-fill-${s.label.replace(/\W/g, "")}`;
          return (
            <g key={s.label}>
              {segments.map((seg, i) =>
                seg.length > 1 ? (
                  <path
                    key={`fill-${i}`}
                    d={`${smoothPath(seg)} L ${seg[seg.length - 1][0]},${H - padB} L ${seg[0][0]},${H - padB} Z`}
                    fill={`url(#${fillId})`}
                    stroke="none"
                  />
                ) : null,
              )}
              {segments.map((seg, i) => (
                <path key={`line-${i}`} d={smoothPath(seg)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={xFor(i)}
                    cy={yFor(v)}
                    r={active === i ? 5 : 3}
                    fill={s.color}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                ),
              )}
            </g>
          );
        })}

        {/* alvos de toque invisíveis, uma faixa por balde — maior que o ponto em si */}
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

      {/* rótulos do valor final, fora do SVG pra não precisar medir texto em coordenadas SVG */}
      <div className="pointer-events-none absolute right-0 top-0" style={{ height: 220 }}>
        {endLabels.map((e) => (
          <div
            key={e.label}
            className="absolute right-1 flex -translate-y-1/2 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
            style={{ top: (e.y / H) * 220, backgroundColor: e.color }}
          >
            {e.value.toFixed(1)}
          </div>
        ))}
      </div>

      {active !== null && (
        <div className="mt-2 glass-chip rounded-2xl p-3">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/55">
            {bucketLabel(buckets[active])}
          </div>
          <div className="grid gap-1">
            {seriesWithColor.map((s) => {
              const v = s.values[active];
              return (
                <div key={s.label} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 text-white/80">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-semibold text-white">
                    {v === null ? "—" : `${v.toFixed(1)} · ${moodLabel(v)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WellbeingTimelineScreen() {
  const [period, setPeriod] = useState<"dia" | "mes" | "ano">("mes");
  const fn = useServerFn(getWellbeingTimeline);
  const q = useQuery({
    queryKey: ["wellbeing-timeline", period],
    queryFn: () => fn({ data: { period, mode: "department" } }),
  });

  return (
    <div className="text-white">
      <div className="mb-3 px-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/60">
          <LineChart size={13} /> Bem-estar
        </div>
        <h2 className="mt-1 font-display text-[22px] font-black tracking-[-0.03em] text-white">Evolução do bem-estar</h2>
        <p className="mt-1 text-[12.5px] text-white/60">
          Humor médio ao longo do tempo, comparando as áreas sob sua visão. Toque no gráfico pra ver os valores de um dia.
        </p>
      </div>

      <div className="flex gap-2 px-1 mb-4">
        {(["dia", "mes", "ano"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
              period === p ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/75"
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      )}

      {q.data && (
        <div className="glass-strong rounded-[26px] p-5">
          {q.data.series.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-white/60">Sem check-ins de humor nesse período ainda.</div>
          ) : (
            <>
              <LineChartSvg buckets={q.data.buckets} series={q.data.series} />
              {q.data.series.length >= 2 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {q.data.series.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-1.5 text-[11.5px] text-white/75">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                      />
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
