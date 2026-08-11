import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Loader2,
  Check,
  X,
  RotateCcw,
  Search,
  Play,
  Flag,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import {
  createJobRequest,
  listJobRequests,
  decideJobRequest,
  updateRecruitmentStatus,
  deleteJobRequest,
  ATTRACTION_OPTIONS,
  DEPARTMENT_OPTIONS,
  LEVEL_OPTIONS,
  TYPE_OPTIONS,
  CONTRACT_OPTIONS,
  WORKLOAD_OPTIONS,
  MODEL_OPTIONS,
  URGENCY_OPTIONS,
  type JobStatus,
} from "@/lib/jobs.functions";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const STATUS_META: Record<JobStatus, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-white/15 text-white" },
  changes_requested: { label: "Ajustes", cls: "bg-magic-amber/20 text-magic-amber" },
  approved: { label: "Aprovada", cls: "bg-magic-green/25 text-white" },
  rejected: { label: "Recusada", cls: "bg-magic-red/25 text-white" },
  in_recruitment: { label: "Em recrutamento", cls: "bg-celeste/25 text-white" },
  finished: { label: "Finalizada", cls: "bg-white/25 text-white" },
};

function StatusBadge({ s }: { s: JobStatus }) {
  const m = STATUS_META[s];
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]", m.cls)}>
      {m.label}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">{children}</div>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "glass-input w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/40";
const selectCls = inputCls + " appearance-none";
const textareaCls =
  "glass-input min-h-[96px] w-full resize-none rounded-2xl p-4 text-[13.5px] text-white outline-none placeholder:text-white/40";

type Job = {
  id: string;
  title: string;
  attraction: string;
  department: string;
  level: string;
  type: string;
  contract: string;
  workload: string;
  model: string;
  urgency: string;
  start_date: string | null;
  budget: string | null;
  manager_name: string;
  reason: string;
  activities: string;
  requirements: string;
  status: JobStatus;
  decision_note: string | null;
  created_by: string;
  created_at: string;
};

const emptyForm = {
  title: "",
  attraction: "",
  department: "",
  level: LEVEL_OPTIONS[2],
  type: TYPE_OPTIONS[0],
  contract: CONTRACT_OPTIONS[0],
  workload: WORKLOAD_OPTIONS[0],
  model: MODEL_OPTIONS[0],
  urgency: "Média",
  start_date: "",
  budget: "",
  manager_name: "",
  reason: "",
  activities: "",
  requirements: "",
};

function JobForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();
  const createFn = useServerFn(createJobRequest);
  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          start_date: form.start_date || null,
          budget: form.budget || null,
        },
      }),
    onSuccess: () => {
      toast.success("Vaga enviada", { description: "Encaminhada para aprovação." });
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onCreated();
    },
    onError: (e: any) => toast.error("Não rolou enviar", { description: e.message }),
  });
  const set = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <Section n={1} title="Identificação">
        <div className="grid gap-3">
          <Field label="Nome da vaga">
            <input className={inputCls} required placeholder="Ex: Operador de Atração Pleno" value={form.title} onChange={set("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Atração">
              <select className={selectCls} required value={form.attraction} onChange={set("attraction")}>
                <option value="" className="text-blu">Selecione</option>
                {ATTRACTION_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
              </select>
            </Field>
            <Field label="Setor">
              <select className={selectCls} required value={form.department} onChange={set("department")}>
                <option value="" className="text-blu">Selecione</option>
                {DEPARTMENT_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section n={2} title="Formato">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nível">
            <select className={selectCls} value={form.level} onChange={set("level")}>
              {LEVEL_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className={selectCls} value={form.type} onChange={set("type")}>
              {TYPE_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
            </select>
          </Field>
          <Field label="Contrato">
            <select className={selectCls} value={form.contract} onChange={set("contract")}>
              {CONTRACT_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
            </select>
          </Field>
          <Field label="Carga">
            <select className={selectCls} value={form.workload} onChange={set("workload")}>
              {WORKLOAD_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
            </select>
          </Field>
          <Field label="Modelo">
            <select className={selectCls} value={form.model} onChange={set("model")}>
              {MODEL_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
            </select>
          </Field>
          <Field label="Urgência">
            <select className={selectCls} value={form.urgency} onChange={set("urgency")}>
              {URGENCY_OPTIONS.map((o) => <option key={o} className="text-blu">{o}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section n={3} title="Aprovação">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início desejado">
              <input type="date" className={inputCls} value={form.start_date} onChange={set("start_date")} />
            </Field>
            <Field label="Faixa / orçamento">
              <input className={inputCls} placeholder="R$ 3.200 a R$ 4.000" value={form.budget} onChange={set("budget")} />
            </Field>
          </div>
          <Field label="Gestor aprovador">
            <input className={inputCls} required placeholder="Nome do gestor" value={form.manager_name} onChange={set("manager_name")} />
          </Field>
        </div>
      </Section>

      <Section n={4} title="Briefing para o DHO">
        <div className="grid gap-3">
          <Field label="Justificativa">
            <textarea className={textareaCls} required placeholder="Motivo, impacto e risco de não contratar agora." value={form.reason} onChange={set("reason")} />
          </Field>
          <Field label="Atividades principais">
            <textarea className={textareaCls} required placeholder="Entregas e responsabilidades." value={form.activities} onChange={set("activities")} />
          </Field>
          <Field label="Requisitos">
            <textarea className={textareaCls} required placeholder="Experiência, competências, ferramentas, perfil." value={form.requirements} onChange={set("requirements")} />
          </Field>
        </div>
      </Section>

      <button
        type="submit"
        disabled={m.isPending}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-grad px-5 py-4 text-[15px] font-semibold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-70"
      >
        {m.isPending ? <Loader2 size={18} className="animate-spin" /> : "Enviar para aprovação"}
      </button>
    </form>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="glass-soft rounded-[24px] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-grad text-[12px] font-bold text-white">{n}</span>
        <h3 className="font-display text-[16px] font-bold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function JobCard({
  job,
  onClick,
  trailing,
}: {
  job: Job;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-soft w-full rounded-2xl p-4 text-left transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
            {job.attraction} · {job.department}
          </div>
          <div className="mt-0.5 font-display text-[15.5px] font-bold text-white">{job.title}</div>
          <div className="mt-1 text-[12px] text-white/65">
            {job.level} · {job.contract} · {job.model} · urgência {job.urgency}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge s={job.status} />
          {trailing}
        </div>
      </div>
    </button>
  );
}

function DecisionPanel({ job, onClose }: { job: Job; onClose: () => void }) {
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const decide = useServerFn(decideJobRequest);
  const del = useServerFn(deleteJobRequest);
  const m = useMutation({
    mutationFn: (action: "approve" | "reject" | "request_changes") =>
      decide({ data: { id: job.id, action, note: note || undefined } }),
    onSuccess: () => {
      toast.success("Decisão registrada");
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });
  const delM = useMutation({
    mutationFn: () => del({ data: { id: job.id } }),
    onSuccess: () => {
      toast.success("Vaga removida");
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="grid gap-4">
      <div>
        <Eyebrow>{job.attraction} · {job.department}</Eyebrow>
        <h3 className="mt-1 font-display text-[22px] font-black tracking-[-0.02em] text-white">{job.title}</h3>
        <div className="mt-1 flex items-center gap-2"><StatusBadge s={job.status} /></div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px] text-white/75">
        <Info k="Nível" v={job.level} />
        <Info k="Tipo" v={job.type} />
        <Info k="Contrato" v={job.contract} />
        <Info k="Carga" v={job.workload} />
        <Info k="Modelo" v={job.model} />
        <Info k="Urgência" v={job.urgency} />
        <Info k="Início" v={job.start_date ?? "—"} />
        <Info k="Orçamento" v={job.budget ?? "—"} />
        <Info k="Gestor" v={job.manager_name} />
      </div>

      <Block title="Justificativa" body={job.reason} />
      <Block title="Atividades" body={job.activities} />
      <Block title="Requisitos" body={job.requirements} />

      {job.decision_note && <Block title="Nota da decisão" body={job.decision_note} />}

      {job.status === "pending" || job.status === "changes_requested" ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota para o líder (opcional)"
            className={textareaCls}
          />
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => m.mutate("request_changes")}
              disabled={m.isPending}
              className="glass-chip flex items-center justify-center gap-1 rounded-2xl px-3 py-3 text-[12.5px] font-semibold text-white"
            >
              <RotateCcw size={14} /> Ajustes
            </button>
            <button
              onClick={() => m.mutate("reject")}
              disabled={m.isPending}
              className="flex items-center justify-center gap-1 rounded-2xl bg-magic-red/30 px-3 py-3 text-[12.5px] font-semibold text-white"
            >
              <X size={14} /> Recusar
            </button>
            <button
              onClick={() => m.mutate("approve")}
              disabled={m.isPending}
              className="flex items-center justify-center gap-1 rounded-2xl bg-magic-green/35 px-3 py-3 text-[12.5px] font-semibold text-white"
            >
              <Check size={14} /> Aprovar
            </button>
          </div>
        </>
      ) : null}

      <button
        onClick={() => {
          confirmAction("Remover esta vaga?", () => delM.mutate());
        }}
        className="mt-2 flex items-center justify-center gap-2 self-start rounded-xl px-3 py-2 text-[11.5px] text-white/55 hover:text-white"
      >
        <Trash2 size={13} /> Remover
      </button>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="glass-soft rounded-xl px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">{k}</div>
      <div className="text-[12.5px] text-white">{v}</div>
    </div>
  );
}
function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">{title}</div>
      <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{body}</div>
    </div>
  );
}

function MetricMini({ label, value, tone }: { label: string; value: number; tone: "blue" | "pink" | "green" }) {
  const accent =
    tone === "blue" ? "text-celeste" : tone === "pink" ? "text-pink" : "text-magic-green";
  return (
    <div className="glass-soft rounded-2xl p-3 text-white">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">{label}</div>
      <div className={cn("mt-1 font-display text-[22px] font-black leading-none", accent)}>{value}</div>
    </div>
  );
}

export default function JobsScreen({ isAdmin }: { isAdmin: boolean }) {
  const [sub, setSub] = useState<"request" | "approve" | "board">(isAdmin ? "approve" : "request");
  const [selected, setSelected] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");

  const listFn = useServerFn(listJobRequests);
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listFn() as Promise<Job[]>,
  });

  const recFn = useServerFn(updateRecruitmentStatus);
  const qc = useQueryClient();
  const recM = useMutation({
    mutationFn: (v: { id: string; status: "in_recruitment" | "finished" | "approved" }) =>
      recFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const metrics = useMemo(() => {
    const all = jobs ?? [];
    return {
      total: all.length,
      pending: all.filter((j) => j.status === "pending" || j.status === "changes_requested").length,
      approved: all.filter((j) => j.status === "approved" || j.status === "in_recruitment").length,
    };
  }, [jobs]);

  const pendingList = (jobs ?? []).filter((j) => j.status === "pending" || j.status === "changes_requested");
  const boardList = useMemo(() => {
    const base = (jobs ?? []).filter((j) =>
      ["approved", "in_recruitment", "finished"].includes(j.status),
    );
    const q = search.trim().toLowerCase();
    return base
      .filter((j) => (statusFilter === "all" ? true : j.status === statusFilter))
      .filter((j) =>
        q
          ? [j.title, j.attraction, j.department, j.manager_name].some((x) =>
              x.toLowerCase().includes(q),
            )
          : true,
      );
  }, [jobs, search, statusFilter]);

  const mine = jobs ?? [];

  const subs = isAdmin
    ? ([
        { id: "approve", label: "Aprovar" },
        { id: "board", label: "Recrutamento" },
        { id: "request", label: "Nova vaga" },
      ] as const)
    : ([
        { id: "request", label: "Nova vaga" },
        { id: "approve", label: "Minhas" },
      ] as const);

  return (
    <>
      <div className="px-1 pt-1">
        <Eyebrow>Hector Vagas</Eyebrow>
        <h1 className="mt-1.5 flex items-center gap-2 font-display text-[26px] font-black leading-[0.95] tracking-[-0.04em] text-white">
          <Briefcase size={22} /> Vagas com aprovação clara
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/65">
          {isAdmin
            ? "Aprove, recuse e acompanhe o recrutamento das vagas do elenco."
            : "Envie o briefing pro gestor aprovar e o DHO iniciar a busca."}
        </p>
      </div>

      {isAdmin && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MetricMini label="Total" value={metrics.total} tone="blue" />
          <MetricMini label="A decidir" value={metrics.pending} tone="pink" />
          <MetricMini label="Aprovadas" value={metrics.approved} tone="green" />
        </div>
      )}

      <div className="glass-soft mt-4 grid gap-1 rounded-full p-1" style={{ gridTemplateColumns: `repeat(${subs.length},1fr)` }}>
        {subs.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSub(s.id as any); setSelected(null); }}
            className={cn(
              "rounded-full py-2.5 text-[12.5px] font-medium transition",
              sub === s.id ? "bg-white text-blu shadow-glow" : "text-white/70",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="mt-6 grid place-items-center"><Loader2 className="animate-spin text-white/60" /></div>}

      {sub === "request" && (
        <div className="mt-5 grid gap-5">
          <JobForm onCreated={() => setSub(isAdmin ? "approve" : "approve")} />
          {!isAdmin && mine.length > 0 && (
            <div className="grid gap-2">
              <div className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/60">Minhas solicitações</div>
              {mine.map((j) => <JobCard key={j.id} job={j} onClick={() => setSelected(j)} />)}
            </div>
          )}
        </div>
      )}

      {sub === "approve" && (
        <div className="mt-5 grid gap-2">
          {(isAdmin ? pendingList : mine).length === 0 && (
            <div className="glass-chip rounded-2xl p-4 text-[13px] text-white/70">
              {isAdmin ? "Nenhuma vaga aguardando decisão." : "Você ainda não enviou vagas."}
            </div>
          )}
          {(isAdmin ? pendingList : mine).map((j) => (
            <JobCard key={j.id} job={j} onClick={() => setSelected(j)} />
          ))}
        </div>
      )}

      {sub === "board" && isAdmin && (
        <div className="mt-5 grid gap-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="glass-input flex items-center gap-2 rounded-2xl px-3">
              <Search size={15} className="text-white/55" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vaga, setor, gestor…"
                className="w-full bg-transparent py-3 text-[13.5px] text-white outline-none placeholder:text-white/45"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={selectCls + " w-auto"}
            >
              <option className="text-blu" value="all">Todos</option>
              <option className="text-blu" value="approved">Aprovada</option>
              <option className="text-blu" value="in_recruitment">Em recrutamento</option>
              <option className="text-blu" value="finished">Finalizada</option>
            </select>
          </div>
          {boardList.length === 0 && (
            <div className="glass-chip rounded-2xl p-4 text-[13px] text-white/70">Nada por aqui ainda.</div>
          )}
          {boardList.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              onClick={() => setSelected(j)}
              trailing={
                <div className="flex gap-1.5">
                  {j.status === "approved" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); recM.mutate({ id: j.id, status: "in_recruitment" }); }}
                      className="flex items-center gap-1 rounded-full bg-celeste/30 px-2.5 py-1 text-[10.5px] font-semibold text-white"
                    >
                      <Play size={11} /> Iniciar
                    </button>
                  )}
                  {j.status === "in_recruitment" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); recM.mutate({ id: j.id, status: "finished" }); }}
                      className="flex items-center gap-1 rounded-full bg-magic-green/35 px-2.5 py-1 text-[10.5px] font-semibold text-white"
                    >
                      <Flag size={11} /> Finalizar
                    </button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="glass-strong max-h-[88vh] w-full max-w-[460px] overflow-y-auto rounded-t-[28px] border border-white/20 p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">Detalhe da vaga</span>
              <button onClick={() => setSelected(null)} className="glass-chip grid h-8 w-8 place-items-center rounded-full text-white/80"><X size={14} /></button>
            </div>
            <DecisionPanel job={selected} onClose={() => setSelected(null)} />
            <button
              onClick={() => setSelected(null)}
              className="mt-4 flex w-full items-center justify-center gap-1 rounded-2xl bg-white/10 px-4 py-3 text-[12.5px] font-medium text-white"
            >
              Fechar <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
