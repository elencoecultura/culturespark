import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Loader2, Play, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPRESAS } from "@/lib/permissions-catalog";
import {
  REPORTS,
  periodPreset,
  type ReportKey,
  type ReportResult,
} from "@/lib/reports/report-defs";
import { exportReport, reportFilterOptions, runReport } from "@/lib/reports.functions";

// Relatórios: somente Administrador. Filtros, visão consolidada ou
// individual, prévia na tela e exportação em PDF e Excel.

const FIELD = "glass-input w-full rounded-2xl px-3 py-2.5 text-[13px] text-white outline-none";
const chip = (on: boolean) =>
  cn(
    "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
    on ? "bg-white text-blu" : "glass-chip text-white/80",
  );
type Preset = "semana" | "mes" | "trimestre" | "ano" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "trimestre", label: "Último trimestre" },
  { key: "ano", label: "Este ano" },
  { key: "custom", label: "Personalizado" },
];

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function RelatoriosAdmin() {
  const optsFn = useServerFn(reportFilterOptions);
  const { data: opts } = useQuery({ queryKey: ["report-opts"], queryFn: () => optsFn() });
  const runFn = useServerFn(runReport);
  const expFn = useServerFn(exportReport);

  const [report, setReport] = useState<ReportKey>("elogios_recebidos");
  const [preset, setPreset] = useState<Preset>("mes");
  const [custom, setCustom] = useState(() => periodPreset("mes"));
  const [empresa, setEmpresa] = useState("");
  const [setor, setSetor] = useState("");
  const [cargo, setCargo] = useState("");
  const [lider, setLider] = useState("");
  const [individual, setIndividual] = useState(false);
  const [person, setPerson] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);

  const def = REPORTS.find((r) => r.key === report)!;
  const period = preset === "custom" ? custom : periodPreset(preset);
  const params = useMemo(
    () => ({
      report,
      filters: {
        ...period,
        empresa: empresa && empresa !== "TODAS" ? empresa : null,
        setor: setor || null,
        cargo: cargo || null,
        lider: lider || null,
        person: def.individual && individual && person ? person : null,
      },
    }),
    [
      report,
      period.from,
      period.to,
      empresa,
      setor,
      cargo,
      lider,
      individual,
      person,
      def.individual,
    ], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const run = useMutation({
    mutationFn: () => runFn({ data: params }),
    onSuccess: (r) => setResult(r as ReportResult),
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });
  const exp = useMutation({
    mutationFn: (format: "pdf" | "excel") => expFn({ data: { ...params, format } }),
    onSuccess: (r) => {
      download(r.dataUrl, r.filename);
      toast.success("Relatório exportado", {
        description: "Registrado no histórico de auditoria.",
      });
    },
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });
  const groups = Array.from(new Set(REPORTS.map((r) => r.group)));
  const needsPerson = def.individual && individual && !person;

  return (
    <>
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <ShieldCheck size={13} /> Somente administradores
        </div>
        <h1 className="mt-1.5 font-display text-[24px] font-black tracking-[-0.03em] text-white">
          Relatórios
        </h1>
        <p className="text-[12.5px] text-white/65">
          Gere, confira na tela e exporte em PDF ou Excel. Cada geração fica registrada na
          auditoria.
        </p>
      </div>

      <div className="glass-soft mt-4 grid gap-3 rounded-[24px] p-4 text-white">
        <select
          className={FIELD}
          value={report}
          onChange={(e) => {
            setReport(e.target.value as ReportKey);
            setResult(null);
          }}
        >
          {groups.map((g) => (
            <optgroup key={g} label={g} className="text-blu">
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <option key={r.key} value={r.key} className="text-blu">
                  {r.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)} className={chip(preset === p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className={FIELD}
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <input
              type="date"
              className={FIELD}
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
        ) : (
          <p className="text-[11.5px] text-white/60">
            {new Date(`${period.from}T12:00:00`).toLocaleDateString("pt-BR")} a{" "}
            {new Date(`${period.to}T12:00:00`).toLocaleDateString("pt-BR")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <select className={FIELD} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="" className="text-blu">
              Todas as empresas
            </option>
            {EMPRESAS.filter((e) => e.key !== "TODAS").map((e) => (
              <option key={e.key} value={e.key} className="text-blu">
                {e.label}
              </option>
            ))}
          </select>
          <select className={FIELD} value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="" className="text-blu">
              Todos os setores
            </option>
            {(opts?.setores ?? []).map((s) => (
              <option key={s} value={s} className="text-blu">
                {s}
              </option>
            ))}
          </select>
          <select className={FIELD} value={cargo} onChange={(e) => setCargo(e.target.value)}>
            <option value="" className="text-blu">
              Todos os cargos
            </option>
            {(opts?.cargos ?? []).map((s) => (
              <option key={s} value={s} className="text-blu">
                {s}
              </option>
            ))}
          </select>
          <select className={FIELD} value={lider} onChange={(e) => setLider(e.target.value)}>
            <option value="" className="text-blu">
              Todos os líderes
            </option>
            {(opts?.lideres ?? []).map((l) => (
              <option key={l.id} value={l.id} className="text-blu">
                {l.full_name}
              </option>
            ))}
          </select>
        </div>

        {def.individual && (
          <div className="grid gap-2">
            <div className="flex gap-1.5">
              <button onClick={() => setIndividual(false)} className={chip(!individual)}>
                Consolidada
              </button>
              <button onClick={() => setIndividual(true)} className={chip(individual)}>
                Individual
              </button>
            </div>
            {individual && (
              <select className={FIELD} value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="" className="text-blu">
                  Escolha a pessoa
                </option>
                {(opts?.pessoas ?? []).map((p) => (
                  <option key={p.id} value={p.id} className="text-blu">
                    {p.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending || needsPerson}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-brand-grad py-3 text-[13px] font-semibold text-white shadow-glow disabled:opacity-50"
          >
            {run.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}{" "}
            Gerar
          </button>
          <button
            onClick={() => exp.mutate("pdf")}
            disabled={exp.isPending || needsPerson}
            className="glass-chip inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold disabled:opacity-50"
          >
            <FileText size={15} /> PDF
          </button>
          <button
            onClick={() => exp.mutate("excel")}
            disabled={exp.isPending || needsPerson}
            className="glass-chip inline-flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold disabled:opacity-50"
          >
            <FileSpreadsheet size={15} /> Excel
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4 grid gap-3 text-white">
          {result.notes.map((n) => (
            <p
              key={n}
              className="rounded-2xl bg-white/[0.06] px-3 py-2 text-[11.5px] text-white/75"
            >
              {n}
            </p>
          ))}
          {result.sections.map((s) => (
            <div key={s.title} className="glass-soft rounded-[24px] p-3">
              <div className="mb-2 px-1 font-display text-[15px] font-black tracking-[-0.02em]">
                {s.title}
              </div>
              {s.note && <p className="mb-2 px-1 text-[11px] text-white/60">{s.note}</p>}
              <div className="max-h-96 overflow-auto">
                <table className="w-full border-collapse text-left text-[11.5px]">
                  <thead className="sticky top-0 bg-[#1b1f5e]">
                    <tr>
                      {s.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.slice(0, 300).map((row, i) => (
                      <tr key={i} className={i % 2 ? "bg-white/[0.04]" : ""}>
                        {row.map((c, j) => (
                          <td key={j} className="px-2 py-1.5 align-top text-white/85">
                            {c ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {s.rows.length === 0 && (
                  <p className="px-2 py-3 text-[12px] text-white/55">
                    Sem registros para este filtro.
                  </p>
                )}
                {s.rows.length > 300 && (
                  <p className="px-2 py-2 text-[11px] text-white/55">
                    Mostrando 300 de {s.rows.length}. O PDF e o Excel trazem tudo.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
