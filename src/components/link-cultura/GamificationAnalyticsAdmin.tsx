import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarRange,
  Loader2,
  Save,
  Download,
  Building2,
  ListFilter,
  Users,
  RefreshCw,
  UserSearch,
} from "lucide-react";
import { toast } from "sonner";
import {
  getGamificationAnalytics,
  listAnalyticsMembers,
  listCycleSnapshots,
  snapshotCurrentCycle,
} from "@/lib/gamification-analytics.functions";
import { getGamificationCycle } from "@/lib/settings.functions";
import { BUSINESSES } from "@/lib/businesses";


const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "direcao", label: "Direção" },
  { key: "gerente", label: "Gerente" },
  { key: "lider", label: "Líder" },
  { key: "elenco", label: "Elenco" },
];

const KINDS = [
  { key: "checkin", label: "Check-in de humor" },
  { key: "kudos_sent", label: "Toque enviado" },
  { key: "kudos_received", label: "Toque recebido" },
  { key: "journey_step", label: "Passo da jornada" },
  { key: "schedule_completed", label: "Semana cumprida" },
];

type GroupBy = "negocio" | "kind" | "role" | "user";
type Source = "live" | "snapshot";

export default function GamificationAnalyticsAdmin() {
  const qc = useQueryClient();
  const cycleFn = useServerFn(getGamificationCycle);
  const analyticsFn = useServerFn(getGamificationAnalytics);
  const listSnapsFn = useServerFn(listCycleSnapshots);
  const snapshotFn = useServerFn(snapshotCurrentCycle);
  const listMembersFn = useServerFn(listAnalyticsMembers);

  const cycleQ = useQuery({ queryKey: ["gamification-cycle"], queryFn: () => cycleFn() });
  const membersQ = useQuery({ queryKey: ["analytics-members"], queryFn: () => listMembersFn() });
  const isAdminOnly = !!membersQ.data?.scope?.isAdmin;
  const snapsQ = useQuery({
    queryKey: ["cycle-snapshots"],
    queryFn: () => listSnapsFn(),
    enabled: isAdminOnly,
  });

  const today = new Date().toISOString().slice(0, 10);

  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }, []);

  const [source, setSource] = useState<Source>("live");
  const [from, setFrom] = useState<string>(defaultFrom);
  const [to, setTo] = useState<string>(today);
  const [negocio, setNegocio] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [kind, setKind] = useState<string>("");
  const [memberId, setMemberId] = useState<string>("");
  const [memberQuery, setMemberQuery] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("negocio");
  const [view, setView] = useState<"summary" | "detail">("summary");

  const filters = {
    source,
    from: from ? new Date(from + "T00:00:00").toISOString() : undefined,
    to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
    negocio: negocio || undefined,
    role: role || undefined,
    kind: kind || undefined,
    userId: memberId || undefined,
    groupBy,
  };


  const dataQ = useQuery({
    queryKey: ["gamification-analytics", filters],
    queryFn: () => analyticsFn({ data: filters }),
  });

  const snap = useMutation({
    mutationFn: () => snapshotFn({ data: {} }),
    onSuccess: (r) => {
      toast.success("Ciclo fechado", { description: `${r.snapshotted} registros salvos.` });
      qc.invalidateQueries({ queryKey: ["cycle-snapshots"] });
      qc.invalidateQueries({ queryKey: ["gamification-analytics"] });
    },
    onError: (e: Error) => toast.error("Não consegui fechar o ciclo", { description: e.message }),
  });

  const applyCycle = (cs: string, ce: string) => {
    setSource("snapshot");
    setFrom(cs.slice(0, 10));
    setTo(ce.slice(0, 10));
  };

  const exportCsv = () => {
    if (!dataQ.data) return;
    const rows: string[] = [];
    if (view === "summary") {
      rows.push(["Grupo", "Pontos", "Pessoas", "Eventos"].join(","));
      dataQ.data.summary.forEach((r) =>
        rows.push([r.key, r.points, r.users, r.events].map(csv).join(",")),
      );
    } else {
      const kinds = Object.keys(dataQ.data.pointLabels);
      rows.push(
        ["Nome", "Negócio", "Setor", "Perfil", "Pontos", ...kinds.map((k) => dataQ.data!.pointLabels[k])]
          .map(csv)
          .join(","),
      );
      dataQ.data.detail.forEach((d) =>
        rows.push(
          [
            d.name,
            d.negocio,
            d.setor,
            d.role,
            d.points,
            ...kinds.map((k) => d.byKind[k] ?? 0),
          ]
            .map(csv)
            .join(","),
        ),
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gamificacao-${view}-${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const max = dataQ.data?.summary[0]?.points ?? 1;

  return (
    <div className="space-y-4">
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2 text-white">
          <BarChart3 className="h-5 w-5" />
          <h2 className="text-[17px] font-bold">Performance da gamificação</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          Consulte resultados do ciclo atual ou de ciclos passados (snapshots). Cruze por empresa,
          tipo de ação e perfil — em modo resumido ou analítico.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="glass-chip flex items-center gap-1 rounded-full p-1 text-[12px]">
            {(["live", "snapshot"] as Source[])
              .filter((s) => s === "live" || isAdminOnly)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`rounded-full px-3 py-1.5 ${source === s ? "bg-white text-blu" : "text-white/80"}`}
                >
                  {s === "live" ? "Ao vivo" : "Snapshots"}
                </button>
              ))}
          </div>
          {isAdminOnly && (
            <button
              type="button"
              onClick={() => snap.mutate()}
              disabled={snap.isPending}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-blu disabled:opacity-60"
            >
              {snap.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Fechar ciclo atual
            </button>
          )}
        </div>


        {cycleQ.data?.currentCycleStart && (
          <div className="mt-2 text-[11.5px] text-white/60">
            Ciclo atual:{" "}
            <strong className="text-white/80">
              {new Date(cycleQ.data.currentCycleStart).toLocaleDateString("pt-BR")} →{" "}
              {cycleQ.data.currentCycleEnd
                ? new Date(cycleQ.data.currentCycleEnd).toLocaleDateString("pt-BR")
                : "—"}
            </strong>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="glass-soft rounded-[28px] p-5 space-y-3">
        <div className="flex items-center gap-2 text-white">
          <ListFilter className="h-4 w-4" />
          <h3 className="text-[14px] font-semibold">Filtros</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="De" icon={<CalendarRange className="h-4 w-4 text-white/60" />}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-transparent text-[13px] text-white outline-none [color-scheme:dark]"
            />
          </Field>
          <Field label="Até" icon={<CalendarRange className="h-4 w-4 text-white/60" />}>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-transparent text-[13px] text-white outline-none [color-scheme:dark]"
            />
          </Field>
          <Field label="Empresa" icon={<Building2 className="h-4 w-4 text-white/60" />}>
            <select
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
              className="w-full bg-transparent text-[13px] text-white outline-none"
            >
              <option value="" className="bg-blu">Todas</option>
              {BUSINESSES.map((b) => (
                <option key={b} value={b} className="bg-blu">{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Perfil" icon={<Users className="h-4 w-4 text-white/60" />}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-transparent text-[13px] text-white outline-none"
            >
              <option value="" className="bg-blu">Todos</option>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key} className="bg-blu">{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Membro do elenco (NOME)" icon={<UserSearch className="h-4 w-4 text-white/60" />}>
            <input
              list="analytics-member-list"
              value={memberQuery}
              onChange={(e) => {
                const v = e.target.value;
                setMemberQuery(v);
                const match = (membersQ.data?.members ?? []).find(
                  (m) => m.name.toLowerCase() === v.trim().toLowerCase(),
                );
                setMemberId(match?.id ?? "");
              }}
              placeholder={membersQ.isLoading ? "Carregando…" : "Todos"}
              className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
            />
            <datalist id="analytics-member-list">
              {(membersQ.data?.members ?? []).map((m) => (
                <option key={m.id} value={m.name}>
                  {[m.attraction, m.negocio].filter(Boolean).join(" · ")}
                </option>
              ))}
            </datalist>
            {memberQuery && !memberId && (
              <span className="text-[10.5px] text-magic-amber">sem correspondência</span>
            )}
          </Field>
          <Field label="Tipo de ação" icon={<ListFilter className="h-4 w-4 text-white/60" />}>

            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full bg-transparent text-[13px] text-white outline-none"
            >
              <option value="" className="bg-blu">Todos</option>
              {KINDS.map((k) => (
                <option key={k.key} value={k.key} className="bg-blu">{k.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Agrupar por" icon={<BarChart3 className="h-4 w-4 text-white/60" />}>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="w-full bg-transparent text-[13px] text-white outline-none"
            >
              <option value="negocio" className="bg-blu">Empresa</option>
              <option value="kind" className="bg-blu">Tipo de ação</option>
              <option value="role" className="bg-blu">Perfil</option>
              <option value="user" className="bg-blu">Pessoa</option>
            </select>
          </Field>
        </div>

        {source === "snapshot" && (snapsQ.data?.length ?? 0) > 0 && (
          <div className="pt-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/55 mb-1.5">
              Ciclos salvos
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(snapsQ.data ?? []).map((s) => (
                <button
                  key={s.cycleStart + s.cycleEnd}
                  onClick={() => applyCycle(s.cycleStart, s.cycleEnd)}
                  className="glass-chip rounded-full px-2.5 py-1 text-[11.5px] text-white/85"
                >
                  {new Date(s.cycleStart).toLocaleDateString("pt-BR")} →{" "}
                  {new Date(s.cycleEnd).toLocaleDateString("pt-BR")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resultados */}
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2">
          <div className="glass-chip flex items-center gap-1 rounded-full p-1 text-[12px]">
            {(["summary", "detail"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1.5 ${view === v ? "bg-white text-blu" : "text-white/80"}`}
              >
                {v === "summary" ? "Resumido" : "Analítico"}
              </button>
            ))}
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["gamification-analytics"] })}
            className="ml-auto flex items-center gap-1 rounded-full glass-chip px-3 py-1.5 text-[12px] text-white/85"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button
            onClick={exportCsv}
            disabled={!dataQ.data}
            className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-blu disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {dataQ.isLoading && (
          <div className="mt-4 flex items-center gap-2 text-white/70 text-[12.5px]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}

        {dataQ.data && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Pontos" value={dataQ.data.totals.points.toLocaleString("pt-BR")} />
              <Stat label="Pessoas" value={dataQ.data.totals.users.toString()} />
              <Stat label="Eventos" value={dataQ.data.totals.events.toString()} />
            </div>

            {view === "summary" ? (
              <div className="mt-4 space-y-2">
                {dataQ.data.summary.length === 0 && (
                  <div className="text-[12.5px] text-white/60">Sem dados no período selecionado.</div>
                )}
                {dataQ.data.summary.map((r) => (
                  <div key={r.key} className="glass-chip rounded-2xl p-3">
                    <div className="flex items-center justify-between text-[13px] text-white">
                      <span className="font-medium">{r.key}</span>
                      <span className="font-mono">{r.points.toLocaleString("pt-BR")} pts</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-white/70"
                        style={{ width: `${Math.max(2, Math.round((r.points / max) * 100))}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-white/60">
                      <span>{r.users} pessoa{r.users === 1 ? "" : "s"}</span>
                      <span>{r.events} evento{r.events === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-[12.5px] text-white">
                  <thead className="text-white/60">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Nome</th>
                      <th className="py-2 pr-3">Empresa</th>
                      <th className="py-2 pr-3">Setor</th>
                      <th className="py-2 pr-3">Perfil</th>
                      <th className="py-2 pr-3 text-right">Pontos</th>
                      {Object.entries(dataQ.data.pointLabels).map(([k, l]) => (
                        <th key={k} className="py-2 pr-3 text-right">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {dataQ.data.detail.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-3 text-white/60">
                          Sem dados no período selecionado.
                        </td>
                      </tr>
                    )}
                    {dataQ.data.detail.map((d) => (
                      <tr key={d.userId}>
                        <td className="py-1.5 pr-3">{d.name}</td>
                        <td className="py-1.5 pr-3">{d.negocio}</td>
                        <td className="py-1.5 pr-3">{d.setor}</td>
                        <td className="py-1.5 pr-3">{d.role}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{d.points}</td>
                        {Object.keys(dataQ.data!.pointLabels).map((k) => (
                          <td key={k} className="py-1.5 pr-3 text-right font-mono text-white/70">
                            {d.byKind[k] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">{label}</span>
      <div className="glass-input mt-1.5 flex items-center gap-2 rounded-xl px-3 py-2.5">
        {icon}
        {children}
      </div>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-chip rounded-2xl p-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">{label}</div>
      <div className="mt-0.5 text-[18px] font-bold text-white">{value}</div>
    </div>
  );
}

function csv(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
