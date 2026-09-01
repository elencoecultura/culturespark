import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LineChart } from "lucide-react";
import { getWellbeingTimeline } from "@/lib/wellbeing-timeline.functions";

const PERIOD_LABEL: Record<"dia" | "mes" | "ano", string> = { dia: "Dia", mes: "Mês", ano: "Ano" };
const SERIES_COLORS = ["#ff6fb0", "#5ec8ff", "#ffd166", "#8b7bff", "#6fdc9a", "#ff9f6f", "#c084fc", "#4dd0e1"];

export function LineChartSvg({ buckets, series }: { buckets: string[]; series: Array<{ label: string; values: (number | null)[] }> }) {
  const W = 640;
  const H = 220;
  const padX = 8;
  const padY = 16;
  const minY = 1;
  const maxY = 5;
  const xFor = (i: number) => (buckets.length <= 1 ? W / 2 : padX + (i / (buckets.length - 1)) * (W - padX * 2));
  const yFor = (v: number) => H - padY - ((v - minY) / (maxY - minY)) * (H - padY * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <line key={v} x1={0} x2={W} y1={yFor(v)} y2={yFor(v)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      ))}
      {series.map((s, si) => {
        const color = SERIES_COLORS[si % SERIES_COLORS.length];
        const segments: string[] = [];
        let current: string[] = [];
        s.values.forEach((v, i) => {
          if (v === null) {
            if (current.length) segments.push(current.join(" "));
            current = [];
            return;
          }
          current.push(`${xFor(i)},${yFor(v)}`);
        });
        if (current.length) segments.push(current.join(" "));
        return (
          <g key={s.label}>
            {segments.map((pts, i) => (
              <polyline key={i} points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {s.values.map((v, i) =>
              v === null ? null : <circle key={i} cx={xFor(i)} cy={yFor(v)} r={2.5} fill={color} />,
            )}
          </g>
        );
      })}
    </svg>
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
          Humor médio ao longo do tempo, comparando as áreas sob sua visão.
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
