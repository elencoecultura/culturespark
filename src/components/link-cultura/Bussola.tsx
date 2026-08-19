import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Lock, RefreshCw, Compass, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDiscStatus, submitDiscTest, listTeamDiscResults } from "@/lib/disc.functions";
import { QUESTIONS, ESSENCES, comboFor, characterFor, type Essence } from "@/lib/disc-content";

type Label = "A" | "B" | "C" | "D";

// Cores por essência (equilíbrio visual, alinhado às convenções DISC + tokens Hector)
const ESSENCE_COLOR: Record<Essence, { text: string; bar: string; dot: string; ring: string }> = {
  D: {
    text: "text-magic-red",
    bar: "bg-magic-red",
    dot: "bg-magic-red",
    ring: "ring-magic-red/60",
  },
  I: {
    text: "text-magic-amber",
    bar: "bg-magic-amber",
    dot: "bg-magic-amber",
    ring: "ring-magic-amber/60",
  },
  S: {
    text: "text-magic-green",
    bar: "bg-magic-green",
    dot: "bg-magic-green",
    ring: "ring-magic-green/60",
  },
  C: { text: "text-celeste", bar: "bg-celeste", dot: "bg-celeste", ring: "ring-celeste/60" },
};
const ORDER: Essence[] = ["D", "I", "S", "C"];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("glass-soft rounded-[32px] p-5 text-white", className)}>{children}</div>
  );
}

const BTN_PRIMARY =
  "flex w-full items-center justify-center gap-2 rounded-full bg-brand-grad px-5 py-3.5 text-[14px] font-bold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50";

type Result = {
  scores: Record<Essence, number>;
  primary: Essence;
  secondary: Essence | null;
  combination: string | null;
  profile_type: string;
};

export default function Bussola({ name }: { name: string }) {
  const statusFn = useServerFn(getDiscStatus);
  const status = useQuery({ queryKey: ["disc-status"], queryFn: () => statusFn() });

  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [answers, setAnswers] = useState<Record<number, Label>>({});
  const [idx, setIdx] = useState(0);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const qc = useQueryClient();
  const submitFn = useServerFn(submitDiscTest);
  const submit = useMutation({
    mutationFn: (payload: {
      answers: { n: number; label: Label }[];
      share_with_leadership: boolean;
    }) => submitFn({ data: payload }),
    onSuccess: (r: any) => {
      setResult({
        scores: r.scores,
        primary: r.primary,
        secondary: r.secondary,
        combination: r.combination,
        profile_type: r.profile_type,
      });
      setPhase("result");
      qc.invalidateQueries({ queryKey: ["disc-status"] });
    },
    onError: (e: any) => toast.error("Não rolou enviar", { description: e.message }),
  });

  function choose(label: Label) {
    const q = QUESTIONS[idx];
    const next = { ...answers, [q.n]: label };
    setAnswers(next);
    if (idx < QUESTIONS.length - 1) {
      setTimeout(() => setIdx((i) => i + 1), 160);
    } else {
      const payload = QUESTIONS.map((qq) => ({ n: qq.n, label: next[qq.n] }));
      submit.mutate({ answers: payload, share_with_leadership: consent });
    }
  }

  function restart() {
    setAnswers({});
    setIdx(0);
    setResult(null);
    setPhase("intro");
  }

  // ---- Resultado a partir do último salvo (quando não elegível) ----
  const lastResult: Result | null = useMemo(() => {
    const l = status.data?.last;
    if (!l) return null;
    return {
      scores: l.scores as Record<Essence, number>,
      primary: l.primary as Essence,
      secondary: (l.secondary as Essence) ?? null,
      combination: l.combination,
      profile_type: l.profile_type,
    };
  }, [status.data]);

  return (
    <>
      <TopBar />
      {phase === "result" && result ? (
        <ResultView result={result} onRestart={status.data?.eligible ? restart : undefined} />
      ) : phase === "quiz" ? (
        <QuizView
          idx={idx}
          answers={answers}
          onChoose={choose}
          onBack={() => (idx === 0 ? setPhase("intro") : setIdx((i) => i - 1))}
          submitting={submit.isPending}
        />
      ) : (
        <IntroView
          name={name}
          loading={status.isLoading}
          status={status.data}
          lastResult={lastResult}
          consent={consent}
          setConsent={setConsent}
          onStart={() => {
            setAnswers({});
            setIdx(0);
            setPhase("quiz");
          }}
          onViewLast={
            lastResult
              ? () => {
                  setResult(lastResult);
                  setPhase("result");
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function TopBar() {
  return (
    <div className="px-1 pt-1">
      <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
        <Compass size={13} /> Bússola das Quatro Essências
      </div>
      <h1 className="mt-1.5 font-display text-[26px] font-black leading-[1.0] tracking-[-0.03em] text-white text-balance">
        Mapeamento comportamental
      </h1>
    </div>
  );
}

/* ---------------- Intro ---------------- */

function EssenceChip({ e }: { e: Essence }) {
  const info = ESSENCES[e];
  const c = ESSENCE_COLOR[e];
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[14px] font-black text-white",
          c.bar,
        )}
      >
        {e}
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold leading-tight">{info.name}</div>
        <div className="text-[11px] text-white/60">{info.dimension}</div>
      </div>
    </div>
  );
}

function IntroView({
  name,
  loading,
  status,
  lastResult,
  consent,
  setConsent,
  onStart,
  onViewLast,
}: {
  name: string;
  loading: boolean;
  status: any;
  lastResult: Result | null;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onStart: () => void;
  onViewLast?: () => void;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </div>
    );
  }

  const eligible = !!status?.eligible;
  const unlockInDays = status?.unlockInDays ?? 0;
  const cooldownDays = status?.cooldownDays ?? 0;
  const character = lastResult ? characterFor(lastResult.primary, lastResult.secondary) : null;

  return (
    <div className="mt-5 space-y-4">
      {lastResult && onViewLast && (
        <button onClick={onViewLast} className="block w-full text-left">
          <Card className="border border-white/15">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-[15px] font-black text-white",
                  ESSENCE_COLOR[lastResult.primary].bar,
                )}
              >
                {lastResult.primary}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  Seu resultado salvo
                </div>
                <div className="font-display text-[15px] font-black tracking-[-0.01em]">
                  {ESSENCES[lastResult.primary].name}
                  {lastResult.secondary ? ` + ${ESSENCES[lastResult.secondary].name}` : ""}
                </div>
                {character && <div className="text-[12px] text-white/70">{character.name}</div>}
              </div>
              <ChevronRight size={18} className="shrink-0 text-white/50" />
            </div>
          </Card>
        </button>
      )}

      <Card>
        <p className="text-[13.5px] leading-relaxed text-white/85">
          Toda grande jornada reúne pessoas que pensam, decidem, comunicam e enfrentam desafios de
          maneiras diferentes, {name || "elenco"}. A Bússola identifica quais comportamentos
          aparecem com mais naturalidade em você.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {ORDER.map((e) => (
            <EssenceChip key={e} e={e} />
          ))}
        </div>
        <p className="mt-4 text-[12px] text-white/60">
          Não existem respostas certas ou erradas. Responda como você realmente costuma agir, não
          como acha que deveria.
          <br />
          Tempo estimado: 5 a 7 minutos.
        </p>
      </Card>

      {!eligible && unlockInDays > 0 && (
        <Card className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white/70">
            <Lock size={18} />
          </span>
          <div>
            <div className="font-display text-[15px] font-black">
              Abre em {unlockInDays} dia{unlockInDays > 1 ? "s" : ""}
            </div>
            <div className="text-[12px] text-white/65">
              A Bússola libera uma semana após seu primeiro acesso.
            </div>
          </div>
        </Card>
      )}

      {!eligible && unlockInDays === 0 && cooldownDays > 0 && (
        <Card className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white/70">
            <RefreshCw size={18} />
          </span>
          <div>
            <div className="font-display text-[15px] font-black">Você já respondeu este ano</div>
            <div className="text-[12px] text-white/65">
              Poderá refazer em {cooldownDays} dia{cooldownDays > 1 ? "s" : ""}. Seu resultado está
              salvo acima.
            </div>
          </div>
        </Card>
      )}

      {eligible && (
        <>
          <label className="flex cursor-pointer items-start gap-3 px-1">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-pink"
            />
            <span className="text-[12.5px] leading-snug text-white/75">
              Autorizo compartilhar meu resultado com a liderança da Hector (opcional).
            </span>
          </label>
          <button onClick={onStart} className={BTN_PRIMARY}>
            <Sparkles size={16} /> Iniciar minha jornada
          </button>
        </>
      )}

      <p className="px-1 text-[10.5px] leading-relaxed text-white/40">
        Instrumento interno de autopercepção inspirado no modelo DISC. Não é diagnóstico psicológico
        nem deve ser usado isoladamente para decisões de RH.
      </p>
    </div>
  );
}

/* ---------------- Quiz ---------------- */

function QuizView({
  idx,
  answers,
  onChoose,
  onBack,
  submitting,
}: {
  idx: number;
  answers: Record<number, "A" | "B" | "C" | "D">;
  onChoose: (l: "A" | "B" | "C" | "D") => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const q = QUESTIONS[idx];
  const total = QUESTIONS.length;
  const selected = answers[q.n];
  const pct = Math.round(((idx + (selected ? 1 : 0)) / total) * 100);

  if (submitting) {
    return (
      <div className="mt-16 grid place-items-center gap-3 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-white/70" />
        <div className="font-display text-[16px] font-black">Calculando sua bússola…</div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="glass-chip grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-95"
          aria-label="Voltar"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-white/60">
            <span>
              Pergunta {idx + 1} de {total}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full bg-gradient-to-r from-celeste via-white to-pink transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-1">
        <h2 className="font-display text-[19px] font-black leading-[1.2] tracking-[-0.02em] text-white text-balance">
          {q.prompt}
        </h2>
      </div>

      <div className="mt-4 grid gap-2.5">
        {q.options.map((o) => {
          const on = selected === o.label;
          return (
            <button
              key={o.label}
              onClick={() => onChoose(o.label)}
              className={cn(
                "flex items-center gap-3 rounded-[22px] border p-4 text-left transition active:scale-[0.99]",
                on
                  ? "border-white/40 bg-brand-grad text-white shadow-glow"
                  : "glass-soft border-transparent text-white/90 hover:bg-white/12",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[13px] font-black",
                  on ? "bg-white/25" : "glass-chip",
                )}
              >
                {o.label}
              </span>
              <span className="text-[13.5px] leading-snug">{o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Resultado ---------------- */

function pctOf(score: number) {
  return Math.round((score / 24) * 1000) / 10; // 1 casa decimal
}

function ResultView({ result, onRestart }: { result: Result; onRestart?: () => void }) {
  const { scores, primary, secondary, combination, profile_type } = result;
  const info = ESSENCES[primary];
  const secInfo = secondary ? ESSENCES[secondary] : null;
  const combo = secondary ? comboFor(primary, secondary) : null;
  const character = characterFor(primary, secondary);
  const maxScore = Math.max(...ORDER.map((e) => scores[e]));

  return (
    <div className="mt-5 space-y-4">
      {/* Barras — as quatro essências com peso visual igual */}
      <Card>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
          Sua bússola comportamental
        </div>
        <div className="grid gap-3">
          {ORDER.map((e) => {
            const c = ESSENCE_COLOR[e];
            const p = pctOf(scores[e]);
            return (
              <div key={e}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                    {ESSENCES[e].name}
                  </span>
                  <span className="text-white/70">
                    {scores[e]} · {p.toString().replace(".", ",")}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/12">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-700", c.bar)}
                    style={{ width: `${(scores[e] / (maxScore || 1)) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Essência principal */}
      <Card className="border border-white/20 bg-brand-grad shadow-glass">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/75">
          Sua essência principal
        </div>
        <div className="mt-1 font-display text-[30px] font-black leading-none tracking-[-0.03em]">
          {info.name}
        </div>
        <div className="mt-1 text-[12.5px] text-white/80">
          {pctOf(scores[primary]).toString().replace(".", ",")}% da sua bússola · {info.dimension}
        </div>
        <p className="mt-3 font-display text-[15px] font-bold leading-snug">“{info.phrase}”</p>
      </Card>

      {character && (
        <Card className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 font-display text-[15px] font-black">
            {character.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Seu personagem-espírito
            </div>
            <div className="font-display text-[18px] font-black tracking-[-0.02em]">
              {character.name}
            </div>
            <div className="text-[11.5px] text-white/65">
              Mesma bússola comportamental que você ({character.profile})
            </div>
          </div>
        </Card>
      )}

      {profile_type === "versatil" && (
        <Card>
          <div className="font-display text-[16px] font-black">
            Sua bússola revela um Perfil Versátil.
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/75">
            Você adapta seu comportamento a diferentes ambientes e necessidades. Essa flexibilidade
            é uma força, mas exige atenção para que suas escolhas não sejam guiadas apenas pelas
            expectativas das outras pessoas.
          </p>
        </Card>
      )}

      {profile_type === "dupla" && secInfo && (
        <Card>
          <div className="font-display text-[16px] font-black">
            Sua bússola aponta para uma Essência Dupla.
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/75">
            Você combina duas forças muito presentes ({info.name} e {secInfo.name}). Dependendo da
            missão, do ambiente e das pessoas ao seu redor, uma delas pode assumir a liderança.
          </p>
        </Card>
      )}

      {/* Secundária + combinação */}
      {secInfo && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Secundária
            </div>
            <div className="mt-1 font-display text-[18px] font-black">{secInfo.name}</div>
            <div className="text-[11.5px] text-white/65">
              {pctOf(scores[secondary!]).toString().replace(".", ",")}%
            </div>
          </Card>
          {combo && (
            <Card>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
                Combinação
              </div>
              <div className="mt-1 font-display text-[16px] font-black leading-tight">
                {combo.name}
              </div>
            </Card>
          )}
        </div>
      )}

      {combo && (
        <Card>
          <p className="text-[13px] leading-relaxed text-white/85">{combo.desc}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-magic-amber">
            Atenção: {combo.atencao}
          </p>
        </Card>
      )}

      <ResultList title="Seus poderes naturais" items={info.forcas.slice(0, 5)} tone="green" />
      <ResultList title="Seus pontos de atenção" items={info.atencao.slice(0, 4)} tone="amber" />
      <ResultList title="O que potencializa sua atuação" items={info.ativadores} tone="celeste" />

      <Card>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
          Sua próxima missão
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">{info.missao}</p>
      </Card>

      <Card>
        <p className="text-[13px] leading-relaxed text-white/80">
          Sua essência não define tudo o que você é. Ela revela tendências que podem mudar conforme
          o ambiente, a confiança, a responsabilidade e os desafios da jornada. Conhecer sua bússola
          ajuda a usar suas forças com mais consciência e a construir relações melhores dentro da
          Hector Studios.
        </p>
      </Card>

      {onRestart && (
        <button
          onClick={onRestart}
          className="glass-chip flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold text-white transition hover:bg-white/15"
        >
          <RefreshCw size={15} /> Refazer a jornada
        </button>
      )}
    </div>
  );
}

function ResultList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber" | "celeste";
}) {
  const color =
    tone === "green" ? "text-magic-green" : tone === "amber" ? "text-magic-amber" : "text-celeste";
  return (
    <Card>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {title}
      </div>
      <ul className="grid gap-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[13px] text-white/85">
            <Check size={15} className={cn("mt-0.5 shrink-0", color)} /> {it}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Admin: Bússola do time ---------------- */

export function BussolaAdmin() {
  const fn = useServerFn(listTeamDiscResults);
  const { data, isLoading } = useQuery({ queryKey: ["disc-team"], queryFn: () => fn() });
  const rows = data?.rows ?? [];
  const dist = data?.distribution ?? { D: 0, I: 0, S: 0, C: 0 };
  const maxDist = Math.max(1, ...ORDER.map((e) => dist[e]));

  return (
    <>
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <Compass size={13} /> Bússola do time
        </div>
        <h1 className="mt-1.5 font-display text-[24px] font-black tracking-[-0.03em] text-white">
          Mapa comportamental
        </h1>
        <p className="text-[12.5px] text-white/65">
          Resultados de quem autorizou compartilhar com a liderança.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                Distribuição por essência
              </div>
              <div className="text-[12px] text-white/70">{data?.total ?? 0} pessoas</div>
            </div>
            <div className="grid gap-3">
              {ORDER.map((e) => {
                const c = ESSENCE_COLOR[e];
                const v = dist[e];
                return (
                  <div key={e}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                        {ESSENCES[e].name}
                      </span>
                      <span className="text-white/70">{v}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/12">
                      <div
                        className={cn("h-full rounded-full", c.bar)}
                        style={{ width: `${(v / maxDist) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {(data?.versatile ?? 0) > 0 && (
              <div className="mt-3 text-[12px] text-white/60">
                {data?.versatile} com Perfil Versátil.
              </div>
            )}
          </Card>

          {(data?.byAttraction ?? []).length > 0 && (
            <Card>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                Perfil predominante por casa
              </div>
              <div className="grid gap-2">
                {(data?.byAttraction ?? []).map((b) => {
                  const c = ESSENCE_COLOR[b.predominant as Essence];
                  return (
                    <div
                      key={b.attraction}
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5"
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[12px] font-black text-white",
                          c.bar,
                        )}
                      >
                        {b.predominant}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-white">
                          {b.attraction}
                        </div>
                        <div className="truncate text-[11px] text-white/60">
                          {b.predominantLabel} predominante · {b.total} pessoa
                          {b.total === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="grid gap-2">
            {rows.map((r) => {
              const c = ESSENCE_COLOR[r.primary as Essence];
              return (
                <Card key={r.user_id} className="flex items-center gap-3 p-4">
                  <span
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-[14px] font-black text-white",
                      c.bar,
                    )}
                  >
                    {r.primary}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[15px] font-black tracking-[-0.02em]">
                      {r.name}
                    </div>
                    <div className="truncate text-[11.5px] text-white/65">
                      {ESSENCES[r.primary as Essence].name}
                      {r.secondary ? ` + ${ESSENCES[r.secondary as Essence].name}` : ""}
                      {r.combination ? ` · ${r.combination}` : ""}
                      {r.attraction ? ` · ${r.attraction}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-white/45">
                    {new Date(r.taken_at).toLocaleDateString("pt-BR")}
                  </span>
                </Card>
              );
            })}
            {rows.length === 0 && (
              <div className="glass-chip rounded-2xl px-4 py-3 text-[13px] text-white/70">
                Ninguém autorizou compartilhar o resultado ainda.
              </div>
            )}
          </div>

          <p className="px-1 text-[10.5px] leading-relaxed text-white/40">
            Autopercepção comportamental — usar para desenvolvimento e integração, nunca
            isoladamente para decisões de contratação, promoção ou desligamento.
          </p>
        </div>
      )}
    </>
  );
}
