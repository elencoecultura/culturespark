import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { listAllKudos, deleteKudos } from "@/lib/engagement.functions";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

export default function KudosAuditAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fn = useServerFn(listAllKudos);
  const q = useQuery({
    queryKey: ["all-kudos", search],
    queryFn: () => fn({ data: { search: search || undefined, limit: 200 } }),
  });

  const delFn = useServerFn(deleteKudos);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Elogio removido");
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["all-kudos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2 text-white">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="text-[17px] font-bold">Revisar elogios</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          Lista todos os elogios enviados no app — não só os sinalizados por palavra. Use pra
          investigar relatos de bullying/assédio, que raramente batem com filtro de termo.
          Buscar por nome (de quem manda ou recebe) ou por trecho da mensagem.
        </p>
      </div>

      <div className="glass-chip flex items-center gap-2 rounded-2xl px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-white/50" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou palavra na mensagem..."
          className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
        />
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center py-10 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {q.data && q.data.length === 0 && (
        <div className="glass-chip rounded-2xl p-4 text-[13px] text-white/70">
          {search ? "Nada encontrado com esse termo." : "Nenhum elogio enviado ainda."}
        </div>
      )}

      <div className="grid gap-2">
        {(q.data ?? []).map((r) => (
          <div key={r.id} className="glass-chip rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12px] uppercase tracking-[0.14em] text-white/55">
                  de {r.from_name} → {r.to_name} · {timeAgo(r.created_at)}
                  {r.flagged && (
                    <span className="ml-2 rounded-full bg-magic-red/20 px-2 py-0.5 text-magic-red/90">
                      sinalizado
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[14px] text-white">{r.message}</div>
              </div>

              {confirmId === r.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => del.mutate(r.id)}
                    disabled={del.isPending}
                    className="rounded-full bg-magic-red/80 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-magic-red disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/85 hover:bg-white/20"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(r.id)}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/85 hover:bg-white/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
