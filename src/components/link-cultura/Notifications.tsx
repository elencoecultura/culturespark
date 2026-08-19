import { useState } from "react";
import { Bell, Loader2, Send, Trash2, CheckCheck, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  broadcastNotification,
  deleteNotification,
} from "@/lib/notifications.functions";
import {
  listNpsSurveys,
  createNpsSurvey,
  closeNpsSurvey,
  getNpsResults,
  getNpsHistory,
} from "@/lib/nps.functions";

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NotificationsBell({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  const unread = q.data?.unread ?? 0;

  const readFn = useServerFn(markNotificationRead);
  const allReadFn = useServerFn(markAllNotificationsRead);
  const delFn = useServerFn(deleteNotification);

  const mRead = useMutation({
    mutationFn: (id: string) => readFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const mAll = useMutation({
    mutationFn: () => allReadFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Notificação removida");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Notificações"
        className="glass-chip relative grid h-10 w-10 place-items-center rounded-2xl text-white/85 transition active:scale-95"
      >
        <Bell size={17} strokeWidth={2.2} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-pink px-1 text-[10px] font-bold text-white shadow-glow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="glass-strong max-h-[85vh] overflow-y-auto rounded-t-[28px] border-white/20 text-white"
        >
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <Sparkles size={16} className="text-pink" />
              Central de recados
            </SheetTitle>
          </SheetHeader>

          <div className="mt-2 flex items-center justify-between px-1 text-[11.5px] text-white/60">
            <span>
              {q.data?.items.length ?? 0} recado{(q.data?.items.length ?? 0) === 1 ? "" : "s"} · {unread} não lido{unread === 1 ? "" : "s"}
            </span>
            {unread > 0 && (
              <button
                onClick={() => mAll.mutate()}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/85 hover:bg-white/20"
              >
                <CheckCheck size={12} /> Marcar tudo
              </button>
            )}
          </div>

          <div className="mt-3 grid gap-2 pb-6">
            {q.isLoading && (
              <div className="grid place-items-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-white/60" />
              </div>
            )}
            {q.data?.items.length === 0 && (
              <div className="glass-chip rounded-2xl p-6 text-center text-[13px] text-white/70">
                Nenhum recado por aqui. Quando o time enviar algo novo, aparece aqui.
              </div>
            )}
            {q.data?.items.map((n) => (
              <div
                key={n.id}
                className={
                  "relative rounded-2xl p-4 transition " +
                  (n.read
                    ? "glass-chip text-white/85"
                    : "border border-white/25 bg-brand-grad text-white shadow-glow")
                }
                onClick={() => !n.read && mRead.mutate(n.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-white" />}
                      <div className="truncate font-display text-[15px] font-bold tracking-[-0.01em]">
                        {n.title}
                      </div>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/90">
                      {n.body}
                    </p>
                    <div className="mt-2 text-[10.5px] uppercase tracking-[0.14em] text-white/60">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmAction("Remover esta notificação para todos?", () => mDel.mutate(n.id));
                      }}
                      className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                      aria-label="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function BroadcastAdminScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const sendFn = useServerFn(broadcastNotification);
  const listFn = useServerFn(listNotifications);
  const delFn = useServerFn(deleteNotification);

  const list = useQuery({ queryKey: ["notifications"], queryFn: () => listFn() });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { title, body } }),
    onSuccess: () => {
      toast.success("Recado enviado", { description: "Todo elenco já vai ver na próxima abertura." });
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error("Não rolou enviar", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const canSend = title.trim().length >= 2 && body.trim().length >= 2 && !send.isPending;

  return (
    <>
      <div className="px-1 pt-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Admin · Comunicação
        </div>
        <h1 className="mt-1.5 font-display text-[28px] font-black leading-[0.95] tracking-[-0.04em] text-white">
          Mandar recado pra todos
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/65">
          Escreva uma mensagem e ela cai no sino de todo o elenco na hora.
        </p>
      </div>

      <div className="glass-strong mt-6 rounded-[26px] p-5">
        <label className="block">
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Título
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Ex: Treinamento amanhã às 14h"
            className="glass-input mt-2 w-full rounded-2xl px-4 py-3.5 text-[14px] text-white outline-none placeholder:text-white/40"
          />
        </label>
        <label className="mt-4 block">
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Mensagem
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="Conta o que rolou, o que precisa acontecer, quando…"
            className="glass-input mt-2 w-full resize-none rounded-2xl p-4 text-[13.5px] leading-relaxed text-white outline-none placeholder:text-white/40"
          />
          <div className="mt-1 text-right text-[10.5px] text-white/50">{body.length}/1000</div>
        </label>
        <button
          onClick={() => send.mutate()}
          disabled={!canSend}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-grad px-5 py-4 text-[15px] font-semibold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50"
        >
          {send.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <Send size={16} /> Enviar pra todo o elenco
            </>
          )}
        </button>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Histórico
          </div>
          <div className="text-[10.5px] text-white/50">
            {list.data?.items.length ?? 0} enviados
          </div>
        </div>
        <div className="grid gap-2">
          {list.data?.items.length === 0 && (
            <div className="glass-chip rounded-2xl p-6 text-center text-[13px] text-white/70">
              Ainda não teve nenhum recado. Manda o primeiro aí em cima.
            </div>
          )}
          {list.data?.items.map((n) => (
            <div key={n.id} className="glass-chip rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[14.5px] font-bold text-white">{n.title}</div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] text-white/75">{n.body}</p>
                  <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.14em] text-white/55">
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    confirmAction("Remover para todos?", () => del.mutate(n.id));
                  }}
                  className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NpsAdminBlock />
    </>
  );
}

function NpsAdminBlock() {
  const listFn = useServerFn(listNpsSurveys);
  const createFn = useServerFn(createNpsSurvey);
  const closeFn = useServerFn(closeNpsSurvey);
  const resultsFn = useServerFn(getNpsResults);
  const historyFn = useServerFn(getNpsHistory);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["nps-surveys"], queryFn: () => listFn() });
  const history = useQuery({ queryKey: ["nps-history"], queryFn: () => historyFn() });
  const [title, setTitle] = useState("Como está sua experiência este mês?");
  const [days, setDays] = useState(2);
  const [openResults, setOpenResults] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const opens = new Date();
      const closes = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return createFn({
        data: {
          title,
          opens_at: opens.toISOString(),
          closes_at: closes.toISOString(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Pesquisa NPS publicada");
      qc.invalidateQueries({ queryKey: ["nps-surveys"] });
      qc.invalidateQueries({ queryKey: ["nps-active"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: (id: string) => closeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Encerrada");
      qc.invalidateQueries({ queryKey: ["nps-surveys"] });
      qc.invalidateQueries({ queryKey: ["nps-active"] });
    },
  });

  const results = useQuery({
    queryKey: ["nps-results", openResults],
    queryFn: () => resultsFn({ data: { survey_id: openResults! } }),
    enabled: !!openResults,
  });

  return (
    <div className="mt-10">
      <div className="mb-3 px-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/60">
          NPS mensal
        </div>
        <h2 className="mt-1 font-display text-[22px] font-black tracking-[-0.03em] text-white">
          Pulse do elenco
        </h2>
      </div>

      <div className="glass-strong rounded-[26px] p-5">
        <label className="block">
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Pergunta principal
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="glass-input mt-2 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Janela (dias)
          </span>
          <input
            type="number"
            min={1}
            max={7}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
            className="glass-input mt-2 w-24 rounded-2xl px-4 py-3 text-[14px] text-white outline-none"
          />
        </label>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || !title.trim()}
          className="mt-4 w-full rounded-2xl bg-brand-grad px-5 py-3 text-[14px] font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {create.isPending ? "Publicando..." : "Publicar pesquisa"}
        </button>
      </div>

      {(history.data?.history.filter((h) => h.total > 0).length ?? 0) > 1 && (
        <div className="mt-4 glass-strong rounded-[26px] p-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Evolução do NPS
          </div>
          <div className="flex items-end gap-2.5 overflow-x-auto pb-1">
            {(history.data?.history ?? [])
              .filter((h) => h.total > 0)
              .map((h) => {
                const pct = ((h.nps ?? 0) + 100) / 2; // -100..100 -> 0..100%
                const color =
                  (h.nps ?? 0) >= 50
                    ? "bg-magic-green"
                    : (h.nps ?? 0) >= 0
                      ? "bg-magic-amber"
                      : "bg-magic-red";
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

      <div className="mt-4 grid gap-2">
        {(list.data ?? []).map((s: any) => {
          const now = Date.now();
          const isActive = s.active && new Date(s.opens_at).getTime() <= now && new Date(s.closes_at).getTime() >= now;
          return (
            <div key={s.id} className="glass-chip rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[14px] font-bold text-white">{s.title}</div>
                  <div className="mt-1 text-[11px] text-white/60">
                    {new Date(s.opens_at).toLocaleDateString("pt-BR")} → {new Date(s.closes_at).toLocaleDateString("pt-BR")}
                    {isActive ? " · ativa" : " · encerrada"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setOpenResults(openResults === s.id ? null : s.id)}
                    className="rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-[11px] hover:bg-white/20"
                  >
                    Resultados
                  </button>
                  {isActive && (
                    <button
                      onClick={() => close.mutate(s.id)}
                      className="rounded-lg bg-magic-red/20 border border-magic-red/30 px-2 py-1 text-[11px] hover:bg-magic-red/30"
                    >
                      Encerrar
                    </button>
                  )}
                </div>
              </div>
              {openResults === s.id && results.data && (
                <div className="mt-3 rounded-xl bg-black/20 p-3 text-white">
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                    <div><div className="text-lg font-bold">{results.data.nps}</div><div className="text-white/60">NPS</div></div>
                    <div><div className="text-lg font-bold text-magic-green">{results.data.promoters}</div><div className="text-white/60">Promotores</div></div>
                    <div><div className="text-lg font-bold text-magic-amber">{results.data.passives}</div><div className="text-white/60">Neutros</div></div>
                    <div><div className="text-lg font-bold text-magic-red">{results.data.detractors}</div><div className="text-white/60">Detratores</div></div>
                  </div>
                  <div className="mt-3 space-y-1 max-h-40 overflow-auto">
                    {(results.data.comments ?? []).filter((c: any) => c.comment).map((c: any, i: number) => (
                      <div key={i} className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px]">
                        <span className="font-bold mr-2">{c.score}</span>{c.comment}
                      </div>
                    ))}
                    {results.data.total === 0 && <div className="text-[12px] text-white/60">Ainda sem respostas.</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {list.data && list.data.length === 0 && (
          <div className="glass-chip rounded-2xl p-6 text-center text-[13px] text-white/70">
            Nenhuma pesquisa NPS ainda.
          </div>
        )}
      </div>
    </div>
  );
}
