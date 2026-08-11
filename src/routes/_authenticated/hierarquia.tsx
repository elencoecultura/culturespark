import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Search, UserCheck, UserX, Users, Save } from "lucide-react";
import LiquidBackground from "@/components/link-cultura/LiquidBackground";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  listCastWithHierarchy,
  listAssignableLeaders,
  updateProfileHierarchy,
  bulkAssignLeader,
} from "@/lib/hierarchy.functions";
import { BUSINESSES } from "@/lib/businesses";

export const Route = createFileRoute("/_authenticated/hierarquia")({
  head: () => ({
    meta: [
      { title: "Elenco & Hierarquia · Hector Studios" },
      {
        name: "description",
        content: "Cadastro visual da hierarquia: quem lidera quem, base para gerar as avaliações trimestrais.",
      },
    ],
  }),
  component: HierarchyPage,
});

function Glass({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        "rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)] " +
        className
      }
    >
      {children}
    </div>
  );
}

function HierarchyPage() {
  const { isAdmin, isLoading } = useCurrentUser();
  if (isLoading) return null;
  if (!isAdmin)
    return (
      <LiquidBackground>
        <div className="relative z-10 mx-auto max-w-lg px-4 py-20 text-white text-center">
          <p>Área restrita ao admin.</p>
          <Link to="/app" className="underline mt-4 inline-block">Voltar</Link>
        </div>
      </LiquidBackground>
    );
  return <HierarchyContent />;
}

function HierarchyContent() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCastWithHierarchy);
  const leadersFn = useServerFn(listAssignableLeaders);
  const updateFn = useServerFn(updateProfileHierarchy);
  const bulkFn = useServerFn(bulkAssignLeader);

  const cast = useQuery({ queryKey: ["hier-cast"], queryFn: () => listFn() });
  const leaders = useQuery({ queryKey: ["hier-leaders"], queryFn: () => leadersFn() });

  const [search, setSearch] = useState("");
  const [negocio, setNegocio] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLeader, setBulkLeader] = useState<string>("");
  const [bulkCoLeader, setBulkCoLeader] = useState<string>("");

  const filtered = useMemo(() => {
    const list = cast.data ?? [];
    return list.filter((p: any) => {
      if (!showInactive && !p.active) return false;
      if (negocio && p.negocio !== negocio) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (p.full_name ?? "").toLowerCase().includes(q) ||
          (p.role_title ?? "").toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cast.data, search, negocio, showInactive]);

  const update = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hier-cast"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: () =>
      bulkFn({
        data: {
          profile_ids: Array.from(selected),
          manager_id: bulkLeader || undefined,
          co_leader_id: bulkCoLeader || undefined,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`${r.updated} pessoas atualizadas`);
      setSelected(new Set());
      setBulkLeader("");
      setBulkCoLeader("");
      qc.invalidateQueries({ queryKey: ["hier-cast"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const allShownIds = filtered.map((p: any) => p.id);
  const allSelected =
    allShownIds.length > 0 && allShownIds.every((id: string) => selected.has(id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allShownIds));
  };

  return (
    <LiquidBackground>
      <div className="relative z-10 mx-auto max-w-[430px] px-4 py-6 space-y-5 text-white">
        <header className="flex items-center gap-3">
          <Link to="/app" className="rounded-full bg-white/10 border border-white/20 p-2 hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="h-6 w-6" /> Elenco & Hierarquia
            </h1>
            <p className="text-sm text-white/70">
              Defina quem é líder e co-líder de cada pessoa. Essa base é usada para gerar as avaliações trimestrais.
            </p>
          </div>
        </header>

        <Glass>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cargo, e-mail…"
                className="w-full rounded-lg bg-white/10 border border-white/20 pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <select
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
              className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm"
            >
              <option value="">Todos os negócios</option>
              {BUSINESSES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Mostrar inativos
            </label>
          </div>
        </Glass>

        {selected.size > 0 && (
          <Glass className="border-magic-green/40 bg-magic-green/10">
            <div className="text-sm font-semibold mb-2">
              Atribuição em lote — {selected.size} selecionada(s)
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <select
                value={bulkLeader}
                onChange={(e) => setBulkLeader(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm"
              >
                <option value="">Manter líder atual</option>
                {(leaders.data ?? []).map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} · {l.role_title ?? l.roles?.[0]}
                  </option>
                ))}
              </select>
              <select
                value={bulkCoLeader}
                onChange={(e) => setBulkCoLeader(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm"
              >
                <option value="">Manter co-líder atual</option>
                {(leaders.data ?? []).map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} · {l.role_title ?? l.roles?.[0]}
                  </option>
                ))}
              </select>
              <button
                disabled={bulk.isPending || (!bulkLeader && !bulkCoLeader)}
                onClick={() => bulk.mutate()}
                className="rounded-lg bg-white text-black font-medium px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="h-4 w-4" /> Aplicar
              </button>
            </div>
          </Glass>
        )}

        <Glass className="p-0 overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/40 backdrop-blur-md">
                <tr className="text-left text-xs uppercase tracking-wide text-white/60">
                  <th className="p-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="p-3">Pessoa</th>
                  <th className="p-3">Negócio</th>
                  <th className="p-3">Líder</th>
                  <th className="p-3">Co-líder</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr
                    key={p.id}
                    className={
                      "border-t border-white/10 hover:bg-white/5 " +
                      (!p.active ? "opacity-50" : "")
                    }
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSel(p.id)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{p.full_name}</div>
                      <div className="text-xs text-white/50">
                        {p.role_title ?? p.roles?.[0] ?? "elenco"} · {p.email}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {p.negocio ?? "—"}
                      {p.setor && <div className="text-white/50">{p.setor}</div>}
                    </td>
                    <td className="p-3">
                      <select
                        value={p.manager_id ?? ""}
                        onChange={(e) =>
                          update.mutate({
                            profile_id: p.id,
                            manager_id: e.target.value || null,
                          })
                        }
                        className="rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-xs w-full"
                      >
                        <option value="">— Sem líder —</option>
                        {(leaders.data ?? []).map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <select
                        value={p.co_leader_id ?? ""}
                        onChange={(e) =>
                          update.mutate({
                            profile_id: p.id,
                            co_leader_id: e.target.value || null,
                          })
                        }
                        className="rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-xs w-full"
                      >
                        <option value="">— Sem co-líder —</option>
                        {(leaders.data ?? []).map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          update.mutate({ profile_id: p.id, active: !p.active })
                        }
                        className={
                          "rounded-full px-3 py-1 text-xs flex items-center gap-1 border " +
                          (p.active
                            ? "bg-magic-green/20 border-magic-green/30"
                            : "bg-white/5 border-white/15")
                        }
                        title={p.active ? "Desativar" : "Reativar"}
                      >
                        {p.active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                        {p.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/60">
                      Nenhuma pessoa encontrada com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Glass>
      </div>
    </LiquidBackground>
  );
}
