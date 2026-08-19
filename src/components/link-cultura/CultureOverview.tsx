import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Gauge, Star, HeartCrack, Sparkles, Compass, Briefcase, MessageCircle } from "lucide-react";
import { getCultureOverview } from "@/lib/culture-overview.functions";

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const valueColor =
    tone === "good" ? "text-magic-green" : tone === "warn" ? "text-magic-amber" : tone === "bad" ? "text-magic-red" : "text-white";
  return (
    <div className="glass-chip rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
        <Icon size={13} /> {label}
      </div>
      <div className={`mt-1.5 font-display text-[24px] font-black ${valueColor}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/55">{sub}</div>}
    </div>
  );
}

export default function CultureOverview() {
  const fn = useServerFn(getCultureOverview);
  const { data, isLoading } = useQuery({ queryKey: ["culture-overview"], queryFn: () => fn() });

  return (
    <>
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <Gauge size={13} /> Painel geral
        </div>
        <h1 className="mt-1.5 font-display text-[24px] font-black tracking-[-0.03em] text-white">
          Indicadores de cultura
        </h1>
        <p className="text-[12.5px] text-white/65">
          Um resumo rápido do clima do elenco. Cada card leva pro detalhe na aba correspondente.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      ) : data ? (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Tile
            icon={Gauge}
            label="Avaliações"
            value={data.evalCompletion ? `${data.evalCompletion.pct}%` : "—"}
            sub={data.cycle ? `${data.cycle.name} · ${data.evalCompletion?.done ?? 0}/${data.evalCompletion?.total ?? 0}` : "sem ciclo aberto"}
            tone={data.evalCompletion && data.evalCompletion.pct >= 70 ? "good" : data.evalCompletion && data.evalCompletion.pct < 40 ? "bad" : "warn"}
          />
          <Tile
            icon={Sparkles}
            label="Espírito mágico"
            value={data.spiritsAvg != null ? `${data.spiritsAvg}/3` : "—"}
            sub="média do ciclo atual"
            tone={data.spiritsAvg != null ? (data.spiritsAvg >= 2.3 ? "good" : data.spiritsAvg < 1.7 ? "bad" : "warn") : "default"}
          />
          <Tile
            icon={Star}
            label="NPS"
            value={data.nps?.value != null ? String(data.nps.value) : "—"}
            sub={data.nps ? `${data.nps.total} respostas · ${data.nps.title}` : "sem pesquisa ainda"}
            tone={data.nps?.value != null ? (data.nps.value >= 50 ? "good" : data.nps.value < 0 ? "bad" : "warn") : "default"}
          />
          <Tile
            icon={HeartCrack}
            label="Alertas de energia"
            value={String(data.lowEnergyCount)}
            sub="últimos 30 dias"
            tone={data.lowEnergyCount === 0 ? "good" : data.lowEnergyCount > 3 ? "bad" : "warn"}
          />
          <Tile icon={MessageCircle} label="Elogios enviados" value={String(data.kudosCount)} sub="últimos 30 dias" />
          <Tile icon={Compass} label="Bússola feita" value={String(data.discCount)} sub="pessoas que já testaram" />
          <Tile icon={Briefcase} label="Vagas em aberto" value={String(data.openJobs)} sub="pendentes ou em recrutamento" />
        </div>
      ) : null}
    </>
  );
}
