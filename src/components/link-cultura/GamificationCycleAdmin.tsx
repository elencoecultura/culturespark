import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, RotateCcw, Trophy, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { getGamificationCycle, setGamificationCycle } from "@/lib/settings.functions";

export default function GamificationCycleAdmin() {
  const qc = useQueryClient();
  const getFn = useServerFn(getGamificationCycle);
  const setFn = useServerFn(setGamificationCycle);

  const q = useQuery({ queryKey: ["gamification-cycle"], queryFn: () => getFn() });
  const [startDate, setStartDate] = useState("");
  const [cycleDays, setCycleDays] = useState(60);

  useEffect(() => {
    if (q.data) {
      setStartDate(q.data.startDate ?? "");
      setCycleDays(q.data.cycleDays ?? 60);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => setFn({ data: { startDate, cycleDays } }),
    onSuccess: () => {
      toast.success("Ciclo atualizado", {
        description: "A pontuação será zerada automaticamente no fim do ciclo.",
      });
      qc.invalidateQueries({ queryKey: ["gamification-cycle"] });
      qc.invalidateQueries({ queryKey: ["gamification"] });
    },
    onError: (e: Error) => toast.error("Não consegui salvar", { description: e.message }),
  });

  const cur = q.data;

  return (
    <div className="space-y-4">
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2 text-white">
          <Trophy className="h-5 w-5" />
          <h2 className="text-[17px] font-bold">Ciclo da gamificação</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          A pontuação do "Temporada" zera ao final de cada ciclo. Defina a data de início e quantos
          dias dura cada ciclo (padrão 60 dias). O XP total nunca é perdido.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">
              Data de início
            </span>
            <div className="glass-input mt-1.5 flex items-center gap-2 rounded-xl px-3 py-2.5">
              <CalendarClock className="h-4 w-4 text-white/60" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent text-[13.5px] text-white outline-none [color-scheme:dark]"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">
              Duração do ciclo (dias)
            </span>
            <div className="glass-input mt-1.5 flex items-center gap-2 rounded-xl px-3 py-2.5">
              <RotateCcw className="h-4 w-4 text-white/60" />
              <input
                type="number"
                min={1}
                max={365}
                value={cycleDays}
                onChange={(e) => setCycleDays(Number(e.target.value) || 60)}
                className="w-full bg-transparent text-[13.5px] text-white outline-none"
              />
            </div>
          </label>
        </div>

        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !startDate}
          className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-semibold text-blu disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar ciclo
        </button>
      </div>

      {cur && (
        <div className="glass-chip rounded-2xl p-4 text-[12.5px] text-white/80">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
            Ciclo atual
          </div>
          <div className="mt-1 text-white">
            Começou em{" "}
            <strong>
              {cur.currentCycleStart
                ? new Date(cur.currentCycleStart).toLocaleDateString("pt-BR")
                : "—"}
            </strong>{" "}
            · termina em{" "}
            <strong>
              {cur.currentCycleEnd
                ? new Date(cur.currentCycleEnd).toLocaleDateString("pt-BR")
                : "—"}
            </strong>
          </div>
          <div className="mt-1 text-white/70">
            {cur.daysLeft != null ? `${cur.daysLeft} dia${cur.daysLeft === 1 ? "" : "s"} para o reset.` : "Configure a data para começar."}
          </div>
        </div>
      )}
    </div>
  );
}
