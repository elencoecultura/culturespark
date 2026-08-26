import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Gauge, Smile, MessageCircle, HeartCrack, ChevronDown } from "lucide-react";
import { getCheckinsByHouse } from "@/lib/checkins-dashboard.functions";

type HouseRow = Awaited<ReturnType<typeof getCheckinsByHouse>>["rows"][number];

function toneFor(pct: number): "good" | "warn" | "bad" {
  if (pct >= 80) return "good";
  if (pct >= 50) return "warn";
  return "bad";
}

const TONE_TEXT: Record<string, string> = {
  good: "text-magic-green",
  warn: "text-magic-amber",
  bad: "text-magic-red",
};
const TONE_RING: Record<string, string> = {
  good: "stroke-magic-green",
  warn: "stroke-magic-amber",
  bad: "stroke-magic-red",
};
const TONE_BAR: Record<string, string> = {
  good: "bg-magic-green",
  warn: "bg-magic-amber",
  bad: "bg-magic-red",
};

function TodayRing({ pct }: { pct: number }) {
  const tone = toneFor(pct);
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
      <svg width={76} height={76} className="-rotate-90">
        <circle cx={38} cy={38} r={r} strokeWidth={7} className="stroke-white/12" fill="none" />
        <circle
          cx={38}
          cy={38}
          r={r}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={`${TONE_RING[tone]} transition-all duration-700`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-display text-[17px] font-black leading-none ${TONE_TEXT[tone]}`}>{pct}%</span>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string }) {
  return (
    <div className="glass-chip flex items-center gap-2 rounded-xl px-2.5 py-2">
      <Icon size={14} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[10px] uppercase tracking-[0.08em] text-white/50">{label}</div>
        <div className="text-[13px] font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

function Sparkline({ byDay, headcount, days }: { byDay: number[]; headcount: number; days: string[] }) {
  const max = Math.max(headcount, 1);
  return (
    <div className="mt-3 flex h-10 items-end gap-[3px]">
      {byDay.map((count, i) => {
        const pct = Math.max((count / max) * 100, count > 0 ? 8 : 3);
        const tone = toneFor(headcount ? (count / headcount) * 100 : 0);
        return (
          <div key={days[i]} className="group relative flex-1">
            <div
              className={`w-full rounded-[3px] transition-all ${count > 0 ? TONE_BAR[tone] : "bg-white/10"}`}
              style={{ height: `${pct}%`, opacity: count > 0 ? 0.85 : 1 }}
            />
          </div>
        );
      })}
    </div>
  );
}

function HouseCard({ row, days }: { row: HouseRow; days: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-strong rounded-[26px] p-4">
      <div className="flex items-center gap-3">
        <TodayRing pct={row.todayPct} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[15px] font-black text-white">{row.house}</h3>
            <span className="glass-chip shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white/70">
              {row.headcount} pessoas
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-white/60">
            {row.todayCount}/{row.headcount} fizeram check-in hoje · média de {row.avgPct}% nos últimos {days.length} dias
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <MiniStat icon={Smile} label="Humor médio" value={row.avgMood != null ? `${row.avgMood}/5` : "—"} />
        <MiniStat icon={HeartCrack} label="Alertas energia" value={String(row.lowEnergyAlerts)} />
        <MiniStat icon={MessageCircle} label="Elogios enviados" value={String(row.kudosSent)} />
        <MiniStat icon={MessageCircle} label="Elogios recebidos" value={String(row.kudosReceived)} />
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-[11.5px] font-semibold text-white/60 hover:text-white/85"
      >
        {open ? "Esconder histórico diário" : "Ver histórico diário"}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <Sparkline byDay={row.byDay} headcount={row.headcount} days={days} />}
    </div>
  );
}

export default function CheckinsDashboard() {
  const [days, setDays] = useState(14);
  const fn = useServerFn(getCheckinsByHouse);
  const q = useQuery({
    queryKey: ["checkins-by-house", days],
    queryFn: () => fn({ data: { days } }),
  });

  return (
    <div className="space-y-4">
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <Gauge size={13} /> Painel principal
        </div>
        <h1 className="mt-1.5 font-display text-[24px] font-black tracking-[-0.03em] text-white">Como estão as casas</h1>
        <p className="text-[12.5px] text-white/65">
          Check-in, humor, elogios e alertas — casa por casa. O anel mostra quem fez o check-in de hoje.
        </p>
      </div>

      <div className="flex gap-2 px-1">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
              days === d ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/75"
            }`}
          >
            {d} dias
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      )}

      {q.data && (
        <div className="grid gap-3">
          {q.data.rows.map((r) => (
            <HouseCard key={r.house} row={r} days={q.data.days} />
          ))}
        </div>
      )}
    </div>
  );
}
