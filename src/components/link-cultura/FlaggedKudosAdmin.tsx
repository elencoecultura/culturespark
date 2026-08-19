import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Loader2, Check } from "lucide-react";
import { listFlaggedKudos, resolveFlaggedKudos } from "@/lib/engagement.functions";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

export default function FlaggedKudosAdmin() {
  const qc = useQueryClient();
  const fn = useServerFn(listFlaggedKudos);
  const resolveFn = useServerFn(resolveFlaggedKudos);
  const q = useQuery({ queryKey: ["flagged-kudos"], queryFn: () => fn() });

  const resolve = useMutation({
    mutationFn: (id: string) => resolveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Marcado como revisado");
      qc.invalidateQueries({ queryKey: ["flagged-kudos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2 text-white">
          <Flag className="h-5 w-5" />
          <h2 className="text-[17px] font-bold">Elogios sinalizados</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          O Elogio Rápido não é moderado automaticamente — mensagens com termos sensíveis só
          aparecem aqui pra revisão de gestão/RH. Nada é bloqueado ou apagado sozinho.
        </p>
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center py-10 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {q.data && q.data.length === 0 && (
        <div className="glass-chip rounded-2xl p-4 text-[13px] text-white/70">
          Nada sinalizado no momento.
        </div>
      )}

      <div className="grid gap-2">
        {(q.data ?? []).map((r) => (
          <div key={r.id} className="glass-chip rounded-2xl border border-magic-red/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12px] uppercase tracking-[0.14em] text-white/55">
                  de {r.from_name} → {r.to_name} · {timeAgo(r.created_at)}
                </div>
                <div className="mt-1.5 text-[14px] text-white">{r.message}</div>
                <div className="mt-1.5 text-[11px] text-magic-red/90">
                  Termo sinalizado: {r.flag_reason}
                </div>
              </div>
              <button
                type="button"
                onClick={() => resolve.mutate(r.id)}
                disabled={resolve.isPending}
                className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/85 hover:bg-white/20 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Revisado
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
