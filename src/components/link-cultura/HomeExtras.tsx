import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Star, X } from "lucide-react";
import { getActiveNpsSurvey, submitNpsResponse } from "@/lib/nps.functions";
import { listNotifications } from "@/lib/notifications.functions";

export function NpsBanner() {
  const fn = useServerFn(getActiveNpsSurvey);
  const submit = useServerFn(submitNpsResponse);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["nps-active"], queryFn: () => fn() });
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      submit({ data: { survey_id: q.data!.survey!.id, score: score!, comment: comment || undefined } }),
    onSuccess: () => {
      toast.success("Obrigado pelo seu feedback ✨");
      qc.invalidateQueries({ queryKey: ["nps-active"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    const h = () => {
      setDismissed(false);
      setOpen(true);
    };
    window.addEventListener("open-nps-banner", h);
    return () => window.removeEventListener("open-nps-banner", h);
  }, []);

  if (!q.data?.survey || dismissed) return null;
  const s = q.data.survey;
  const alreadyAnswered = q.data.answered;

  return (
    <div id="nps-banner" className="mt-4 glass-soft rounded-[28px] p-3.5 text-white">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink/25 text-pink">
          <Star size={16} />
        </span>
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
            {alreadyAnswered ? "Você já respondeu" : "Pesquisa rápida"}
          </div>
          <div className="truncate text-[13.5px] font-semibold">{s.title}</div>
        </button>
        {!open && (
          <button onClick={() => setOpen(true)} className="glass-chip shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold">
            {alreadyAnswered ? "Responder de novo" : "Responder"}
          </button>
        )}
        <button onClick={() => setDismissed(true)} className="shrink-0 rounded-full p-1.5 text-white/60 transition hover:bg-white/10" aria-label="Dispensar pesquisa">
          <X size={15} />
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <p className="text-[12.5px] text-white/80">{s.question}</p>
          <div className="mt-2 grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }).map((_, n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={
                  "rounded-lg py-1.5 text-[11px] font-semibold transition " +
                  (score === n ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/75 hover:bg-white/15")
                }
              >
                {n}
              </button>
            ))}
          </div>
          {score !== null && (
            <>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Quer contar por quê? (opcional)"
                rows={2}
                className="glass-input mt-3 w-full resize-none rounded-2xl px-3 py-2 text-[13px] outline-none placeholder:text-white/40"
              />
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="mt-2 w-full rounded-2xl bg-brand-grad py-2.5 text-sm font-semibold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50"
              >
                {mut.isPending ? "Enviando..." : "Enviar resposta"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HomeNotifications({ onSeeAll }: { onSeeAll?: () => void }) {
  const fn = useServerFn(listNotifications);
  const q = useQuery({ queryKey: ["notifs-home"], queryFn: () => fn() });
  const unread = (q.data?.items ?? []).filter((n: any) => !n.read).slice(0, 3);
  if (!q.data || unread.length === 0) return null;
  return (
    <div className="mt-4 glass-soft rounded-[28px] p-4 text-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Bell size={14} /> Notificações ({q.data.unread})
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-[11px] underline text-white/70">
            ver todas
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {unread.map((n: any) => {
          const isNps = /pesquisa|nps|opini[aã]o/i.test(n.title ?? "");
          return (
            <li
              key={n.id}
              onClick={
                isNps
                  ? () => {
                      window.dispatchEvent(new CustomEvent("open-nps-banner"));
                      document.getElementById("nps-banner")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  : undefined
              }
              className={`glass-chip rounded-2xl px-3 py-2 ${isNps ? "cursor-pointer transition hover:bg-white/15" : ""}`}
            >
              <div className="text-[13px] font-semibold">{n.title}</div>
              <div className="text-[11.5px] text-white/70 line-clamp-2">{n.body}</div>
              {isNps && <div className="mt-1 text-[11px] font-semibold text-celeste">Toque pra responder →</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
