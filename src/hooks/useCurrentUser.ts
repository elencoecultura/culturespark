import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/admin.functions";

export function useCurrentUser() {
  const fn = useServerFn(getMyContext);
  const q = useQuery({ queryKey: ["me"], queryFn: () => fn(), staleTime: 60_000 });
  const roles = q.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isDirecao = roles.includes("direcao");
  const isGerente = roles.includes("gerente");
  const isLider = roles.includes("lider") || roles.includes("leader");
  const isElenco = roles.includes("elenco") || roles.includes("messenger");
  return {
    ...q,
    profile: q.data?.profile ?? null,
    roles,
    isAdmin,
    isDirecao,
    isGerente,
    isLider,
    isElenco,
    // "Líder ou acima" — usado para painéis que líderes/gerentes/direção/admin enxergam
    isLeader: isLider || isGerente || isDirecao || isAdmin,
    // Pode escolher negócio livremente (filtro de Dashboard)
    canSelectBusiness: isAdmin || isDirecao,
  };
}
