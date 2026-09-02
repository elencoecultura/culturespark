import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, HeartCrack, Loader2, ShieldAlert } from "lucide-react";
import { getMoodConcerns } from "@/lib/wellbeing.functions";
import { getWellbeingTimeline } from "@/lib/wellbeing-timeline.functions";
import { TrendCard } from "./WellbeingTimelineScreen";

const INDIVIDUAL_COLOR = "#3987e5";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

function IndividualTimeline({ userId }: { userId: string }) {
  const fn = useServerFn(getWellbeingTimeline);
  const q = useQuery({
    queryKey: ["wellbeing-timeline", "individual", userId],
    queryFn: () => fn({ data: { period: "mes", mode: "individual", user_id: userId } }),
  });
  if (q.isLoading) return <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-white/60" />;
  if (!q.data || q.data.series.every((s) => s.values.every((v) => v === null))) {
    return <div className="py-3 text-center text-[12px] text-white/50">Sem histórico de humor este mês.</div>;
  }
  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <TrendCard label="Humor no mês" color={INDIVIDUAL_COLOR} buckets={q.data.buckets} values={q.data.series[0]?.values ?? []} />
    </div>
  );
}

export default function WellbeingAdmin() {
  const fn = useServerFn(getMoodConcerns);
  const q = useQuery({ queryKey: ["mood-concerns"], queryFn: () => fn() });
  const [openId, setOpenId] = useState<string | null>(null);

  const concerning = (q.data?.rows ?? []).filter((r) => r.streak >= 2 || r.lowCount >= 3);
  const rest = (q.data?.rows ?? []).filter((r) => !(r.streak >= 2 || r.lowCount >= 3));

  return (
    <div className="space-y-4">
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2 text-white">
          <HeartCrack className="h-5 w-5" />
          <h2 className="text-[17px] font-bold">Cuidado com o elenco</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          Check-ins de energia dos últimos {q.data?.windowDays ?? 60} dias. Acesso restrito — dado
          sensível de bem-estar, não é sobre desempenho.
        </p>
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center py-10 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {q.isError && (
        <div className="glass-chip rounded-2xl p-4 text-[13px] text-magic-red">
          Não consegui carregar — {(q.error as Error)?.message ?? "acesso restrito."}
        </div>
      )}

      {q.data && concerning.length === 0 && (
        <div className="glass-chip rounded-2xl p-4 text-[13px] text-white/70">
          Ninguém com sinais de atenção agora — sem energia baixa repetida.
        </div>
      )}

      {concerning.length > 0 && (
        <div className="grid gap-2">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-magic-amber">
            Atenção
          </div>
          {concerning.map((r) => (
            <div
              key={r.user_id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(openId === r.user_id ? null : r.user_id)}
              onKeyDown={(e) => e.key === "Enter" && setOpenId(openId === r.user_id ? null : r.user_id)}
              className="w-full min-w-0 cursor-pointer text-left glass-chip rounded-2xl border border-magic-amber/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-magic-amber" />
                    {r.name}
                  </div>
                  {r.attraction && <div className="text-[11px] text-white/50">{r.attraction}</div>}
                  <div className="mt-1.5 text-[12px] text-white/75">
                    {r.streak >= 2
                      ? `Energia baixa nos últimos ${r.streak} check-ins seguidos`
                      : `${r.lowCount} check-ins de energia baixa em ${r.checkins}`}
                    {" · média "}
                    {r.avgMood}
                  </div>
                  {r.lastNote && (
                    <div className="mt-1.5 text-[12px] italic text-white/60">"{r.lastNote}"</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right text-[11px] text-white/50">
                  {r.lastAt && timeAgo(r.lastAt)}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openId === r.user_id ? "rotate-180" : ""}`} />
                </div>
              </div>
              {openId === r.user_id && <IndividualTimeline userId={r.user_id} />}
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid gap-2">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Sem sinais de atenção
          </div>
          {rest.map((r) => (
            <div
              key={r.user_id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(openId === r.user_id ? null : r.user_id)}
              onKeyDown={(e) => e.key === "Enter" && setOpenId(openId === r.user_id ? null : r.user_id)}
              className="w-full min-w-0 cursor-pointer text-left glass-chip rounded-2xl p-3 text-[12.5px] text-white/70"
            >
              <span className="font-semibold text-white">{r.name}</span> · média {r.avgMood} ·{" "}
              {r.checkins} check-in{r.checkins === 1 ? "" : "s"}
              {openId === r.user_id && <IndividualTimeline userId={r.user_id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
