import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";
import { useBusiness } from "./BusinessContext";
import { listPreRegistrations } from "@/lib/pre-registration.functions";
import { BUSINESSES } from "@/lib/businesses";
import { useMemo } from "react";

/**
 * Seletor de negócio (Admin/Direção). Mostra "Todos" + lista fixa dos negócios
 * da Hector + qualquer negócio extra encontrado no pré-cadastro.
 */
export default function BusinessSelector() {
  const { business, setBusiness, canSelect } = useBusiness();
  const listFn = useServerFn(listPreRegistrations);
  const q = useQuery({
    queryKey: ["pre-regs"],
    queryFn: () => listFn(),
    enabled: canSelect,
    staleTime: 5 * 60_000,
  });
  const options = useMemo(() => {
    // Dedupe case-insensitively, preferindo o nome "bonito" do BUSINESSES.
    const map = new Map<string, string>();
    BUSINESSES.forEach((n) => map.set(n.toLowerCase(), n));
    (q.data ?? []).forEach((r) => {
      if (!r.negocio) return;
      const key = r.negocio.toLowerCase();
      if (!map.has(key)) map.set(key, r.negocio);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [q.data]);

  if (!canSelect) {
    if (!business) return null;
    return (
      <div className="glass-chip mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] text-white/80">
        <Building2 className="h-3.5 w-3.5" />
        {business}
      </div>
    );
  }

  return (
    <div className="glass-chip mb-3 flex items-center gap-2 rounded-2xl px-3 py-2">
      <Building2 className="h-4 w-4 text-white/70" />
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/55">Negócio</span>
      <select
        value={business}
        onChange={(e) => setBusiness(e.target.value)}
        className="ml-auto rounded-xl bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white focus:outline-none [&>option]:bg-blu"
      >
        <option value="">Todos</option>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
