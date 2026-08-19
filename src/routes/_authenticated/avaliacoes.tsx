import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import LiquidBackground from "@/components/link-cultura/LiquidBackground";
import BottomSheetModal from "@/components/link-cultura/BottomSheetModal";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  listPillarsAndCompetencies,
  listCycles,
  createCycle,
  openCycleAndGenerate,
  listMyEvaluations,
  listTeamEvaluations,
  getEvaluationDetail,
  saveScore,
  savePdi,
  updateEvaluationStatus,
  saveEvaluationSpirits,
  getEvaluationDashboard,
  listEvaluationDocuments,
  attachEvaluationDocument,
  getMyMagicJourney,
  notifyPendingEvaluators,
  createTestEvaluation,
  listEvaluableMembers,
  createEvaluationForMember,
} from "@/lib/evaluations.functions";
import { generateEvaluationPdf } from "@/lib/evaluations-pdf.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Plus,
  Play,
  ChevronRight,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  FileText,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Users,
  Upload,
  Bell,
  Wand2,
  Target,
  Search,
  Loader2,
  HelpCircle,
  ClipboardCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/avaliacoes")({
  head: () => ({
    meta: [
      { title: "Avaliações · Hector Studios" },
      { name: "description", content: "Ciclos de avaliação de desempenho, PDIs e evolução do elenco." },
    ],
  }),
  component: EvaluationsPage,
});

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

const STATUS_LABEL: Record<string, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  pendente_lancamento: "Pendente de lançamento",
  pendente_documento: "Pendente de documento",
  concluida: "Concluída",
};

// Cor semântica do status (usa tokens de marca)
const STATUS_TONE: Record<string, string> = {
  nao_iniciada: "text-white/55 bg-white/10",
  em_andamento: "text-celeste bg-celeste/15",
  pendente_lancamento: "text-magic-amber bg-magic-amber/15",
  pendente_documento: "text-magic-amber bg-magic-amber/15",
  concluida: "text-magic-green bg-magic-green/15",
};

// Fluxo do avaliador, em ordem
const STATUS_STEPS = [
  { id: "em_andamento", label: "Avaliando" },
  { id: "pendente_lancamento", label: "Lançamento" },
  { id: "pendente_documento", label: "Documento" },
  { id: "concluida", label: "Concluída" },
] as const;

const SCALE: { score: number; label: string; description: string }[] = [
  { score: 1, label: "A magia não acontece", description: "A competência não está presente no comportamento observado." },
  { score: 2, label: "A magia acontece raramente", description: "A competência aparece de forma inconsistente e necessita desenvolvimento." },
  { score: 3, label: "A magia acontece algumas vezes", description: "A competência está presente em momentos importantes, mas ainda oscila." },
  { score: 4, label: "A magia acontece na maior parte do tempo", description: "A competência é percebida com consistência e contribui positivamente para a experiência." },
  { score: 5, label: "A magia acontece de forma extraordinária", description: "A competência está sempre presente e inspira outras pessoas através do exemplo." },
];

const CYCLE_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aberto: "Aberto",
  em_andamento: "Em andamento",
  encerrado: "Encerrado",
};

// Acento visual por pilar (casa com Segurança → Alegria → Imersão → Eficiência)
function pillarAccent(name: string) {
  const n = (name ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (n.includes("seguranca")) return { grad: "from-celeste to-blu", text: "text-celeste", dot: "bg-celeste" };
  if (n.includes("alegria")) return { grad: "from-magic-amber to-pink", text: "text-magic-amber", dot: "bg-magic-amber" };
  if (n.includes("imersao")) return { grad: "from-pink to-[#8a68ff]", text: "text-pink", dot: "bg-pink" };
  if (n.includes("eficiencia")) return { grad: "from-magic-green to-celeste", text: "text-magic-green", dot: "bg-magic-green" };
  return { grad: "from-celeste via-pink to-blu", text: "text-white", dot: "bg-white" };
}

/* ------------------------------------------------------------------ */
/*  Primitivos (alinhados ao design system Hector)                     */
/* ------------------------------------------------------------------ */

const BTN_PRIMARY =
  "flex items-center justify-center gap-2 rounded-2xl bg-brand-grad px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50";
const BTN_CHIP =
  "inline-flex items-center gap-1.5 glass-chip rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50";
const FIELD =
  "glass-input w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/40";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("glass-soft rounded-[26px] p-5 text-white", className)}>{children}</div>;
}

function SectionHeader({ icon: Icon, title, action }: { icon?: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-display text-[17px] font-black tracking-[-0.02em]">
        {Icon && <Icon className="h-5 w-5 text-white/80" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", STATUS_TONE[status] ?? "bg-white/10 text-white/60")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="glass-chip rounded-2xl px-4 py-3 text-[13px] text-white/70">{children}</p>;
}

function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-celeste via-white to-pink transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

type Tab = "avaliar" | "evolucao" | "indicadores" | "ciclos";

function EvaluationsPage() {
  const { isAdmin, isLeader, profile } = useCurrentUser();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) setOpenId(id);
    };
    window.addEventListener("open-evaluation", h);
    return () => window.removeEventListener("open-evaluation", h);
  }, []);

  const canManage = isAdmin || isLeader;
  const tabs = useMemo(() => {
    const t: { id: Tab; label: string; icon: LucideIcon }[] = [];
    if (canManage) t.push({ id: "avaliar", label: "Avaliar", icon: ClipboardCheck });
    t.push({ id: "evolucao", label: "Minha evolução", icon: Star });
    if (canManage) t.push({ id: "indicadores", label: "Indicadores", icon: BarChart3 });
    if (isAdmin) t.push({ id: "ciclos", label: "Ciclos", icon: Sparkles });
    return t;
  }, [canManage, isAdmin]);

  const activeTab: Tab = tab ?? (canManage ? "avaliar" : "evolucao");

  if (openId) return <EvaluationDetail id={openId} onBack={() => setOpenId(null)} />;

  return (
    <LiquidBackground>
      <div className="relative z-10 mx-auto max-w-[430px] space-y-5 px-4 py-6 text-white">
        <header className="flex items-center gap-3">
          <Link to="/app" className="glass-chip grid h-10 w-10 place-items-center rounded-2xl transition active:scale-95" aria-label="Voltar ao app">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">Por trás da Magia</div>
            <h1 className="font-display text-[24px] font-black tracking-[-0.03em]">Avaliação de Desempenho</h1>
            <p className="text-[12.5px] text-white/65">
              Olá {profile?.full_name?.split(" ")[0] ?? "elenco"} — sua jornada de evolução mágica.
            </p>
          </div>
        </header>

        {/* Abas */}
        <div className="glass-soft grid gap-1 rounded-full p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
          {tabs.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-semibold transition",
                  active ? "bg-white text-blu shadow-glow" : "text-white/65 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "avaliar" && canManage && <TeamSection onOpen={setOpenId} />}
        {activeTab === "evolucao" && (
          <>
            <MyMagicSection />
            <MySection onOpen={setOpenId} />
          </>
        )}
        {activeTab === "indicadores" && canManage && <IndicatorsSection />}
        {activeTab === "ciclos" && isAdmin && <AdminCycles />}
      </div>
    </LiquidBackground>
  );
}

/* ------------------------------------------------------------------ */
/*  Ciclos (admin)                                                     */
/* ------------------------------------------------------------------ */

function AdminCycles() {
  const qc = useQueryClient();
  const list = useServerFn(listCycles);
  const create = useServerFn(createCycle);
  const open = useServerFn(openCycleAndGenerate);
  const q = useQuery({ queryKey: ["eval-cycles"], queryFn: () => list() });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, starts_on: start, ends_on: end, status: "rascunho" } }),
    onSuccess: () => {
      toast.success("Ciclo criado");
      setShowForm(false);
      setName("");
      setStart("");
      setEnd("");
      qc.invalidateQueries({ queryKey: ["eval-cycles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openMut = useMutation({
    mutationFn: (id: string) => open({ data: { cycle_id: id } }),
    onSuccess: (r: any) => {
      toast.success(`Ciclo aberto — ${r.generated} avaliações geradas`);
      qc.invalidateQueries({ queryKey: ["eval-cycles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testFn = useServerFn(createTestEvaluation);
  const testMut = useMutation({
    mutationFn: () => testFn({ data: {} }),
    onSuccess: (r: any) => {
      toast.success("Avaliação de teste pronta", { description: "Abrindo…" });
      qc.invalidateQueries({ queryKey: ["my-evals"] });
      qc.invalidateQueries({ queryKey: ["team-evals"] });
      window.dispatchEvent(new CustomEvent("open-evaluation", { detail: { id: r.id } }));
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <SectionHeader
        icon={Sparkles}
        title="Ciclos"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => testMut.mutate()} disabled={testMut.isPending} className={BTN_CHIP} title="Cria uma avaliação de teste para você (só admin)">
              <Wand2 className="h-3.5 w-3.5" /> Teste
            </button>
            <button onClick={() => setShowForm((v) => !v)} className={BTN_CHIP}>
              <Plus className="h-4 w-4" /> Novo
            </button>
          </div>
        }
      />

      {showForm && (
        <div className="mb-4 grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              className={FIELD}
              onChange={(e) => {
                const [y, q] = e.target.value.split("-");
                if (!y || !q) return;
                const year = Number(y);
                const qi = Number(q.replace("Q", ""));
                const startMonth = (qi - 1) * 3;
                const s = new Date(year, startMonth, 1);
                const en = new Date(year, startMonth + 3, 0);
                const iso = (d: Date) => d.toISOString().slice(0, 10);
                setName(`${year}-Q${qi}`);
                setStart(iso(s));
                setEnd(iso(en));
              }}
              defaultValue=""
            >
              <option value="" className="text-blu">Escolher trimestre…</option>
              {(() => {
                const now = new Date();
                const y = now.getFullYear();
                const opts: string[] = [];
                for (let dy = -1; dy <= 1; dy++) {
                  for (let q = 1; q <= 4; q++) opts.push(`${y + dy}-Q${q}`);
                }
                return opts.map((o) => (
                  <option key={o} value={o} className="text-blu">{o}</option>
                ));
              })()}
            </select>
            <input className={FIELD} placeholder="Nome do ciclo" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={FIELD} value={start} onChange={(e) => setStart(e.target.value)} />
            <input type="date" className={FIELD} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <button disabled={!name || !start || !end || createMut.isPending} onClick={() => createMut.mutate()} className={BTN_PRIMARY}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar ciclo"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {(q.data ?? []).map((c: any) => (
          <div key={c.id} className="glass-chip flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <div className="font-display text-[15px] font-black tracking-[-0.02em]">{c.name}</div>
              <div className="text-[11.5px] text-white/60">
                {c.starts_on} → {c.ends_on} · {CYCLE_LABEL[c.status] ?? c.status}
              </div>
            </div>
            {(c.status === "rascunho" || c.status === "aberto") && (
              <button onClick={() => openMut.mutate(c.id)} disabled={openMut.isPending} className={BTN_CHIP}>
                <Play className="h-3 w-3" /> Abrir & gerar
              </button>
            )}
          </div>
        ))}
        {q.data && q.data.length === 0 && <Empty>Nenhum ciclo ainda. Crie o primeiro.</Empty>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Minhas avaliações                                                  */
/* ------------------------------------------------------------------ */

function MySection({ onOpen }: { onOpen: (id: string) => void }) {
  const fn = useServerFn(listMyEvaluations);
  const q = useQuery({ queryKey: ["my-evals"], queryFn: () => fn() });
  return (
    <Card>
      <SectionHeader icon={ClipboardCheck} title="Minhas avaliações" />
      <div className="space-y-2">
        {(q.data ?? []).map((e: any) => (
          <button
            key={e.id}
            onClick={() => onOpen(e.id)}
            className="glass-chip flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/15"
          >
            <div className="min-w-0">
              <div className="font-medium">{e.evaluation_cycles?.name ?? "Ciclo"}</div>
              <div className="mt-0.5"><StatusBadge status={e.status} /></div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
          </button>
        ))}
        {q.data && q.data.length === 0 && <Empty>Nenhuma avaliação no momento.</Empty>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Equipe / Avaliar                                                   */
/* ------------------------------------------------------------------ */

function TeamSection({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(listTeamEvaluations);
  const q = useQuery({ queryKey: ["team-evals"], queryFn: () => fn({ data: {} }) });

  const membersFn = useServerFn(listEvaluableMembers);
  const members = useQuery({ queryKey: ["evaluable-members"], queryFn: () => membersFn() });
  const cyclesFn = useServerFn(listCycles);
  const cycles = useQuery({ queryKey: ["eval-cycles"], queryFn: () => cyclesFn() });

  const [showForm, setShowForm] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [search, setSearch] = useState("");

  const openCycles = (cycles.data ?? []).filter((c: any) => ["aberto", "em_andamento"].includes(c.status));

  const createFn = useServerFn(createEvaluationForMember);
  const createMut = useMutation({
    mutationFn: () => createFn({ data: { cycle_id: cycleId, evaluatee_id: memberId } }),
    onSuccess: (r: any) => {
      toast.success("Avaliação pronta", { description: "Abrindo…" });
      qc.invalidateQueries({ queryKey: ["team-evals"] });
      setShowForm(false);
      setMemberId("");
      setCycleId("");
      onOpen(r.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (q.data ?? []).filter((e: any) => {
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return (e.profiles?.full_name ?? "").toLowerCase().includes(t);
  });

  const pending = (q.data ?? []).filter((e: any) => e.status !== "concluida").length;
  const done = (q.data ?? []).length - pending;

  return (
    <Card>
      <SectionHeader
        icon={ClipboardCheck}
        title="Avaliar meu time"
        action={
          <button onClick={() => setShowForm((v) => !v)} className={BTN_CHIP}>
            <Plus className="h-4 w-4" /> Nova
          </button>
        }
      />

      {/* Resumo rápido */}
      {(q.data?.length ?? 0) > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="glass-chip rounded-2xl px-4 py-3">
            <div className="font-display text-[22px] font-black text-magic-amber">{pending}</div>
            <div className="text-[11px] text-white/60">a concluir</div>
          </div>
          <div className="glass-chip rounded-2xl px-4 py-3">
            <div className="font-display text-[22px] font-black text-magic-green">{done}</div>
            <div className="text-[11px] text-white/60">concluídas</div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-4 grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">
          <div className="text-[12px] text-white/70">Selecione o membro do elenco e o ciclo:</div>
          <select className={FIELD} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="" className="text-blu">Membro do elenco…</option>
            {(members.data ?? []).map((m: any) => (
              <option key={m.id} value={m.id} className="text-blu">
                {m.full_name}{m.attraction ? ` — ${m.attraction}` : ""}
              </option>
            ))}
          </select>
          <select className={FIELD} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            <option value="" className="text-blu">Ciclo…</option>
            {openCycles.map((c: any) => (
              <option key={c.id} value={c.id} className="text-blu">
                {c.name} ({CYCLE_LABEL[c.status] ?? c.status})
              </option>
            ))}
          </select>
          {openCycles.length === 0 && (
            <p className="text-[12px] text-magic-amber">Nenhum ciclo aberto — peça ao admin para abrir um ciclo antes.</p>
          )}
          <button disabled={!memberId || !cycleId || createMut.isPending} onClick={() => createMut.mutate()} className={BTN_PRIMARY}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar & abrir avaliação"}
          </button>
        </div>
      )}

      {/* Busca */}
      {(q.data?.length ?? 0) > 4 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome" className={cn(FIELD, "pl-9")} />
        </div>
      )}

      <div className="space-y-2">
        {rows.map((e: any) => (
          <button
            key={e.id}
            onClick={() => onOpen(e.id)}
            className="glass-chip flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/15"
          >
            <div className="min-w-0">
              <div className="truncate font-display text-[15px] font-black tracking-[-0.02em]">{e.profiles?.full_name ?? "Elenco"}</div>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={e.status} />
                <span className="truncate text-[11.5px] text-white/55">{e.evaluation_cycles?.name}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
          </button>
        ))}
        {q.data && q.data.length === 0 && <Empty>Sem avaliações da equipe ainda. Toque em “Nova” para começar.</Empty>}
        {q.data && q.data.length > 0 && rows.length === 0 && <Empty>Ninguém encontrado com esse nome.</Empty>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Indicadores (líder/admin)                                          */
/* ------------------------------------------------------------------ */

function IndicatorsSection() {
  const fn = useServerFn(getEvaluationDashboard);
  const q = useQuery({ queryKey: ["eval-dashboard"], queryFn: () => fn({ data: {} }) });
  const d = q.data;

  if (!d) return null;
  if (!d.cycle) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <BarChart3 className="h-4 w-4" /> Crie um ciclo para ver os indicadores.
        </div>
      </Card>
    );
  }

  const exportCsv = (rows: any[], filename: string, headers: string[], keys: string[]) => {
    const csv = [headers.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <SectionHeader
        icon={BarChart3}
        title={`Indicadores — ${d.cycle.name}`}
        action={<NotifyPendingButton cycleId={d.cycle.id} />}
      />

      {d.cyclesOverview && d.cyclesOverview.total > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="glass-chip rounded-2xl p-3 text-center">
            <div className="font-display text-[20px] font-black text-white">{d.cyclesOverview.total}</div>
            <div className="text-[10.5px] text-white/60">Ciclos no total</div>
          </div>
          <div className="glass-chip rounded-2xl p-3 text-center">
            <div className="font-display text-[20px] font-black text-magic-green">{d.cyclesOverview.encerrado}</div>
            <div className="text-[10.5px] text-white/60">Concluídos</div>
          </div>
          <div className="glass-chip rounded-2xl p-3 text-center">
            <div className="font-display text-[20px] font-black text-magic-amber">{d.cyclesOverview.em_andamento}</div>
            <div className="text-[10.5px] text-white/60">Em andamento</div>
          </div>
          <div className="glass-chip rounded-2xl p-3 text-center">
            <div className="font-display text-[20px] font-black text-white/80">
              {d.cyclesOverview.aberto + d.cyclesOverview.rascunho}
            </div>
            <div className="text-[10.5px] text-white/60">Pendentes / rascunho</div>
          </div>
        </div>
      )}

      <div className="glass-chip mb-4 rounded-2xl px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-white/70">Conclusão geral</span>
          <span className="font-display text-[18px] font-black">
            {d.overall.done}<span className="text-white/50">/{d.overall.total}</span> · {d.overall.pct}%
          </span>
        </div>
        <ProgressBar pct={d.overall.pct} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Por atração / negócio</h3>
            <button
              onClick={() => exportCsv(d.byAttraction, `avaliacoes_por_atracao_${d.cycle!.name}.csv`, ["Atração", "Concluídas", "Total", "%"], ["name", "done", "total", "pct"])}
              className="text-[11px] text-celeste underline-offset-4 hover:underline"
            >
              exportar CSV
            </button>
          </div>
          <div className="space-y-2">
            {d.byAttraction.map((r) => (
              <div key={r.name} className="glass-chip rounded-2xl p-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="text-white/70">{r.done}/{r.total} · {r.pct}%</span>
                </div>
                <ProgressBar pct={r.pct} />
              </div>
            ))}
            {d.byAttraction.length === 0 && <Empty>Sem avaliações neste ciclo.</Empty>}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">
              <Users className="h-4 w-4" /> Por líder
            </h3>
            <button
              onClick={() => exportCsv(d.byLeader, `avaliacoes_por_lider_${d.cycle!.name}.csv`, ["Líder", "Concluídas", "Total", "%"], ["name", "done", "total", "pct"])}
              className="text-[11px] text-celeste underline-offset-4 hover:underline"
            >
              exportar CSV
            </button>
          </div>
          <div className="max-h-64 space-y-2 overflow-auto pr-1">
            {d.byLeader.map((r) => (
              <div key={r.leader_id} className="glass-chip rounded-2xl p-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="text-white/70">{r.done}/{r.total} · {r.pct}%</span>
                </div>
                <ProgressBar pct={r.pct} />
              </div>
            ))}
            {d.byLeader.length === 0 && <Empty>Sem líderes atribuídos.</Empty>}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">
              <Users className="h-4 w-4" /> Por avaliador
            </h3>
            <button
              onClick={() => exportCsv(d.byEvaluator, `avaliacoes_por_avaliador_${d.cycle!.name}.csv`, ["Avaliador", "Concluídas", "Total", "%"], ["name", "done", "total", "pct"])}
              className="text-[11px] text-celeste underline-offset-4 hover:underline"
            >
              exportar CSV
            </button>
          </div>
          <div className="max-h-64 space-y-2 overflow-auto pr-1">
            {d.byEvaluator.map((r) => (
              <div key={r.evaluator_id} className="glass-chip rounded-2xl p-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="text-white/70">{r.done}/{r.total} · {r.pct}%</span>
                </div>
                <ProgressBar pct={r.pct} />
              </div>
            ))}
            {d.byEvaluator.length === 0 && <Empty>Nenhum avaliador atribuído.</Empty>}
          </div>
        </div>
      </div>

      {d.spirits && d.spirits.some((s: any) => s.count > 0) && (
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">
            <Sparkles className="h-4 w-4" /> Espírito mágico — média do ciclo
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {d.spirits.map((s: any) => (
              <div key={s.key} className="glass-chip rounded-2xl p-3 text-center">
                <div className="font-display text-[22px] font-black text-white">
                  {s.avg != null ? s.avg : "—"}
                  <span className="text-[12px] font-normal text-white/50">/3</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-white/70">{s.label}</div>
                <div className="text-[10px] text-white/40">{s.count} avaliações</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">
            <TrendingDown className="h-4 w-4" /> Competências com menores notas
          </h3>
          <button
            onClick={() => exportCsv(d.byCompetency, `competencias_${d.cycle!.name}.csv`, ["Pilar", "Competência", "Média", "Esperado", "Avaliações"], ["pillar", "name", "avg", "expected", "count"])}
            className="text-[11px] text-celeste underline-offset-4 hover:underline"
          >
            exportar CSV
          </button>
        </div>
        <div className="grid gap-1.5">
          {d.byCompetency.slice(0, 8).map((c) => {
            const gap = c.avg != null ? c.avg < c.expected : false;
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-3 py-2 text-sm",
                  gap ? "border-magic-red/40 bg-magic-red/10" : "glass-chip border-transparent",
                )}
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-[11px] text-white/50">{c.pillar}</div>
                </div>
                <div className="text-right">
                  <div className={cn("font-display text-[18px] font-black", gap ? "text-magic-red" : "text-white")}>{c.avg ?? "—"}</div>
                  <div className="text-[11px] text-white/60">esperado {c.expected}</div>
                </div>
              </div>
            );
          })}
          {d.byCompetency.length === 0 && <Empty>Nenhuma nota lançada ainda.</Empty>}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Detalhe da avaliação (scoring)                                     */
/* ------------------------------------------------------------------ */

function EvaluationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getEvaluationDetail);
  const metaFn = useServerFn(listPillarsAndCompetencies);
  const saveScoreFn = useServerFn(saveScore);
  const setStatusFn = useServerFn(updateEvaluationStatus);
  const { userId } = useCurrentUser().data ?? ({} as any);

  const d = useQuery({ queryKey: ["eval", id], queryFn: () => detailFn({ data: { evaluation_id: id } }) });
  const meta = useQuery({ queryKey: ["eval-meta"], queryFn: () => metaFn() });

  const scoreMap = new Map<string, any>();
  (d.data?.scores ?? []).forEach((s: any) => {
    if (!s.scored_by || s.scored_by === userId) scoreMap.set(s.competency_id, s);
  });

  const saveMut = useMutation({
    mutationFn: (input: { competency_id: string; score: number }) => saveScoreFn({ data: { evaluation_id: id, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (status: any) => setStatusFn({ data: { evaluation_id: id, status } }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["eval", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSpiritsFn = useServerFn(saveEvaluationSpirits);
  const spiritsMut = useMutation({
    mutationFn: (patch: Record<string, string>) => saveSpiritsFn({ data: { evaluation_id: id, ...patch } as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const pillars = meta.data?.pillars ?? [];
  const comps = meta.data?.competencies ?? [];
  const ev = d.data?.evaluation as any;

  // Derivados: progresso e média
  const totalComps = comps.length;
  const scoredValues = comps.map((c: any) => scoreMap.get(c.id)?.score).filter((v: any) => typeof v === "number");
  const scoredCount = scoredValues.length;
  const progressPct = totalComps ? Math.round((scoredCount / totalComps) * 100) : 0;
  const overallAvg = scoredValues.length ? +(scoredValues.reduce((a: number, b: number) => a + b, 0) / scoredValues.length).toFixed(2) : null;

  const loading = d.isLoading || meta.isLoading;

  return (
    <LiquidBackground>
      <div className="relative z-10 mx-auto max-w-[430px] space-y-4 px-4 py-6 pb-24 text-white">
        <header className="flex items-center gap-3">
          <button onClick={onBack} className="glass-chip grid h-10 w-10 place-items-center rounded-2xl transition active:scale-95" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[20px] font-black tracking-[-0.03em]">{ev?.profiles?.full_name ?? "Avaliação"}</h1>
            <p className="truncate text-[12.5px] text-white/65">
              {ev?.evaluation_cycles?.name}
              {ev?.profiles?.role_title ? ` · ${ev.profiles.role_title}` : ""}
              {ev?.profiles?.attraction ? ` · ${ev.profiles.attraction}` : ""}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>
        ) : (
          <>
            {/* Resumo: progresso + média + fluxo */}
            <Card>
              <div className="flex items-center gap-4">
                <ProgressRing pct={progressPct} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Progresso</div>
                  <div className="font-display text-[20px] font-black tracking-[-0.02em]">
                    {scoredCount} de {totalComps} competências
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-white/70">
                    {overallAvg != null ? <>Média atual <b className="text-white">{overallAvg}</b> / 5</> : "Comece a pontuar abaixo."}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <StatusStepper status={ev?.status} onSet={(s) => statusMut.mutate(s)} pending={statusMut.isPending} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <PdfButton id={id} />
              </div>
            </Card>

            <ScaleHelp />

            <SectionHeader icon={TrendingUp} title="Escada pra Magia" />
            {pillars.map((p: any) => (
              <PillarSection
                key={p.id}
                pillar={p}
                comps={comps.filter((c: any) => c.pillar_id === p.id)}
                scoreMap={scoreMap}
                onScore={(competency_id, score) => saveMut.mutate({ competency_id, score })}
              />
            ))}

            <SpiritSection evaluation={ev} onSet={(key, value) => spiritsMut.mutate({ [key]: value })} />

            <PdiSection evaluationId={id} pdis={d.data?.pdis ?? []} comps={comps} />
            <DocumentsSection evaluationId={id} />
          </>
        )}
      </div>
    </LiquidBackground>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative grid h-[68px] w-[68px] shrink-0 place-items-center">
      <svg width="68" height="68" className="-rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
        <circle cx="34" cy="34" r={r} fill="none" stroke="url(#ringgrad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-500" />
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6ad1e3" />
            <stop offset="100%" stopColor="#e451f5" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute font-display text-[15px] font-black">{pct}%</span>
    </div>
  );
}

function StatusStepper({ status, onSet, pending }: { status: string; onSet: (s: string) => void; pending: boolean }) {
  const curIdx = STATUS_STEPS.findIndex((s) => s.id === status);
  return (
    <div>
      <div className="flex items-center">
        {STATUS_STEPS.map((s, i) => {
          const done = i < curIdx;
          const active = i === curIdx;
          return (
            <div key={s.id} className="flex flex-1 items-center last:flex-none">
              <button
                onClick={() => onSet(s.id)}
                disabled={pending}
                className="flex flex-col items-center gap-1"
                title={`Marcar como ${s.label}`}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold transition",
                    active ? "bg-brand-grad text-white shadow-glow" : done ? "bg-magic-green/80 text-white" : "glass-chip text-white/55",
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn("text-[10px] font-medium leading-none", active ? "text-white" : "text-white/55")}>{s.label}</span>
              </button>
              {i < STATUS_STEPS.length - 1 && <span className={cn("mx-1 h-0.5 flex-1 rounded-full", i < curIdx ? "bg-magic-green/70" : "bg-white/15")} />}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/50">Toque numa etapa para mover a avaliação. Anexar o documento assinado conclui automaticamente.</p>
    </div>
  );
}

function ScaleHelp() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="!p-0">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4 text-celeste" /> Como pontuar (1 a 5)
        </span>
        <ChevronDown className={cn("h-4 w-4 text-white/60 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid gap-1.5 px-4 pb-4 text-[12px] text-white/85">
          {SCALE.map((s) => (
            <div key={s.score} className="flex gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15 font-bold">{s.score}</span>
              <div>
                <div className="font-semibold text-white">{s.label}</div>
                <div className="text-white/65">{s.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const SPIRIT_FIELDS = [
  { key: "spirit_amar", label: "Amar" },
  { key: "spirit_honrar", label: "Honrar" },
  { key: "spirit_verdadeiro", label: "Ser verdadeiro" },
  { key: "spirit_justo", label: "Ser justo" },
  { key: "spirit_servir", label: "Servir" },
] as const;

const SPIRIT_LEVELS = [
  { value: "abaixo", label: "Abaixo" },
  { value: "no_esperado", label: "No esperado" },
  { value: "acima", label: "Acima" },
] as const;

function SpiritSection({
  evaluation,
  onSet,
}: {
  evaluation: any;
  onSet: (key: string, value: string) => void;
}) {
  return (
    <Card>
      <SectionHeader icon={Sparkles} title="Espírito mágico" />
      <p className="mb-3 text-[12px] text-white/65">
        Como a pessoa vive cada um dos 5 pontos do espírito Hector Studios.
      </p>
      <div className="grid gap-2.5">
        {SPIRIT_FIELDS.map(({ key, label }) => {
          const current = evaluation?.[key] ?? null;
          return (
            <div key={key} className="glass-chip rounded-2xl p-3">
              <div className="mb-2 text-[13px] font-semibold text-white">{label}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {SPIRIT_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    onClick={() => onSet(key, lvl.value)}
                    className={cn(
                      "rounded-xl px-2 py-2 text-[12px] font-semibold transition",
                      current === lvl.value ? "bg-brand-grad text-white shadow-glow" : "bg-white/10 text-white/75 hover:bg-white/15",
                    )}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PillarSection({
  pillar,
  comps,
  scoreMap,
  onScore,
}: {
  pillar: any;
  comps: any[];
  scoreMap: Map<string, any>;
  onScore: (competencyId: string, score: number) => void;
}) {
  const accent = pillarAccent(pillar.name);
  const scored = comps.filter((c) => typeof scoreMap.get(c.id)?.score === "number");
  const avg = scored.length ? +(scored.reduce((a, c) => a + scoreMap.get(c.id).score, 0) / scored.length).toFixed(1) : null;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", accent.dot)} />
            <h3 className="font-display text-[17px] font-black tracking-[-0.02em]">{pillar.name}</h3>
          </div>
          {pillar.description && <p className="mt-1 text-[12px] text-white/60">{pillar.description}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className={cn("font-display text-[20px] font-black", accent.text)}>{avg ?? "—"}</div>
          <div className="text-[10px] text-white/50">{scored.length}/{comps.length}</div>
        </div>
      </div>
      <div className={cn("mb-4 h-1 rounded-full bg-gradient-to-r opacity-80", accent.grad)} />
      <div className="space-y-3">
        {comps.map((c) => (
          <CompetencyRow key={c.id} comp={c} current={scoreMap.get(c.id)?.score ?? 0} onScore={(n) => onScore(c.id, n)} />
        ))}
      </div>
    </Card>
  );
}

function CompetencyRow({ comp, current, onScore }: { comp: any; current: number; onScore: (n: number) => void }) {
  const expected = Number(comp.expected_score ?? 4);
  const below = current > 0 && current < expected;
  const met = current >= expected && current > 0;
  const [showGuide, setShowGuide] = useState(false);
  return (
    <div className={cn("rounded-2xl border p-3", below ? "border-magic-red/40 bg-magic-red/[0.07]" : "border-white/10 bg-white/[0.04]")}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{comp.name}</div>
          {comp.description && <div className="mt-0.5 text-[11.5px] leading-snug text-white/55">{comp.description}</div>}
          {comp.how_to_evaluate && (
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-celeste"
            >
              <HelpCircle className="h-3 w-3" /> Como avaliar essa competência
            </button>
          )}
          {showGuide && comp.how_to_evaluate && (
            <div className="mt-1.5 rounded-xl bg-celeste/10 p-2.5 text-[11.5px] leading-snug text-white/80">
              {comp.how_to_evaluate}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="glass-chip rounded-full px-2 py-0.5 text-[10px] text-white/70">esperado {expected}</span>
          {met && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-magic-green"><CheckCircle2 className="h-3 w-3" /> ok</span>}
          {below && <span className="text-[10px] font-semibold text-magic-red">abaixo</span>}
        </div>
      </div>
      <div className="flex gap-1.5">
        {SCALE.map(({ score: n, label }) => (
          <button
            key={n}
            title={`${n} — ${label}`}
            onClick={() => onScore(n)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
              current === n ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/70 hover:bg-white/15",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {current > 0 && <div className="mt-2 text-[11.5px] text-white/60">{SCALE[current - 1]?.label}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PDIs                                                               */
/* ------------------------------------------------------------------ */

const PDI_STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function PdiSection({ evaluationId, pdis, comps }: { evaluationId: string; pdis: any[]; comps: any[] }) {
  const qc = useQueryClient();
  const savePdiFn = useServerFn(savePdi);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [objective, setObjective] = useState("");
  const [actions, setActions] = useState("");
  const [due, setDue] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [status, setStatus] = useState("aberto");

  function openNew() {
    setEditingId(null);
    setObjective("");
    setActions("");
    setDue("");
    setCompetencyId("");
    setStatus("aberto");
    setOpen(true);
  }

  function openEdit(p: any) {
    setEditingId(p.id);
    setObjective(p.objective ?? "");
    setActions(p.actions ?? "");
    setDue(p.due_on ?? "");
    setCompetencyId(p.competency_id ?? "");
    setStatus(p.status ?? "aberto");
    setOpen(true);
  }

  const mut = useMutation({
    mutationFn: () =>
      savePdiFn({
        data: {
          id: editingId ?? undefined,
          evaluation_id: evaluationId,
          objective,
          actions: actions || undefined,
          due_on: due || undefined,
          competency_id: competencyId || undefined,
          status: status as "aberto" | "em_andamento" | "concluido" | "cancelado",
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "PDI atualizado" : "PDI salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["eval", evaluationId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const compName = new Map<string, string>(comps.map((c) => [c.id, c.name]));

  return (
    <Card>
      <SectionHeader
        icon={Target}
        title="Plano de Desenvolvimento (PDI)"
        action={
          <button onClick={openNew} className={BTN_CHIP}>
            <Plus className="h-4 w-4" /> Novo PDI
          </button>
        }
      />
      <div className="space-y-2">
        {pdis.map((p: any) => (
          <button
            key={p.id}
            onClick={() => openEdit(p)}
            className="glass-chip w-full rounded-2xl p-3 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{p.objective}</div>
                {p.competency_id && compName.get(p.competency_id) && (
                  <div className="mt-0.5 text-[11px] text-celeste">{compName.get(p.competency_id)}</div>
                )}
                {p.actions ? (
                  <div className="mt-1 text-[12px] text-white/65">{p.actions}</div>
                ) : (
                  <div className="mt-1 text-[12px] text-white/40 italic">Toque pra combinar as ações</div>
                )}
                {p.due_on && <div className="mt-1 text-[11px] text-white/50">Prazo: {p.due_on}</div>}
              </div>
              {p.status === "concluido" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-magic-green" />
              ) : (
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                  {PDI_STATUS_LABEL[p.status] ?? p.status}
                </span>
              )}
            </div>
          </button>
        ))}
        {pdis.length === 0 && <Empty>Nenhum PDI ainda. Combine 1 ou 2 objetivos de desenvolvimento.</Empty>}
      </div>

      <BottomSheetModal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Editar PDI" : "Novo PDI"}
        description="Objetivo SMART e ações combinadas."
      >
        <div className="grid gap-2">
          <input className={FIELD} placeholder="Objetivo SMART" value={objective} onChange={(e) => setObjective(e.target.value)} />
          <textarea className={cn(FIELD, "min-h-[80px] resize-none")} placeholder="Ações combinadas" value={actions} onChange={(e) => setActions(e.target.value)} />
          <select className={FIELD} value={competencyId} onChange={(e) => setCompetencyId(e.target.value)}>
            <option value="" className="text-blu">Competência relacionada (opcional)</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id} className="text-blu">{c.name}</option>
            ))}
          </select>
          <input type="date" className={FIELD} value={due} onChange={(e) => setDue(e.target.value)} />
          {editingId && (
            <select className={FIELD} value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(PDI_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value} className="text-blu">{label}</option>
              ))}
            </select>
          )}
          <button onClick={() => mut.mutate()} disabled={!objective || mut.isPending} className={BTN_PRIMARY}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Salvar alterações" : "Adicionar PDI"}
          </button>
        </div>
      </BottomSheetModal>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  PDF / Documentos / Minha Magia / Notificar                         */
/* ------------------------------------------------------------------ */

function PdfButton({ id }: { id: string }) {
  const fn = useServerFn(generateEvaluationPdf);
  const mut = useMutation({
    mutationFn: () => fn({ data: { evaluation_id: id } }),
    onSuccess: (r: any) => {
      const a = document.createElement("a");
      a.href = r.dataUrl;
      a.download = r.filename;
      a.click();
      toast.success("PDF gerado");
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <button onClick={() => mut.mutate()} disabled={mut.isPending} className={BTN_CHIP}>
      <FileText className="h-3.5 w-3.5" /> {mut.isPending ? "Gerando..." : "Baixar PDF"}
    </button>
  );
}

function MyMagicSection() {
  const fn = useServerFn(getMyMagicJourney);
  const q = useQuery({ queryKey: ["my-magic"], queryFn: () => fn() });
  const d = q.data;
  if (!d) return null;
  return (
    <Card>
      <SectionHeader icon={Wand2} title="Minha Magia" />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Ciclos" value={d.totals.cycles} />
        <Stat label="Concluídos" value={d.totals.completed} tone="green" />
        <Stat label="PDIs abertos" value={d.totals.pdis_open} tone="amber" />
        <Stat label="PDIs concluídos" value={d.totals.pdis_done} tone="green" />
      </div>
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Evolução por ciclo</h3>
      <div className="mb-4 space-y-2">
        {d.timeline.map((t) => (
          <div key={t.evaluation_id} className="glass-chip flex items-center justify-between rounded-2xl p-3">
            <div>
              <div className="text-sm font-medium">{t.cycle_name}</div>
              <div className="mt-0.5"><StatusBadge status={t.status} /></div>
            </div>
            <div className="text-right">
              <div className="font-display text-[20px] font-black">{t.overall ?? "—"}</div>
              <div className="text-[10px] text-white/50">nota geral</div>
            </div>
          </div>
        ))}
        {d.timeline.length === 0 && <Empty>Ainda sem avaliações.</Empty>}
      </div>
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Meus PDIs</h3>
      <div className="space-y-1.5">
        {d.pdis.slice(0, 6).map((p: any) => (
          <div key={p.id} className="glass-chip flex items-start justify-between rounded-2xl px-3 py-2">
            <div>
              <div className="text-sm font-medium">{p.objective}</div>
              {p.due_on && <div className="text-[11px] text-white/50">Prazo: {p.due_on}</div>}
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", p.status === "concluido" ? "bg-magic-green/20 text-magic-green" : "bg-white/10 text-white/70")}>
              {p.status}
            </span>
          </div>
        ))}
        {d.pdis.length === 0 && <Empty>Nenhum PDI registrado.</Empty>}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "green" | "amber" }) {
  const color = tone === "green" ? "text-magic-green" : tone === "amber" ? "text-magic-amber" : "text-white";
  return (
    <div className="glass-chip rounded-2xl p-3 text-center">
      <div className={cn("font-display text-[22px] font-black", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
    </div>
  );
}

function DocumentsSection({ evaluationId }: { evaluationId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listEvaluationDocuments);
  const attachFn = useServerFn(attachEvaluationDocument);
  const q = useQuery({ queryKey: ["eval-docs", evaluationId], queryFn: () => listFn({ data: { evaluation_id: evaluationId } }) });
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${evaluationId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("evaluation-documents")
        .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
      if (error) throw error;
      await attachFn({ data: { evaluation_id: evaluationId, storage_path: path, mime_type: file.type || "application/pdf", kind: "assinada" } });
      toast.success("Documento enviado — avaliação marcada como concluída");
      qc.invalidateQueries({ queryKey: ["eval-docs", evaluationId] });
      qc.invalidateQueries({ queryKey: ["eval", evaluationId] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <Card>
      <SectionHeader
        icon={FileText}
        title="Documento assinado"
        action={
          <label className={cn(BTN_CHIP, "cursor-pointer")}>
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : "Enviar PDF"}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        }
      />
      <div className="space-y-2">
        {(q.data ?? []).map((doc: any) => (
          <a
            key={doc.id}
            href={doc.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="glass-chip block rounded-2xl px-4 py-3 text-sm transition hover:bg-white/15"
          >
            <div className="flex items-center justify-between">
              <span className="truncate">{doc.storage_path.split("/").pop()}</span>
              <span className="shrink-0 text-[11px] text-white/50">{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </a>
        ))}
        {q.data && q.data.length === 0 && <Empty>Envie o PDF assinado para arquivar a avaliação.</Empty>}
      </div>
    </Card>
  );
}

function NotifyPendingButton({ cycleId }: { cycleId: string }) {
  const fn = useServerFn(notifyPendingEvaluators);
  const mut = useMutation({
    mutationFn: () => fn({ data: { cycle_id: cycleId } }),
    onSuccess: (r: any) => toast.success(r.notified ? `Notificação enviada (${r.pending} pendentes)` : "Nada pendente"),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <button onClick={() => mut.mutate()} disabled={mut.isPending} className={BTN_CHIP}>
      <Bell className="h-3.5 w-3.5" /> {mut.isPending ? "Enviando..." : "Notificar pendentes"}
    </button>
  );
}
