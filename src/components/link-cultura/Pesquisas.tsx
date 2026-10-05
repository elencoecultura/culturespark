import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import {
  closeNpsSurvey,
  createNpsSurvey,
  deleteNpsSurvey,
  getNpsHistory,
  getNpsResults,
  listNpsOverview,
} from "@/lib/nps.functions";

type Kind = "nps" | "quiz";

const NPS_DEFAULT_TITLE = "Sua opinião importa";
const NPS_DEFAULT_QUESTION =
  "Em uma escala de 0 a 10, o quanto você recomendaria trabalhar na Hector Studios para um amigo?";
const WINDOW_OPTIONS = [1, 2, 3, 5, 7, 14];
const MAX_QUESTIONS = 16;

// Resultado por pergunta de uma pesquisa: nota média e distribuição de 0 a 10.
// Por padrão só aparece quando há mais de uma pergunta (a tela de resultados
// só-leitura de gerente/direção já mostra o bloco de NPS pra pergunta única);
// `showSingle` mostra também pra pergunta única, `nps` marca a primeira como
// a pergunta do NPS.
export function NpsQuestionStats({
  questions,
  nps = true,
  showSingle = false,
}: {
  questions: Array<{ id: string; text: string; total: number; avg: number | null; histogram: number[] }>;
  nps?: boolean;
  showSingle?: boolean;
}) {
  if (questions.length < (showSingle ? 1 : 2)) return null;
  return (
    <div className="mt-3 space-y-2">
      {questions.map((qu, i) => {
        const max = Math.max(1, ...qu.histogram);
        return (
          <div key={qu.id} className="rounded-lg bg-white/5 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-[12px] leading-snug text-white/85">
                <span className="mr-1.5 font-bold text-white/50">{i + 1}.</span>
                {qu.text}
                {i === 0 && nps && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-white/45">(NPS)</span>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[16px] font-bold leading-none text-white">
                  {qu.avg === null ? "—" : String(qu.avg).replace(".", ",")}
                </div>
                <div className="mt-0.5 text-[10px] text-white/50">média · {qu.total} resp.</div>
              </div>
            </div>
            <div className="mt-2.5 flex items-end gap-0.5">
              {qu.histogram.map((c, n) => (
                <div key={n} className="flex flex-1 flex-col items-center gap-0.5">
                  <div className="flex h-6 w-full items-end overflow-hidden rounded-sm bg-white/10">
                    <div className="w-full bg-pink/70" style={{ height: `${c ? Math.max(12, (c / max) * 100) : 0}%` }} />
                  </div>
                  <div className="text-[8px] text-white/45">{n}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function isLive(s: { active: boolean; opens_at: string; closes_at: string }) {
  const now = Date.now();
  return s.active && new Date(s.opens_at).getTime() <= now && new Date(s.closes_at).getTime() >= now;
}

function dm(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function SurveyResults({ surveyId, kind }: { surveyId: string; kind: Kind }) {
  const resultsFn = useServerFn(getNpsResults);
  const results = useQuery({
    queryKey: ["nps-results", surveyId],
    queryFn: () => resultsFn({ data: { survey_id: surveyId } }),
  });
  if (results.isLoading) {
    return (
      <div className="mt-3 grid place-items-center py-4">
        <Loader2 size={18} className="animate-spin text-white/60" />
      </div>
    );
  }
  const r = results.data;
  if (!r) return <div className="mt-3 text-[12px] text-white/60">Não consegui carregar os resultados.</div>;
  const comments = r.comments.filter((c) => c.comment);
  return (
    <div className="mt-3 rounded-xl bg-black/20 p-3 text-white">
      {kind === "nps" && (
        <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
          <div><div className="text-lg font-bold">{r.nps}</div><div className="text-white/60">NPS</div></div>
          <div><div className="text-lg font-bold text-magic-green">{r.promoters}</div><div className="text-white/60">Promotores</div></div>
          <div><div className="text-lg font-bold text-magic-amber">{r.passives}</div><div className="text-white/60">Neutros</div></div>
          <div><div className="text-lg font-bold text-magic-red">{r.detractors}</div><div className="text-white/60">Detratores</div></div>
        </div>
      )}
      <NpsQuestionStats questions={r.questions} nps={kind === "nps"} showSingle />
      {comments.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Comentários</div>
          <div className="max-h-48 space-y-1 overflow-auto">
            {comments.map((c, i) => (
              <div key={i} className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px]">
                {kind === "nps" && <span className="mr-2 font-bold">{c.score}</span>}
                {c.comment}
              </div>
            ))}
          </div>
        </div>
      )}
      {r.total === 0 && <div className="mt-2 text-center text-[12px] text-white/60">Ainda sem respostas.</div>}
    </div>
  );
}

export function PesquisasAdmin() {
  const qc = useQueryClient();
  const createFn = useServerFn(createNpsSurvey);
  const closeFn = useServerFn(closeNpsSurvey);
  const deleteFn = useServerFn(deleteNpsSurvey);
  const overviewFn = useServerFn(listNpsOverview);
  const historyFn = useServerFn(getNpsHistory);
  const overview = useQuery({ queryKey: ["nps-overview"], queryFn: () => overviewFn() });
  const history = useQuery({ queryKey: ["nps-history"], queryFn: () => historyFn() });

  const [tab, setTab] = useState<"nova" | "acompanhar">("nova");
  const [kind, setKind] = useState<Kind>("nps");
  const [title, setTitle] = useState(NPS_DEFAULT_TITLE);
  const [questions, setQuestions] = useState<string[]>([NPS_DEFAULT_QUESTION]);
  const [days, setDays] = useState(3);
  const [openId, setOpenId] = useState<string | null>(null);

  const cleaned = questions.map((t) => t.trim());
  const hasBlank = cleaned.some((t) => t.length === 0);
  const tooShort = cleaned.some((t) => t.length > 0 && t.length < 5);
  const ready = title.trim().length >= 3 && cleaned.length >= 1 && !hasBlank && !tooShort;
  const surveys = overview.data?.surveys ?? [];
  const eligible = overview.data?.eligible ?? 0;
  const liveNow = surveys.find((s) => isLive(s));
  const closesLabel = dm(new Date(Date.now() + days * 86_400_000).toISOString());

  function pickKind(k: Kind) {
    setKind(k);
    setQuestions((prev) => {
      if (k === "quiz" && prev.length === 1 && prev[0] === NPS_DEFAULT_QUESTION) return ["", ""];
      if (k === "nps" && prev.every((q) => !q.trim())) return [NPS_DEFAULT_QUESTION];
      return prev;
    });
  }

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["nps-overview"] });
    qc.invalidateQueries({ queryKey: ["nps-history"] });
    qc.invalidateQueries({ queryKey: ["nps-surveys"] });
    qc.invalidateQueries({ queryKey: ["nps-active"] });
    qc.invalidateQueries({ queryKey: ["nps-results"] });
  }

  const create = useMutation({
    mutationFn: () => {
      const opens = new Date();
      const closes = new Date(Date.now() + days * 86_400_000);
      const [first, ...rest] = cleaned;
      return createFn({
        data: {
          title: title.trim(),
          question: first,
          extra_questions: rest.length ? rest : undefined,
          kind,
          opens_at: opens.toISOString(),
          closes_at: closes.toISOString(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Pesquisa publicada", { description: "Já aparece no topo do app do elenco." });
      setKind("nps");
      setTitle(NPS_DEFAULT_TITLE);
      setQuestions([NPS_DEFAULT_QUESTION]);
      invalidateAll();
      setTab("acompanhar");
    },
    onError: (e: any) => toast.error("Não rolou publicar", { description: e.message }),
  });

  const close = useMutation({
    mutationFn: (id: string) => closeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Pesquisa encerrada");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_d, id) => {
      toast.success("Pesquisa apagada");
      if (openId === id) setOpenId(null);
      invalidateAll();
    },
    onError: (e: any) => toast.error("Não rolou apagar", { description: e.message }),
  });

  const evolution = (history.data?.history ?? []).filter((h) => h.total > 0);

  return (
    <div className="text-white">
      <div className="mb-4 px-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/60">
          <ClipboardList size={13} /> Pesquisas
        </div>
        <h2 className="mt-1 font-display text-[22px] font-black tracking-[-0.03em] text-white">NPS e questionários</h2>
        <p className="mt-1 text-[12.5px] text-white/60">
          Publique uma pesquisa com uma ou várias perguntas, cada uma com nota de 0 a 10, e acompanhe as respostas do elenco.
        </p>
      </div>

      <div className="mb-4 flex gap-2 px-1">
        {(
          [
            ["nova", "Nova pesquisa"],
            ["acompanhar", `Acompanhar${surveys.length ? ` (${surveys.length})` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition",
              tab === id ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/70",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "nova" && (
        <div className="glass-strong rounded-[26px] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Tipo</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["nps", "NPS", "Pergunta de recomendação + perguntas extras, se quiser. Entra no gráfico de evolução."],
                ["quiz", "Questionário", "Várias perguntas, cada uma com nota de 0 a 10. Sem NPS."],
              ] as const
            ).map(([id, label, desc]) => (
              <button
                key={id}
                type="button"
                onClick={() => pickKind(id)}
                className={cn(
                  "rounded-2xl p-3 text-left transition",
                  kind === id ? "bg-brand-grad shadow-glow" : "glass-chip",
                )}
              >
                <div className="text-[13.5px] font-bold text-white">{label}</div>
                <div className={cn("mt-0.5 text-[11px] leading-snug", kind === id ? "text-white/90" : "text-white/55")}>
                  {desc}
                </div>
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Título (aparece fechado no card)
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-input mt-2 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none"
            />
          </label>

          <div className="mt-4">
            <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Perguntas ({questions.length})
            </span>
            {questions.map((t, i) => (
              <div key={i} className="mt-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    Pergunta {i + 1}
                    {kind === "nps" && i === 0 ? " · conta pro NPS" : ""}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-full p-1.5 text-white/55 transition hover:bg-white/10"
                      aria-label={`Remover pergunta ${i + 1}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <textarea
                  value={t}
                  onChange={(e) => setQuestions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  rows={3}
                  placeholder={kind === "quiz" ? "Ex.: Como você avalia a comunicação da liderança?" : "Texto da pergunta"}
                  className="glass-input mt-1 w-full resize-none rounded-2xl px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/35"
                />
                <div className="ml-1 mt-1 text-[10.5px] text-white/40">Resposta: nota de 0 a 10</div>
              </div>
            ))}
            {questions.length < MAX_QUESTIONS && (
              <button
                type="button"
                onClick={() => setQuestions((prev) => [...prev, ""])}
                className="glass-chip mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold text-white/90"
              >
                <Plus size={15} /> Adicionar pergunta
              </button>
            )}
            {(hasBlank || tooShort) && (
              <p className="ml-1 mt-2 text-[11.5px] text-magic-amber">
                {hasBlank ? "Preencha ou remova as perguntas em branco." : "Cada pergunta precisa de pelo menos 5 letras."}
              </p>
            )}
          </div>

          <div className="mt-4">
            <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Fica aberta por
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {WINDOW_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
                    days === d ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/75",
                  )}
                >
                  {d} dia{d > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <p className="ml-1 mt-2 text-[11.5px] text-white/50">
              Aparece no topo do app de todo o elenco até {closesLabel}.
            </p>
          </div>

          {liveNow && (
            <div className="mt-4 rounded-2xl border border-magic-amber/30 bg-magic-amber/10 px-3.5 py-2.5 text-[12px] leading-snug text-white/85">
              Já tem uma pesquisa no ar ("{liveNow.title}"). Ao publicar esta, só a mais nova aparece pro elenco; encerre a
              outra antes se não quiser perder respostas dela.
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              confirmAction(`Publicar "${title.trim()}" pra todo o elenco?`, () => create.mutate(), {
                confirmLabel: "Publicar",
              })
            }
            disabled={create.isPending || !ready}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-grad px-5 py-3.5 text-[14px] font-semibold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50"
          >
            {create.isPending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <>
                <Send size={15} /> Publicar pesquisa
              </>
            )}
          </button>
        </div>
      )}

      {tab === "acompanhar" && (
        <>
          {evolution.length > 1 && (
            <div className="glass-strong mb-4 rounded-[26px] p-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                Evolução do NPS
              </div>
              <div className="flex items-end gap-2.5 overflow-x-auto pb-1">
                {evolution.map((h) => {
                  const pct = ((h.nps ?? 0) + 100) / 2;
                  const color =
                    (h.nps ?? 0) >= 50 ? "bg-magic-green" : (h.nps ?? 0) >= 0 ? "bg-magic-amber" : "bg-magic-red";
                  return (
                    <div key={h.survey_id} className="flex w-12 shrink-0 flex-col items-center gap-1.5">
                      <div className="text-[12px] font-bold text-white">{h.nps}</div>
                      <div className="h-20 w-full overflow-hidden rounded-lg bg-white/10">
                        <div
                          className={`w-full ${color}`}
                          style={{ height: `${Math.max(4, pct)}%`, marginTop: `${100 - Math.max(4, pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] capitalize text-white/60">{h.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            {overview.isLoading && (
              <div className="grid place-items-center py-8">
                <Loader2 className="animate-spin text-white/60" />
              </div>
            )}
            {surveys.map((s) => {
              const live = isLive(s);
              const nQuestions = s.extra_questions.length + 1;
              const pct = eligible ? Math.min(100, Math.round((s.total / eligible) * 100)) : 0;
              return (
                <div key={s.id} className="glass-chip rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[14px] font-bold text-white">{s.title}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/80">
                          {s.kind === "quiz" ? "Questionário" : "NPS"}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/80">
                          {nQuestions} pergunta{nQuestions > 1 ? "s" : ""}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5",
                            live ? "bg-magic-green/20 text-magic-green" : "bg-white/10 text-white/60",
                          )}
                        >
                          {live ? `No ar até ${dm(s.closes_at)}` : `Encerrada · ${dm(s.opens_at)} a ${dm(s.closes_at)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-[11px] text-white/65">
                      <span>
                        {s.total} de {eligible} responderam
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-brand-grad" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setOpenId(openId === s.id ? null : s.id)}
                      className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] font-semibold hover:bg-white/20"
                    >
                      {openId === s.id ? "Fechar resultados" : "Ver resultados"}
                    </button>
                    {live && (
                      <button
                        onClick={() =>
                          confirmAction(`Encerrar a pesquisa "${s.title}"? Ninguém mais vai conseguir responder.`, () =>
                            close.mutate(s.id),
                          )
                        }
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] font-semibold hover:bg-white/20"
                      >
                        Encerrar
                      </button>
                    )}
                    <button
                      onClick={() =>
                        confirmAction(
                          `Apagar "${s.title}"${
                            s.total ? ` e as ${s.total} resposta${s.total > 1 ? "s" : ""} dela` : ""
                          }? Não dá pra desfazer.`,
                          () => remove.mutate(s.id),
                          { confirmLabel: "Apagar" },
                        )
                      }
                      disabled={remove.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-magic-red/30 bg-magic-red/20 px-3 py-2 text-[12px] font-semibold hover:bg-magic-red/30 disabled:opacity-50"
                    >
                      <Trash2 size={13} /> Apagar
                    </button>
                  </div>

                  {openId === s.id && <SurveyResults surveyId={s.id} kind={s.kind} />}
                </div>
              );
            })}
            {!overview.isLoading && surveys.length === 0 && (
              <div className="glass-chip rounded-2xl p-6 text-center text-[13px] text-white/70">
                Nenhuma pesquisa ainda. Publique a primeira na aba "Nova pesquisa".
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
