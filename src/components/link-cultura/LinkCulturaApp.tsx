import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MoreHorizontal, Compass, Briefcase, Wifi, Plus, BarChart3, Cake, PartyPopper, Gift } from "lucide-react";
import {
  Home,
  Heart,
  CalendarDays,
  MessageCircle,
  Users,
  Sparkles,
  ChevronRight,
  Flame,
  TrendingUp,
  Check,
  Send,
  AlertTriangle,
  LogOut,
  LifeBuoy,
  UserPlus,
  Loader2,
  Trophy,
  Medal,
  Award,
  Star,
  Lock,
  Sun,
  Mic,
  Square,
  Image as ImageIcon,
  X,
  Trash2,
  Play,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LiquidBackground from "./LiquidBackground";
import BottomSheetModal from "./BottomSheetModal";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { submitMood, listMyMoods, sendKudos, listKudos, leaderOverview } from "@/lib/engagement.functions";
import { listWeekBirthdays } from "@/lib/birthdays.functions";
import { getDiscStatus } from "@/lib/disc.functions";
import Bussola, { BussolaAdmin } from "./Bussola";
import WellbeingAdmin from "./WellbeingAdmin";
import FlaggedKudosAdmin from "./FlaggedKudosAdmin";
import { SUPREME_EMAILS } from "@/lib/wellbeing.functions";
import { HeartCrack, Flag } from "lucide-react";
import { listUsers, createUser, updateUser } from "@/lib/admin.functions";
import { listWeekSchedule, upsertSchedule, ATTRACTIONS } from "@/lib/schedule.functions";
import {
  getMyGamification,
  getAttractionLeaderboard,
  markScheduleCompleted,
  BADGES,
  POINT_RULES,
} from "@/lib/gamification.functions";
import { createIluminari, listIluminari, deleteIluminari } from "@/lib/iluminari.functions";
import { copyPreviousWeek, listMyAbsences, registerAbsence, listTodayCheckins } from "@/lib/absences.functions";
import JobsScreen from "./JobsScreen";
import { listAllowedIps, addAllowedIp, removeAllowedIp, listBypassUsers, setWifiBypass } from "@/lib/wifi.functions";
import PreRegistrationsAdmin from "./PreRegistrationsAdmin";
import GamificationCycleAdmin from "./GamificationCycleAdmin";
import GamificationAnalyticsAdmin from "./GamificationAnalyticsAdmin";
import { BusinessProvider } from "./BusinessContext";
import BusinessSelector from "./BusinessSelector";
import { getDailyPhrase, getPillar } from "@/lib/culture-content";
import { NotificationsBell, BroadcastAdminScreen } from "./Notifications";
import { NpsBanner, HomeNotifications } from "./HomeExtras";




/* ---------- Helpers ---------- */
const WHATSAPP_URL =
  "https://wa.me/5554999238746?text=" +
  encodeURIComponent("Oi Hector, preciso de ajuda agora.");

const DAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

/* Nomes temáticos por nível (index = nível - 1), casando com levelFromXp */
const LEVEL_NAMES = [
  "Aprendiz",
  "Guardião",
  "Encantador",
  "Mago",
  "Arcano",
  "Lenda",
  "Mestre",
  "Hector",
] as const;

function levelName(level: number) {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] ?? "Aprendiz";
}

function getWeekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0=Mon
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function fmtWeek(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(d)} → ${fmt(end)}`;
}

/* ---------- Primitives ---------- */

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">{children}</div>;
}
function Title({ children }: { children: ReactNode }) {
  return <h1 className="mt-1.5 font-display text-[28px] font-black leading-[0.95] tracking-[-0.04em] text-white text-balance">{children}</h1>;
}
function Subtitle({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[13px] leading-relaxed text-white/65">{children}</p>;
}
function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 px-1">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/60">{children}</div>
      {action}
    </div>
  );
}

function GlassCard({
  children,
  className,
  variant = "glass",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  variant?: "glass" | "blue" | "pink" | "brand";
  onClick?: () => void;
}) {
  const map = {
    glass: "glass-soft text-white",
    blue: "border border-white/20 bg-blue-grad text-white shadow-glass",
    pink: "border border-white/25 bg-pink-grad text-white shadow-glass",
    brand: "border border-white/30 bg-brand-grad text-white shadow-glass",
  } as const;
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={cn("relative w-full overflow-hidden rounded-[32px] p-5 text-left transition active:scale-[0.99]", map[variant], className)}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/18 to-transparent" />
      <span className="relative block">{children}</span>
    </Tag>
  );
}

function MetricCard({ label, value, sub, icon: Icon, variant = "glass" as const, onClick }: { label: string; value: string; sub: string; icon: LucideIcon; variant?: "glass" | "blue" | "pink" | "brand"; onClick?: () => void }) {
  return (
    <GlassCard variant={variant} className="p-[18px]" onClick={onClick}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
        <span className="truncate">{label}</span>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="mt-4 font-display text-[34px] font-black leading-[0.9] tracking-[-0.04em] text-white">{value}</div>
      <div className="mt-1.5 text-[12px] leading-snug text-white/70">{sub}</div>
    </GlassCard>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="glass-chip rounded-2xl p-4 text-[13px] leading-snug text-white/75">{children}</div>;
}

function TopBar({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="px-1 pt-1">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <Subtitle>{subtitle}</Subtitle>
    </div>
  );
}

/* ---------- Header ---------- */

function AppHeader({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="mb-4 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">Por trás da Magia</div>
        <div className="truncate font-display text-[15px] font-bold text-white">Oi, {name || "elenco"}</div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsBell isAdmin={isAdmin} />
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="SOS Hector via WhatsApp"
          className="glass-chip relative grid h-10 w-10 place-items-center rounded-2xl text-pink transition active:scale-95"
        >
          <LifeBuoy size={18} strokeWidth={2.2} />
          <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-pink/70" />
        </a>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login" });
          }}
          aria-label="Sair"
          className="glass-chip grid h-10 w-10 place-items-center rounded-2xl text-white/80 transition active:scale-95"
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

/* ---------- Screens ---------- */

const TILE_VARIANT = {
  glass: "glass-soft text-white",
  blue: "border border-white/20 bg-blue-grad text-white shadow-glass",
  pink: "border border-white/25 bg-pink-grad text-white shadow-glass",
  brand: "border border-white/30 bg-brand-grad text-white shadow-glass",
} as const;

// Tile flexível (os filhos são diretos, então flex/justify funcionam de verdade)
function Tile({
  variant = "glass",
  className,
  onClick,
  href,
  children,
}: {
  variant?: keyof typeof TILE_VARIANT;
  className?: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls = cn(
    "relative overflow-hidden rounded-[28px] p-4 text-left transition active:scale-[0.99]",
    TILE_VARIANT[variant],
    className,
  );
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

// Anel circular de sequência de check-ins
function StreakRing({ value }: { value: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, (value / 7) * 100);
  const off = c - (pct / 100) * c;
  return (
    <div className="relative grid h-[96px] w-[96px] shrink-0 place-items-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="url(#streakgrad)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-500" />
        <defs>
          <linearGradient id="streakgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6ad1e3" />
            <stop offset="100%" stopColor="#e451f5" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center leading-none">
        <div className="font-display text-[28px] font-black">{value}</div>
        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">dias</div>
      </div>
    </div>
  );
}

// Medidor de energia 1–5 (círculos que preenchem como uma barra)
function EnergyScale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  const MOODS = [
    { n: 1, label: "Baixo" },
    { n: 2, label: "Frágil" },
    { n: 3, label: "Firme" },
    { n: 4, label: "Bem" },
    { n: 5, label: "Voando" },
  ];
  return (
    <div className="mt-5 flex items-end justify-between gap-1.5">
      {MOODS.map((mo) => {
        const active = value === mo.n;
        const filled = value != null && mo.n <= value;
        return (
          <button
            key={mo.n}
            onClick={() => onChange(mo.n)}
            className="flex flex-1 flex-col items-center gap-1.5"
            aria-label={`${mo.n} — ${mo.label}`}
          >
            <span
              className={cn(
                "grid place-items-center rounded-full font-display font-black transition-all duration-200",
                active
                  ? "h-12 w-12 scale-105 bg-white text-blu shadow-glow ring-2 ring-celeste/70"
                  : filled
                    ? "h-11 w-11 bg-white/45 text-white"
                    : "glass-chip h-11 w-11 text-white/70",
              )}
            >
              {mo.n}
            </span>
            <span className={cn("text-[10px] font-medium leading-none", active ? "text-white" : "text-white/60")}>{mo.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Check-in de energia inline (substitui a antiga aba Humor)
function EnergyCheckin({ name, streak }: { name: string; streak: number }) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitMood);
  const [mood, setMood] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const m = useMutation({
    mutationFn: () => submitFn({ data: { mood: mood! } }),
    onSuccess: () => {
      toast.success("Check-in registrado", { description: "Obrigado por cuidar do clima." });
      setDone(true);
      qc.invalidateQueries({ queryKey: ["moods"] });
      qc.invalidateQueries({ queryKey: ["gamification"] });
    },
    onError: (e: any) => toast.error("Não rolou registrar", { description: e.message }),
  });
  return (
    <section className="px-1">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{greet}, {name || "elenco"}</div>
          <h1 className="mt-1.5 font-display text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-white text-balance">
            {done ? "Energia registrada!" : "Como está sua energia?"}
          </h1>
        </div>
        <StreakRing value={streak} />
      </div>

      {done ? (
        <div className="glass-chip mt-5 inline-flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold text-white">
          <Check size={16} className="text-magic-green" /> Valeu por cuidar do clima. Até amanhã.
        </div>
      ) : (
        <>
          <EnergyScale value={mood} onChange={setMood} />
          <button
            onClick={() => m.mutate()}
            disabled={mood == null || m.isPending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-grad px-5 py-3.5 text-[14px] font-bold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50"
          >
            {m.isPending ? <Loader2 size={17} className="animate-spin" /> : mood == null ? "Escolha de 1 a 5" : "Registrar check-in"}
          </button>
        </>
      )}
    </section>
  );
}

// Nudge na Home quando a Bússola das Essências está liberada (1 semana após 1º login / 1x ano)
function DiscBanner({ go }: { go: (id: TabId) => void }) {
  const fn = useServerFn(getDiscStatus);
  const { data } = useQuery({ queryKey: ["disc-status"], queryFn: () => fn() });
  if (!data?.eligible) return null;
  const first = !data.hasEver;
  return (
    <div className="mt-4">
      <GlassCard variant="pink" onClick={() => go("bussola")} className="overflow-hidden">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/25"><Compass size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/75">Nova jornada</div>
            <div className="font-display text-[15px] font-black tracking-[-0.01em]">
              {first ? "Descubra sua Bússola das Essências" : "Refaça sua Bússola das Essências"}
            </div>
            <div className="text-[12px] text-white/85">Mapeamento comportamental · 5–7 min</div>
          </div>
          <ChevronRight size={18} className="text-white/80" />
        </div>
      </GlassCard>
    </div>
  );
}

function HomeScreen({ name, go, isAdmin, isLeader }: { name: string; go: (id: TabId) => void; isAdmin: boolean; isLeader: boolean }) {
  const fn = useServerFn(listMyMoods);
  const { data: moods } = useQuery({ queryKey: ["moods", "me"], queryFn: () => fn() });
  const streak = moods?.length ?? 0;
  const phrase = getDailyPhrase();
  const pillar = getPillar(phrase.pillar);
  return (
    <>
      {/* Hero — check-in de energia inline, sem card */}
      <div className="mt-3">
        <EnergyCheckin name={name} streak={streak} />
      </div>

      {/* Frase do dia — tratamento editorial */}
      <div className="mt-7">
        <GlassCard>
          <div className="flex gap-3">
            <span aria-hidden className="font-display text-[46px] leading-[0.7] text-celeste/60">“</span>
            <div className="min-w-0">
              <p className="font-display text-[17px] font-bold leading-[1.32] tracking-[-0.01em]">{phrase.text}</p>
              <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">{pillar.name}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      <NpsBanner />
      <DiscBanner go={go} />
      <HomeNotifications />

      {/* Atalhos — grade bento assimétrica */}
      <div className="mt-6">
        <SectionTitle>Atalhos</SectionTitle>
        <div className="grid grid-cols-2 gap-3" style={{ gridAutoRows: "84px" }}>
          <Tile variant="pink" onClick={() => go("iluminari")} className="row-span-2 flex flex-col justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/25"><Sun size={20} /></span>
            <div>
              <div className="text-[14.5px] font-semibold leading-tight tracking-[-0.01em]">Momento Iluminari</div>
              <div className="mt-1 text-[11.5px] text-white/85">Registre um brilho do dia</div>
            </div>
          </Tile>
          <Tile variant="blue" onClick={() => go("schedule")} className="flex flex-col justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20"><CalendarDays size={18} /></span>
            <div className="text-[14px] font-semibold leading-tight tracking-[-0.01em]">Roteiro</div>
          </Tile>
          <Tile onClick={() => go("feedback")} className="flex flex-col justify-between">
            <span className="glass-chip grid h-10 w-10 place-items-center rounded-full"><MessageCircle size={18} /></span>
            <div className="text-[14px] font-semibold leading-tight tracking-[-0.01em]">Mandar um elogio</div>
          </Tile>
          {isLeader && (
            <Tile href="/avaliacoes" className="col-span-2 flex items-center gap-3">
              <span className="glass-chip grid h-11 w-11 place-items-center rounded-full"><Star size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold tracking-[-0.01em]">Avaliações</div>
                <div className="text-[11.5px] text-white/65">Sua evolução e a do time</div>
              </div>
              <ChevronRight size={18} className="text-white/50" />
            </Tile>
          )}
          {isAdmin && (
            <Tile variant="brand" onClick={() => go("broadcast")} className="col-span-2 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/25"><Send size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold tracking-[-0.01em]">Enviar recado</div>
                <div className="text-[11.5px] text-white/85">Notificar todo o elenco</div>
              </div>
              <ChevronRight size={18} className="text-white/70" />
            </Tile>
          )}
        </div>
      </div>
    </>
  );
}

function FeedbackScreen({ canSend }: { canSend: boolean }) {
  const [tab, setTab] = useState<"send" | "inbox">(canSend ? "send" : "inbox");
  const [to, setTo] = useState<string>("");
  const [msg, setMsg] = useState("");
  const qc = useQueryClient();

  const usersFn = useServerFn(listUsers);
  const { data: people } = useQuery({ queryKey: ["users"], queryFn: () => usersFn() });
  const kudosFn = useServerFn(listKudos);
  const { data: kudos } = useQuery({ queryKey: ["kudos"], queryFn: () => kudosFn() });

  const send = useServerFn(sendKudos);
  const m = useMutation({
    mutationFn: () => send({ data: { to_user: to, message: msg } }),
    onSuccess: () => {
      toast.success("Elogio enviado", { description: "Pequenos gestos sustentam a cultura." });
      setMsg("");
      qc.invalidateQueries({ queryKey: ["kudos"] });
      qc.invalidateQueries({ queryKey: ["gamification"] });
    },
    onError: (e: any) => toast.error("Falhou", { description: e.message }),
  });

  const nameById = useMemo(
    () => new Map((people ?? []).map((p) => [p.id, p.full_name || "Sem nome"])),
    [people],
  );

  return (
    <>
      <TopBar eyebrow="Elogio Rápido" title="Reconhecer faz girar" subtitle="Pequenos gestos sustentam a cultura." />
      {canSend && (
        <div className="glass-soft mt-5 grid grid-cols-2 gap-1 rounded-full p-1">
          {(["send", "inbox"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn("rounded-full py-2.5 text-[12.5px] font-medium transition", tab === id ? "bg-white text-blu shadow-glow" : "text-white/70")}
            >
              {id === "send" ? "Mandar" : "Recebidos"}
            </button>
          ))}
        </div>
      )}
      {tab === "send" ? (
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="ml-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/70">Para quem</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="glass-input mt-2 w-full rounded-2xl px-4 py-3.5 text-[14px] text-white outline-none">
              <option value="" className="text-blu">Escolha alguém</option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id} className="text-blu">
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Conta o que rolou de bom…"
            className="glass-input min-h-[110px] w-full resize-none rounded-2xl p-4 text-[13.5px] outline-none placeholder:text-white/40"
          />
          <button
            onClick={() => m.mutate()}
            disabled={!to || msg.length < 2 || m.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-grad px-5 py-4 text-[15px] font-semibold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-50"
          >
            {m.isPending ? <Loader2 size={18} className="animate-spin" /> : <>Mandar elogio <Send size={16} /></>}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {(kudos ?? []).length === 0 && <Notice>Nada por aqui ainda. Quando alguém te reconhecer, aparece.</Notice>}
          {(kudos ?? []).map((k) => (
            <GlassCard key={k.id}>
              <div className="text-[12px] uppercase tracking-[0.14em] text-white/55">
                de {nameById.get(k.from_user) ?? "alguém"} → {nameById.get(k.to_user) ?? "alguém"}
              </div>
              <div className="mt-2 text-[14px] text-white">{k.message}</div>
              <div className="mt-2 text-[11px] text-white/45">{new Date(k.created_at).toLocaleString("pt-BR")}</div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}

function JourneyScreen({ myUserId }: { myUserId: string }) {
  return (
    <>
      <TopBar eyebrow="Sua jornada" title="Escada pra magia" subtitle="Segurança, Alegria, Imersão e Eficiência." />
      <MyJourney myUserId={myUserId} />
    </>
  );
}

// Anel de nível reutilizável (Jornada / Pontos)
function LevelRing({ level, pct }: { level: number; pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative grid h-[80px] w-[80px] shrink-0 place-items-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="url(#levelgrad)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-500" />
        <defs>
          <linearGradient id="levelgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6ad1e3" />
            <stop offset="100%" stopColor="#e451f5" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center leading-none">
        <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/70">nível</div>
        <div className="font-display text-[24px] font-black">{level}</div>
      </div>
    </div>
  );
}

function MyJourney({ myUserId }: { myUserId: string }) {
  const qc = useQueryClient();
  const week = getWeekStart();
  const nextWeek = useMemo(() => {
    const d = new Date(week + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [week]);

  const listFn = useServerFn(listWeekSchedule);
  const { data: rows } = useQuery({
    queryKey: ["schedule", week],
    queryFn: () => listFn({ data: { week_start: week } }),
  });
  const mine = (rows ?? []).find((r) => r.user_id === myUserId);

  const copyFn = useServerFn(copyPreviousWeek);
  const copyMut = useMutation({
    mutationFn: () => copyFn({ data: { target_week: nextWeek } }),
    onSuccess: () => {
      toast.success("Semana copiada", { description: fmtWeek(nextWeek) });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (e: any) => {
      const map: Record<string, string> = {
        week_already_exists: "Já existe uma escala para a próxima semana.",
        no_previous_week: "Você ainda não tem uma escala anterior para copiar.",
      };
      toast.error("Não foi possível copiar", { description: map[e.message] ?? e.message });
    },
  });

  const absencesFn = useServerFn(listMyAbsences);
  const { data: absences } = useQuery({
    queryKey: ["absences", "me"],
    queryFn: () => absencesFn(),
  });

  const gamiFn = useServerFn(getMyGamification);
  const { data: gami } = useQuery({ queryKey: ["gamification", "me"], queryFn: () => gamiFn() });
  const totalXp = gami?.totalXp ?? 0;
  const lvl = levelFromXp(totalXp);
  const toNext = Math.max(0, lvl.next - totalXp);
  const atMax = lvl.next === lvl.cur;

  const [absOpen, setAbsOpen] = useState(false);

  return (
    <>
      <div className="mt-5">
        <GlassCard variant="blue">
          <div className="flex items-center gap-4">
            <LevelRing level={lvl.level} pct={lvl.pct} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-[20px] font-black tracking-[-0.03em]">{levelName(lvl.level)}</div>
              <div className="mt-0.5 text-[12.5px] text-white/75">
                {atMax ? `${totalXp} XP · nível máximo` : `${toNext} XP pro próximo nível`}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-gradient-to-r from-celeste via-white to-pink transition-[width] duration-500" style={{ width: `${lvl.pct}%` }} />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="mt-5 grid gap-2">
        <SectionTitle>Roteiro</SectionTitle>
        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] uppercase tracking-[0.14em] text-white/55">Esta semana</div>
              <div className="mt-1 font-display text-[18px] font-black tracking-[-0.02em]">{fmtWeek(week)}</div>
              <div className="mt-1 text-[12.5px] text-white/70">
                {mine ? `${mine.attraction} · ${mine.weekly_hours}h` : "Sem escala publicada ainda."}
              </div>
            </div>
            <button
              onClick={() => copyMut.mutate()}
              disabled={copyMut.isPending}
              className="glass-chip flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              {copyMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
              Copiar p/ próxima semana
            </button>
          </div>
        </GlassCard>
      </div>

      <div className="mt-5 grid gap-2">
        <SectionTitle
          action={
            <button onClick={() => setAbsOpen(true)} className="text-[12px] font-semibold text-pink underline-offset-4 hover:underline">
              + Registrar falta
            </button>
          }
        >
          Minhas faltas
        </SectionTitle>
        {(absences ?? []).length === 0 ? (
          <Notice>Nenhuma falta registrada. Em dia de falta, anexe atestado ou foto.</Notice>
        ) : (
          (absences ?? []).map((a) => (
            <GlassCard key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[16px] font-black tracking-[-0.02em]">
                    {new Date(a.absence_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  {a.reason && <div className="mt-1 text-[12.5px] text-white/75">{a.reason}</div>}
                  {a.attachment_url && (
                    <a href={a.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-celeste underline-offset-4 hover:underline">
                      Ver anexo <ChevronRight size={12} />
                    </a>
                  )}
                </div>
                {!a.attachment_url && (
                  <span className="glass-chip rounded-full px-2.5 py-1 text-[10.5px] text-white/65">Sem anexo</span>
                )}
              </div>
            </GlassCard>
          ))
        )}
      </div>

      <div className="mt-5 grid gap-3">
        <SectionTitle>Ritual do dia</SectionTitle>
        {[
          { time: "14:00 · Abertura", desc: "Checklist, segurança e preparo." },
          { time: "16:30 · Clima", desc: "Escuta rápida e apoio." },
          { time: "18:40 · Pico", desc: "Foco em fluxo e presença." },
          { time: "22:20 · Fechamento", desc: "Aprendizados e cuidados." },
        ].map((t) => (
          <GlassCard key={t.time}>
            <div className="flex items-center gap-3">
              <Check size={16} className="text-magic-green" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{t.time}</div>
                <div className="text-[12.5px] text-white/65">{t.desc}</div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {absOpen && <AbsenceModal onClose={() => setAbsOpen(false)} />}
    </>
  );
}

function AbsenceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const register = useServerFn(registerAbsence);

  async function submit() {
    if (!date) return;
    try {
      setUploading(true);
      let attachment_path: string | null = null;
      if (file) {
        if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo acima de 8MB.");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Faça login novamente.");
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${date}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("journey-absences").upload(path, file, {
          contentType: file.type || undefined,
          upsert: true,
        });
        if (upErr) throw new Error(upErr.message);
        attachment_path = path;
      }
      await register({ data: { absence_date: date, reason: reason || null, attachment_path } });
      toast.success("Falta registrada");
      qc.invalidateQueries({ queryKey: ["absences"] });
      onClose();
    } catch (e: any) {
      toast.error("Falhou", { description: e.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <BottomSheetModal
      open
      onClose={onClose}
      title="Registrar falta"
      description="Adicione um motivo e, se tiver, atestado ou foto."
    >
      <div className="grid gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Data</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="glass-input mt-1 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Motivo (opcional)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 400))}
              placeholder="Ex.: consulta médica, atestado em anexo."
              className="glass-input mt-1 min-h-[90px] w-full resize-none rounded-2xl p-3 text-[13px] outline-none placeholder:text-white/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Atestado ou foto (opcional)</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-[12.5px] text-white/80 file:mr-3 file:rounded-xl file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-white"
            />
            {file && <div className="mt-1 truncate text-[11.5px] text-white/55">{file.name}</div>}
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} className="glass-chip flex-1 rounded-2xl py-3 text-[13px] font-semibold">Cancelar</button>
            <button
              onClick={submit}
              disabled={uploading}
              className="flex-1 rounded-2xl bg-brand-grad py-3 text-[13px] font-semibold text-white shadow-glow disabled:opacity-60"
            >
              {uploading ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Salvar"}
            </button>
          </div>
      </div>
    </BottomSheetModal>
  );
}

function LeaderCheckinPanel({ isAdmin }: { isAdmin: boolean }) {
  const [attraction, setAttraction] = useState<string>("");
  const [query, setQuery] = useState("");
  const fn = useServerFn(listTodayCheckins);
  const { data } = useQuery({
    queryKey: ["leader-checkins", attraction || "all"],
    queryFn: () => fn({ data: { attraction: attraction || null } }),
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  }, [data, query]);

  const done = (data?.rows ?? []).filter((r) => r.checked_in).length;
  const total = (data?.rows ?? []).length;
  const pending = total - done;

  return (
    <div className="mt-5 grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        <GlassCard variant="glass" className="p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">Hoje</div>
          <div className="mt-1 font-display text-[22px] font-black text-white">{total}</div>
          <div className="text-[11px] text-white/65">no elenco</div>
        </GlassCard>
        <GlassCard variant="glass" className="p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">Fizeram</div>
          <div className="mt-1 font-display text-[22px] font-black text-magic-green">{done}</div>
          <div className="text-[11px] text-white/65">check-in</div>
        </GlassCard>
        <GlassCard variant="glass" className="p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">Pendente</div>
          <div className="mt-1 font-display text-[22px] font-black text-pink">{pending}</div>
          <div className="text-[11px] text-white/65">sem registro</div>
        </GlassCard>
      </div>

      <div className="grid gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome"
          className="glass-input rounded-2xl px-4 py-3 text-[13.5px] text-white outline-none placeholder:text-white/40"
        />
        {isAdmin && (
          <select
            value={attraction}
            onChange={(e) => setAttraction(e.target.value)}
            className="glass-input rounded-2xl px-4 py-3 text-[13.5px] text-white outline-none"
          >
            <option value="" className="text-blu">Todas atrações</option>
            {ATTRACTIONS.map((a) => <option key={a} value={a} className="text-blu">{a}</option>)}
          </select>
        )}
      </div>

      <div className="grid gap-2">
        {rows.length === 0 && <Notice>Sem pessoas para mostrar.</Notice>}
        {rows.map((r) => (
          <GlassCard key={r.user_id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15.5px] font-black tracking-[-0.02em]">{r.name}</div>
                <div className="truncate text-[11.5px] uppercase tracking-[0.12em] text-white/55">{r.attraction || "—"}</div>
                {r.absent && (
                  <div className="mt-2 text-[12px] text-pink">
                    Falta hoje{r.absence_reason ? ` · ${r.absence_reason}` : ""}
                    {r.absence_url && (
                      <a href={r.absence_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold text-celeste underline-offset-4 hover:underline">
                        Ver anexo <ChevronRight size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                {r.checked_in ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-magic-green/25 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <Check size={12} /> {r.mood ?? "-"}/5
                    </span>
                    <div className="mt-1 text-[10.5px] text-white/55">
                      {r.checked_at ? new Date(r.checked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-pink/30 px-2.5 py-1 text-[11px] font-semibold text-white">
                    Sem check-in
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}


function ScheduleScreen({ canEdit, myUserId }: { canEdit: boolean; myUserId: string }) {
  const [week, setWeek] = useState(getWeekStart());
  const qc = useQueryClient();
  const listFn = useServerFn(listWeekSchedule);
  const usersFn = useServerFn(listUsers);
  const upsert = useServerFn(upsertSchedule);
  const markCompletedFn = useServerFn(markScheduleCompleted);
  const markCompleted = useMutation({
    mutationFn: (v: { id: string; completed: boolean }) => markCompletedFn({ data: v }),
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["schedule", week] });
      qc.invalidateQueries({ queryKey: ["gamification"] });
    },
    onError: (e: any) => toast.error("Falhou", { description: e.message }),
  });
  const { data: rows } = useQuery({
    queryKey: ["schedule", week],
    queryFn: () => listFn({ data: { week_start: week } }),
  });
  const { data: people } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersFn(),
    enabled: canEdit,
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    attraction: ATTRACTIONS[0] as string,
    weekly_hours: 44,
    days_off: [] as string[],
    notes: "",
  });

  const m = useMutation({
    mutationFn: (user_id: string) =>
      upsert({
        data: {
          week_start: week,
          user_id,
          attraction: form.attraction,
          weekly_hours: form.weekly_hours,
          days_off: form.days_off,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Escala salva");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["schedule", week] });
    },
    onError: (e: any) => toast.error("Falhou", { description: e.message }),
  });

  const visibleRows = canEdit ? rows ?? [] : (rows ?? []).filter((r) => r.user_id === myUserId);
  const missing = canEdit
    ? (people ?? []).filter((p) => !(rows ?? []).some((r) => r.user_id === p.id))
    : [];

  function shiftWeek(delta: number) {
    const d = new Date(week + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    setWeek(d.toISOString().slice(0, 10));
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days_off: f.days_off.includes(day) ? f.days_off.filter((d) => d !== day) : [...f.days_off, day],
    }));
  }

  function startEdit(userId: string, existing?: any) {
    setEditing(userId);
    setForm({
      attraction: existing?.attraction ?? ATTRACTIONS[0],
      weekly_hours: existing?.weekly_hours ?? 44,
      days_off: existing?.days_off ?? [],
      notes: existing?.notes ?? "",
    });
  }

  return (
    <>
      <TopBar
        eyebrow="Roteiro da semana"
        title={canEdit ? "Publicar a semana" : "Sua semana"}
        subtitle={canEdit ? "Líderes alimentam até domingo 20h." : "Atração, folgas e carga horária."}
      />
      <div className="mt-5 flex items-center justify-between gap-2">
        <button onClick={() => shiftWeek(-1)} className="glass-chip rounded-full px-3 py-2 text-[12px]">‹ semana</button>
        <div className="text-[12.5px] font-medium text-white/80">{fmtWeek(week)}</div>
        <button onClick={() => shiftWeek(1)} className="glass-chip rounded-full px-3 py-2 text-[12px]">semana ›</button>
      </div>

      <div className="mt-4 grid gap-3">
        {visibleRows.length === 0 && !canEdit && (
          <Notice>Ainda sem roteiro. Quando o líder publicar, aparece aqui.</Notice>
        )}
        {visibleRows.map((r) => (
          <GlassCard key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-[18px] font-black tracking-[-0.02em]">
                  {r.profile?.full_name || "Sem nome"}
                </div>
                <div className="text-[12px] uppercase tracking-[0.14em] text-white/55">{r.attraction}</div>
              </div>
              <span className="glass-chip rounded-full px-3 py-1 text-[11px] font-semibold">{r.weekly_hours}h</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const off = (r.days_off ?? []).includes(d);
                return (
                  <span key={d} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", off ? "bg-pink/30 text-white" : "glass-chip text-white/65")}>
                    {d}{off ? " · folga" : ""}
                  </span>
                );
              })}
            </div>
            {r.notes && <div className="mt-3 text-[12.5px] text-white/65">{r.notes}</div>}
            <div className="mt-3 flex items-center gap-3">
              {r.completed_full ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-magic-green/25 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Check size={12} /> Semana cumprida
                </span>
              ) : (
                <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] text-white/65">A confirmar</span>
              )}
              {canEdit && (
                <>
                  <button onClick={() => startEdit(r.user_id, r)} className="text-[12px] font-semibold text-pink underline-offset-4 hover:underline">
                    Editar
                  </button>
                  <button
                    onClick={() => markCompleted.mutate({ id: r.id, completed: !r.completed_full })}
                    className="ml-auto text-[12px] font-semibold text-white/85 underline-offset-4 hover:underline"
                  >
                    {r.completed_full ? "Desmarcar" : "Marcar cumprida (+20)"}
                  </button>
                </>
              )}
            </div>
          </GlassCard>
        ))}

        {canEdit && missing.length > 0 && (
          <>
            <SectionTitle>Pendentes nesta semana</SectionTitle>
            {missing.map((p) => (
              <GlassCard key={p.id}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-semibold">{p.full_name || p.email}</div>
                    <div className="text-[11.5px] text-white/55">{p.attraction ?? "sem atração definida"}</div>
                  </div>
                  <button onClick={() => startEdit(p.id, { attraction: p.attraction, weekly_hours: p.weekly_hours, days_off: p.days_off })} className="rounded-2xl bg-white px-3 py-2 text-[12px] font-semibold text-blu">
                    Publicar
                  </button>
                </div>
              </GlassCard>
            ))}
          </>
        )}
      </div>

      <BottomSheetModal open={!!editing && canEdit} onClose={() => setEditing(null)} title="Editar escala">
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Atração</span>
                <select value={form.attraction} onChange={(e) => setForm({ ...form, attraction: e.target.value })} className="glass-input mt-1 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none">
                  {ATTRACTIONS.map((a) => <option key={a} value={a} className="text-blu">{a}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Carga horária semanal</span>
                <input
                  type="number"
                  value={form.weekly_hours}
                  onChange={(e) => setForm({ ...form, weekly_hours: Number(e.target.value) })}
                  className="glass-input mt-1 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none"
                />
              </label>
              <div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Folgas</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const on = form.days_off.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDay(d)} className={cn("rounded-full px-3 py-1.5 text-[12px] font-medium", on ? "bg-pink-grad text-white shadow-glow" : "glass-chip text-white/75")}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas (opcional)"
                className="glass-input min-h-[80px] w-full resize-none rounded-2xl p-3 text-[13px] outline-none placeholder:text-white/40"
              />
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="glass-chip flex-1 rounded-2xl py-3 text-[13px] font-semibold">Cancelar</button>
                <button onClick={() => editing && m.mutate(editing)} disabled={m.isPending} className="flex-1 rounded-2xl bg-brand-grad py-3 text-[13px] font-semibold text-white shadow-glow disabled:opacity-60">
                  {m.isPending ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Salvar"}
                </button>
              </div>
            </div>
      </BottomSheetModal>
    </>
  );
}

function TeamScreen({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const usersFn = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);
  const { data: people } = useQuery({ queryKey: ["users"], queryFn: () => usersFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "messenger" as "admin" | "leader" | "messenger",
    attraction: ATTRACTIONS[0] as string,
    weekly_hours: 44,
  });

  const m = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Pessoa adicionada");
      setOpen(false);
      setForm({ ...form, email: "", password: "", full_name: "" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error("Falhou", { description: e.message }),
  });

  const toggle = useMutation({
    mutationFn: (p: any) => update({ data: { id: p.id, active: !p.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <>
      <TopBar eyebrow="Quem faz a mágica" title="Elenco da Hector Studios" subtitle="Permissões, atrações e disponibilidade." />
      {isAdmin && (
        <button
          onClick={() => setOpen(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-grad px-5 py-4 text-[14.5px] font-semibold text-white shadow-glow active:scale-[0.99]"
        >
          <UserPlus size={18} /> Chamar pro elenco
        </button>
      )}
      <div className="mt-4 grid gap-3">
        {(people ?? []).map((p) => (
          <GlassCard key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-display text-[17px] font-black tracking-[-0.02em]">{p.full_name || "Sem nome"}</div>
                <div className="truncate text-[12px] text-white/55">{p.email}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {p.roles.map((r) => (
                  <span key={r} className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em]">{r}</span>
                ))}
                {!p.active && <span className="rounded-full bg-pink/30 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em]">inativo</span>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-white/70">
              <span>{p.attraction ?? "sem atração"}</span>
              <span>·</span>
              <span>{p.weekly_hours ?? 0}h/sem</span>
              <span>·</span>
              <span>folgas: {(p.days_off ?? []).join(", ") || "—"}</span>
            </div>
            {isAdmin && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => toggle.mutate(p)} className="glass-chip flex-1 rounded-2xl py-2 text-[12px] font-semibold">
                  {p.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>

      <BottomSheetModal open={open} onClose={() => setOpen(false)} title="Nova pessoa">
            <div className="grid gap-3">
              {[
                ["Nome", "full_name", "text"],
                ["E-mail", "email", "email"],
                ["Senha temporária", "password", "text"],
              ].map(([label, key, type]) => (
                <label key={key} className="block">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">{label}</span>
                  <input
                    type={type as string}
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="glass-input mt-1 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none"
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Papel</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })} className="glass-input mt-1 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none">
                  <option value="messenger" className="text-blu">Mensageiro</option>
                  <option value="leader" className="text-blu">Líder</option>
                  <option value="admin" className="text-blu">Admin</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Atração</span>
                <select value={form.attraction} onChange={(e) => setForm({ ...form, attraction: e.target.value })} className="glass-input mt-1 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none">
                  {ATTRACTIONS.map((a) => <option key={a} value={a} className="text-blu">{a}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">Carga horária semanal</span>
                <input
                  type="number"
                  value={form.weekly_hours}
                  onChange={(e) => setForm({ ...form, weekly_hours: Number(e.target.value) })}
                  className="glass-input mt-1 w-full rounded-2xl px-4 py-3 text-[14px] text-white outline-none"
                />
              </label>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="glass-chip flex-1 rounded-2xl py-3 text-[13px] font-semibold">Cancelar</button>
                <button onClick={() => m.mutate()} disabled={m.isPending || !form.email || !form.password || !form.full_name} className="flex-1 rounded-2xl bg-brand-grad py-3 text-[13px] font-semibold text-white shadow-glow disabled:opacity-50">
                  {m.isPending ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Adicionar"}
                </button>
              </div>
            </div>
      </BottomSheetModal>
    </>
  );
}

function LeaderScreen({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<"sinais" | "checkins">("sinais");
  const fn = useServerFn(leaderOverview);
  const { data } = useQuery({ queryKey: ["leader-overview"], queryFn: () => fn() });
  return (
    <>
      <TopBar eyebrow="Painel do líder" title="Proteger o clima" subtitle="Sinais e presença do seu elenco em um só lugar." />
      <div className="glass-soft mt-5 grid grid-cols-2 gap-1 rounded-full p-1">
        {([
          ["sinais", "Sinais"],
          ["checkins", "Check-ins"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full py-2.5 text-[12.5px] font-medium transition",
              tab === id ? "bg-white text-blu shadow-glow" : "text-white/70",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "sinais" ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MetricCard label="Humor médio" value={data ? data.avgMood.toFixed(1) : "–"} sub="últimos 7 dias" icon={Heart} variant="blue" />
            <MetricCard label="Check-ins" value={String(data?.sampleSize ?? 0)} sub="na semana" icon={TrendingUp} variant="pink" />
          </div>
          <div className="mt-5">
            <Notice>
              <b className="text-white">Próximos passos:</b> abrir 1:1 com quem tem humor abaixo de 3 por dois dias seguidos.
            </Notice>
          </div>
        </>
      ) : (
        <LeaderCheckinPanel isAdmin={isAdmin} />
      )}
    </>
  );
}

/* ---------- Gamification ---------- */

function levelFromXp(xp: number) {
  // tiers: 0, 100, 250, 500, 1000, 2000, 4000
  const tiers = [0, 100, 250, 500, 1000, 2000, 4000, 8000];
  let lvl = 0;
  for (let i = 0; i < tiers.length; i++) if (xp >= tiers[i]) lvl = i;
  const cur = tiers[lvl];
  const next = tiers[Math.min(lvl + 1, tiers.length - 1)];
  const pct = next === cur ? 100 : Math.round(((xp - cur) / (next - cur)) * 100);
  return { level: lvl + 1, cur, next, pct: Math.max(0, Math.min(100, pct)) };
}

function badgeIcon(group: string) {
  if (group === "streak") return Flame;
  if (group === "present") return Medal;
  return Award;
}

/* ---------- Wi-Fi allowlist (admin) ---------- */

function WifiAllowlistScreen() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllowedIps);
  const addFn = useServerFn(addAllowedIp);
  const removeFn = useServerFn(removeAllowedIp);

  const { data, isLoading } = useQuery({
    queryKey: ["wifi-allowlist"],
    queryFn: () => listFn(),
  });

  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");

  const add = useMutation({
    mutationFn: (v: { ip: string; label?: string }) => addFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wifi-allowlist"] });
      setIp(""); setLabel("");
      toast.success("IP adicionado");
    },
    onError: (e: Error) => toast.error("Não rolou", { description: e.message }),
  });
  const remove = useMutation({
    mutationFn: (v: { ip: string }) => removeFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wifi-allowlist"] });
      toast.success("IP removido");
    },
  });

  return (
    <div className="mt-5 space-y-4">
      <GlassCard>
        <div className="flex items-center gap-2 text-white">
          <Wifi className="h-5 w-5" />
          <h2 className="font-display text-[17px] font-black tracking-[-0.02em]">Rede permitida</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          1º acesso é livre (qualquer rede). Depois, só entra de um IP da lista abaixo.
          Admin sempre passa. Lista vazia = sem bloqueio.
        </p>
        <div className="glass-chip mt-4 rounded-2xl px-4 py-3 text-[13px] text-white/85">
          <span className="text-white/60">Seu IP agora:</span>{" "}
          <span className="font-mono font-semibold text-white">
            {data?.currentIp || "—"}
          </span>
          {data?.currentIp && (
            <button
              type="button"
              onClick={() => setIp(data.currentIp)}
              className="ml-3 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/30"
            >
              Usar este
            </button>
          )}
        </div>
      </GlassCard>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ip.trim()) return;
          add.mutate({ ip: ip.trim(), label: label.trim() || undefined });
        }}
        className="glass-soft space-y-3 rounded-[26px] p-5"
      >
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/70">Adicionar IP</h3>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="Ex: 200.123.45.67"
          className="glass-input w-full rounded-2xl px-4 py-3 font-mono text-[14px] outline-none placeholder:text-white/40"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Rótulo (opcional) — ex: Wi-Fi Parque"
          maxLength={80}
          className="glass-input w-full rounded-2xl px-4 py-3 text-[14px] outline-none placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={add.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-grad py-3 text-[14px] font-semibold text-white shadow-glow transition active:scale-[0.99] disabled:opacity-60"
        >
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Adicionar</>}
        </button>
      </form>

      <div className="space-y-2">
        <SectionTitle>
          IPs autorizados {data?.ips?.length ? `(${data.ips.length})` : ""}
        </SectionTitle>
        {isLoading && <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-white/50" /></div>}
        {!isLoading && (data?.ips?.length ?? 0) === 0 && (
          <Notice>Nenhum IP cadastrado. Login está livre pra todos.</Notice>
        )}
        {data?.ips?.map((r: { ip: string; label: string | null; created_at: string }) => (
          <div key={r.ip} className="glass-chip flex items-center gap-3 rounded-2xl px-4 py-3">
            <div className="flex-1">
              <div className="font-mono text-[14px] font-semibold text-white">{r.ip}</div>
              {r.label && <div className="text-[11.5px] text-white/60">{r.label}</div>}
            </div>
            <button
              type="button"
              onClick={() => {
                confirmAction(`Remover ${r.ip}?`, () => remove.mutate({ ip: r.ip }));
              }}
              className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-pink/30 hover:text-white"
              aria-label={`Remover ${r.ip}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <WifiBypassSection />
    </div>
  );
}

function WifiBypassSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBypassUsers);
  const toggleFn = useServerFn(setWifiBypass);
  const [q, setQ] = useState("");
  const [onlyBypass, setOnlyBypass] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wifi-bypass-users"],
    queryFn: () => listFn(),
  });

  const toggle = useMutation({
    mutationFn: (v: { user_id: string; bypass: boolean }) => toggleFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["wifi-bypass-users"] });
      const prev = qc.getQueryData<{ users: Array<{ id: string; wifi_bypass: boolean }> }>(["wifi-bypass-users"]);
      if (prev) {
        qc.setQueryData(["wifi-bypass-users"], {
          ...prev,
          users: prev.users.map((u) => (u.id === v.user_id ? { ...u, wifi_bypass: v.bypass } : u)),
        });
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["wifi-bypass-users"], ctx.prev);
      toast.error("Não rolou", { description: e.message });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wifi-bypass-users"] }),
  });

  type U = {
    id: string;
    full_name: string;
    hero_id: string | null;
    attraction: string | null;
    role_title: string | null;
    wifi_bypass: boolean;
  };
  const users = (data?.users ?? []) as U[];
  const term = q.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (onlyBypass && !u.wifi_bypass) return false;
    if (!term) return true;
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.hero_id?.toLowerCase().includes(term) ||
      u.attraction?.toLowerCase().includes(term)
    );
  });

  const bypassCount = users.filter((u) => u.wifi_bypass).length;

  return (
    <div className="glass-soft space-y-3 rounded-[26px] p-5">
      <div>
        <h3 className="font-display text-[15px] font-black tracking-[-0.02em] text-white">Liberados de qualquer Wi-Fi</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-white/65">
          Pessoas marcadas aqui podem entrar de qualquer rede, sempre. Útil pra líderes em deslocamento, equipe externa, etc.
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome, ID ou atração..."
        className="glass-input w-full rounded-2xl px-4 py-2.5 text-[14px] outline-none placeholder:text-white/40"
      />

      <div className="flex items-center justify-between text-[12px] text-white/65">
        <span>{bypassCount} liberado(s) de {users.length}</span>
        <button
          type="button"
          onClick={() => setOnlyBypass((v) => !v)}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition",
            onlyBypass ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/80 hover:bg-white/20"
          )}
        >
          {onlyBypass ? "Mostrando só liberados" : "Só liberados"}
        </button>
      </div>

      {isLoading && (
        <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-white/50" /></div>
      )}

      <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
        {filtered.map((u) => (
          <label
            key={u.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition",
              u.wifi_bypass ? "bg-magic-green/15 ring-1 ring-magic-green/40" : "bg-white/5 hover:bg-white/10"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {u.hero_id && (
                  <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-white">
                    {u.hero_id}
                  </span>
                )}
                <span className="truncate text-[13.5px] font-semibold text-white">{u.full_name}</span>
              </div>
              <div className="truncate text-[11px] text-white/55">
                {[u.attraction, u.role_title].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <input
              type="checkbox"
              checked={u.wifi_bypass}
              onChange={(e) => toggle.mutate({ user_id: u.id, bypass: e.target.checked })}
              className="h-5 w-5 cursor-pointer accent-magic-green"
            />
          </label>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl bg-white/5 px-4 py-6 text-center text-[12.5px] text-white/60">
            Nenhuma pessoa encontrada.
          </div>
        )}
      </div>
    </div>
  );
}


/* ---------- Iluminari moments ---------- */


function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function IluminariScreen({ myUserId, isAdmin }: { myUserId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listIluminari);
  const createFn = useServerFn(createIluminari);
  const deleteFn = useServerFn(deleteIluminari);
  const { data: moments } = useQuery({ queryKey: ["iluminari"], queryFn: () => listFn() });

  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  // URLs de preview criadas uma vez por conjunto de arquivos e revogadas no cleanup
  const imagePreviews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => imagePreviews.forEach((u) => URL.revokeObjectURL(u)), [imagePreviews]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e: any) {
      toast.error("Microfone bloqueado", { description: "Libere o acesso ao microfone." });
    }
  }
  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }
  function clearAudio() {
    setAudioBlob(null);
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(null);
  }
  function pickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => f.type.startsWith("image/") && f.size < 8 * 1024 * 1024);
    setImages((prev) => [...prev, ...valid].slice(0, 6));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!message.trim() && images.length === 0 && !audioBlob) {
      toast.error("Conte algo", { description: "Texto, áudio ou foto, qualquer coisa." });
      return;
    }
    setSubmitting(true);
    try {
      const uploadedImages: string[] = [];
      for (const file of images) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${myUserId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("iluminari").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        uploadedImages.push(path);
      }
      let audioPath: string | null = null;
      if (audioBlob) {
        audioPath = `${myUserId}/${crypto.randomUUID()}.webm`;
        const { error } = await supabase.storage.from("iluminari").upload(audioPath, audioBlob, {
          contentType: "audio/webm",
          upsert: false,
        });
        if (error) throw error;
      }
      await createFn({
        data: {
          message: message.trim() || null,
          audio_path: audioPath,
          image_paths: uploadedImages,
        },
      });
      toast.success("Iluminari registrado", { description: "Obrigado por iluminar o time." });
      setMessage("");
      setImages([]);
      clearAudio();
      qc.invalidateQueries({ queryKey: ["iluminari"] });
    } catch (e: any) {
      toast.error("Não rolou enviar", { description: e?.message ?? "Tente de novo." });
    } finally {
      setSubmitting(false);
    }
  }

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Apagado");
      qc.invalidateQueries({ queryKey: ["iluminari"] });
    },
    onError: (e: any) => toast.error("Falhou", { description: e.message }),
  });

  return (
    <>
      <TopBar
        eyebrow="Momentos Iluminari"
        title="Conta esse brilho"
        subtitle="Aquela cena que iluminou o dia. Texto, áudio ou foto."
      />

      <div className="mt-5">
        <GlassCard variant="pink">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
            placeholder="O que aconteceu de mágico?"
            className="glass-input min-h-[96px] w-full resize-none rounded-2xl bg-white/15 p-3 text-[14px] text-white outline-none placeholder:text-white/60"
          />

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {images.map((_f, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl">
                  <img src={imagePreviews[i]} alt="" className="aspect-square w-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {audioPreview && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2">
              <audio src={audioPreview} controls className="h-8 flex-1" />
              <button onClick={clearAudio} className="grid h-8 w-8 place-items-center rounded-full bg-black/40">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold"
            >
              <ImageIcon size={14} /> Foto
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={pickImages}
            />
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={!!audioBlob}
                className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
              >
                <Mic size={14} /> Gravar áudio
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-full bg-magic-red/85 px-3 py-2 text-[12.5px] font-semibold text-white"
              >
                <Square size={12} className="fill-current" /> Parar gravação
              </button>
            )}
            <button
              onClick={submit}
              disabled={submitting}
              className="ml-auto inline-flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2 text-[13px] font-semibold text-blu disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Iluminar
            </button>
          </div>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-3">
        <SectionTitle>Linha do tempo</SectionTitle>
        {(moments ?? []).length === 0 && (
          <Notice>Ainda sem momentos. Seja a primeira luz a brilhar aqui.</Notice>
        )}
        {(moments ?? []).map((m) => {
          const canDelete = m.author?.id === myUserId || isAdmin;
          return (
            <GlassCard key={m.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <Sun size={14} className="text-pink" />
                    {m.author?.full_name || "Alguém do elenco"}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
                    {m.author?.attraction || "—"} · {timeAgo(m.created_at)}
                  </div>
                </div>
                {canDelete && (
                  <button
                    onClick={() => del.mutate(m.id)}
                    className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:text-white"
                    aria-label="Apagar"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {m.message && (
                <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/90">{m.message}</p>
              )}
              {m.image_urls.length > 0 && (
                <div className={cn("mt-3 grid gap-1.5", m.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                  {m.image_urls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl">
                      <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              {m.audio_url && (
                <audio src={m.audio_url} controls className="mt-3 w-full" />
              )}
            </GlassCard>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Aniversários ---------- */

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function BirthdaysScreen({ myUserId }: { myUserId: string }) {
  const fn = useServerFn(listWeekBirthdays);
  const { data } = useQuery({ queryKey: ["birthdays", "week"], queryFn: () => fn() });
  const sendFn = useServerFn(sendKudos);
  const qc = useQueryClient();
  const [sent, setSent] = useState<Set<string>>(new Set());

  const cheer = useMutation({
    mutationFn: (to: string) =>
      sendFn({
        data: {
          to_user: to,
          message: "Feliz aniversário! Que seu dia seja mágico e cheio de brilho. 🎉",
          category: "aniversario",
        },
      }),
    onSuccess: (_r, to) => {
      setSent((s) => new Set(s).add(to));
      toast.success("Parabéns enviado", { description: "Seu elogio chegou pra pessoa." });
      qc.invalidateQueries({ queryKey: ["kudos"] });
    },
    onError: (e: any) => toast.error("Não rolou", { description: e.message }),
  });

  const rows = data?.rows ?? [];
  const today = rows.filter((r) => r.is_today);
  const rest = rows.filter((r) => !r.is_today);

  const renderCard = (r: (typeof rows)[number]) => {
    const me = r.id === myUserId;
    const already = sent.has(r.id);
    return (
      <GlassCard key={r.id} variant={r.is_today ? "brand" : "glass"}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 font-display text-[16px] font-black">
            {initials(r.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[16px] font-black tracking-[-0.02em]">{r.full_name}</div>
            <div className="truncate text-[11.5px] text-white/70">
              {r.is_today ? "é hoje" : r.weekday}
              {r.attraction ? ` · ${r.attraction}` : r.negocio ? ` · ${r.negocio}` : ""}
              {r.turns ? ` · faz ${r.turns}` : ""}
            </div>
          </div>
          {me ? (
            <span className="glass-chip inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold">
              <Gift size={13} /> é você
            </span>
          ) : already ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-semibold">
              <Check size={13} /> Enviado
            </span>
          ) : (
            <button
              onClick={() => cheer.mutate(r.id)}
              disabled={cheer.isPending}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-95 disabled:opacity-60",
                r.is_today ? "bg-white text-blu" : "bg-brand-grad text-white shadow-glow",
              )}
            >
              <PartyPopper size={14} /> Parabéns
            </button>
          )}
        </div>
      </GlassCard>
    );
  };

  return (
    <>
      <TopBar eyebrow="Aniversários" title="Da semana" subtitle="Celebre quem faz o time brilhar." />

      {rows.length === 0 && (
        <div className="mt-6">
          <Notice>Ninguém faz aniversário nesta semana. Volte semana que vem!</Notice>
        </div>
      )}

      {today.length > 0 && (
        <div className="mt-6 grid gap-3">
          <SectionTitle>É hoje</SectionTitle>
          {today.map(renderCard)}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-6 grid gap-3">
          <SectionTitle>No restante da semana</SectionTitle>
          {rest.map(renderCard)}
        </div>
      )}
    </>
  );
}

function GamificationScreen({ myUserId }: { myUserId: string }) {
  const myFn = useServerFn(getMyGamification);
  const lbFn = useServerFn(getAttractionLeaderboard);
  const { data: me } = useQuery({ queryKey: ["gamification", "me"], queryFn: () => myFn() });
  const { data: lb } = useQuery({
    queryKey: ["gamification", "leaderboard", me?.attraction ?? ""],
    queryFn: () => lbFn({ data: {} }),
    enabled: !!me,
  });

  const totalXp = me?.totalXp ?? 0;
  const seasonXp = me?.seasonXp ?? 0;
  const streak = me?.streak ?? 0;
  const weeksFull = me?.weeksFull ?? 0;
  const earned = new Set(me?.badges ?? []);
  const lvl = levelFromXp(totalXp);

  const daysToReset = me?.seasonEnd
    ? Math.max(0, Math.ceil((new Date(me.seasonEnd).getTime() - Date.now()) / 86400000))
    : 0;

  const podium = (lb?.rows ?? []).slice(0, 3);
  const others = (lb?.rows ?? []).slice(3);
  const myRank = (lb?.rows ?? []).findIndex((r) => r.user_id === myUserId) + 1;

  return (
    <>
      <TopBar
        eyebrow="Por trás da Magia"
        title="Sua pontuação"
        subtitle="Cada gesto soma. Temporada zera a cada trimestre."
      />

      <div className="mt-6">
        <GlassCard variant="brand">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/75">{levelName(lvl.level)}</div>
              <div className="mt-1 font-display text-[34px] font-black leading-none tracking-[-0.04em]">{totalXp} <span className="text-[16px] font-bold text-white/75">XP total</span></div>
            </div>
            <LevelRing level={lvl.level} pct={lvl.pct} />
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: `${lvl.pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-white/75">
            <span>{lvl.cur} XP</span>
            <span>{lvl.next} XP</span>
          </div>
        </GlassCard>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Temporada" value={String(seasonXp)} sub={`${daysToReset}d pro reset`} icon={Star} variant="pink" />
        <MetricCard label="Posição" value={myRank > 0 ? `#${myRank}` : "—"} sub={me?.attraction ?? "sem atração"} icon={TrendingUp} variant="blue" />
        <MetricCard label="Sequência" value={`${streak}d`} sub="check-ins seguidos" icon={Flame} />
        <MetricCard label="Semanas 100%" value={String(weeksFull)} sub="escala cumprida" icon={Medal} />
      </div>

      <div className="mt-6">
        <SectionTitle>Pódio da {me?.attraction ?? "atração"}</SectionTitle>
        {(!lb || lb.rows.length === 0) && <Notice>Ainda sem pontos nesta atração. Bora começar.</Notice>}
        {podium.length > 0 && (
          <div className="grid gap-2">
            {podium.map((r, i) => (
              <GlassCard key={r.user_id} variant={i === 0 ? "brand" : "glass"} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-[17px] font-black",
                    i === 0 ? "bg-white/30 text-white ring-2 ring-white/50" : "glass-chip text-white/90")}>
                    {i === 0 ? <Trophy size={18} /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold">{r.name}</div>
                    <div className="text-[11.5px] text-white/65">{r.user_id === myUserId ? "você" : "elenco"}</div>
                  </div>
                  <div className="font-display text-[22px] font-black tracking-[-0.02em]">{r.points}</div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <div className="mt-2 grid gap-1.5">
            {others.map((r, i) => (
              <div key={r.user_id} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5",
                r.user_id === myUserId ? "bg-pink/25" : "glass-chip")}>
                <span className="w-6 text-[12px] font-semibold text-white/70">#{i + 4}</span>
                <span className="flex-1 truncate text-[13px] text-white/90">{r.name}</span>
                <span className="text-[13px] font-semibold">{r.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <SectionTitle>Selos</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((b) => {
            const got = earned.has(b.key);
            const Icon = badgeIcon(b.group);
            const progress =
              b.group === "streak" ? streak :
              b.group === "present" ? weeksFull :
              totalXp;
            const pct = Math.min(100, Math.round((progress / b.goal) * 100));
            return (
              <div key={b.key} className={cn("rounded-2xl p-3 text-center",
                got ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/75")}>
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                  {got ? <Icon size={18} /> : <Lock size={14} className="text-white/55" />}
                </div>
                <div className="mt-2 text-[11.5px] font-semibold leading-tight">{b.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-white/70">{b.desc}</div>
                {!got && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div className="h-full bg-white/70" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle>Como ganhar pontos</SectionTitle>
        <GlassCard>
          <ul className="grid gap-2.5">
            {POINT_RULES.map((r) => (
              <li key={r.kind} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 font-display text-[14px] font-black">+{r.points}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">{r.label}</div>
                  {r.hint && <div className="text-[11.5px] text-white/60">{r.hint}</div>}
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}

/* ---------- Shell ---------- */

type TabId = "home" | "journey" | "feedback" | "schedule" | "team" | "leader" | "points" | "iluminari" | "vagas" | "wifi" | "pre-reg" | "cycle" | "analytics" | "broadcast" | "evals" | "hierarquia" | "birthdays" | "bussola" | "disc-admin" | "wellbeing" | "flagged-kudos";

function BottomNav({
  active,
  onChange,
  tabs,
  moreActive,
  onMore,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  tabs: { id: TabId; label: string; icon: LucideIcon }[];
  moreActive?: boolean;
  onMore?: () => void;
}) {
  const cols = tabs.length + (onMore ? 1 : 0);
  return (
    <nav aria-label="Navegação" className="pointer-events-auto fixed bottom-3 left-1/2 z-20 w-[min(420px,calc(100%-16px))] -translate-x-1/2">
      <div className="rounded-[30px] border border-white/15 bg-ink/85 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 shadow-glass backdrop-blur-2xl">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const a = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium leading-none transition",
                  a ? "text-white" : "text-white/50",
                )}
              >
                {a && (
                  <span aria-hidden className="absolute inset-x-2 bottom-1 h-[3px] rounded-full bg-gradient-to-r from-celeste via-white to-pink opacity-90" />
                )}
                <Icon size={18} strokeWidth={a ? 2.4 : 2} />
                <span className="max-w-full truncate">{t.label}</span>
              </button>
            );
          })}
          {onMore && (
            <button
              onClick={onMore}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium leading-none transition",
                moreActive ? "text-white" : "text-white/50",
              )}
            >
              {moreActive && (
                <span aria-hidden className="absolute inset-x-2 bottom-1 h-[3px] rounded-full bg-gradient-to-r from-celeste via-white to-pink opacity-90" />
              )}
              <MoreHorizontal size={18} strokeWidth={moreActive ? 2.4 : 2} />
              <span className="max-w-full truncate">Mais</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function LinkCulturaApp() {
  const [tab, setTab] = useState<TabId>("home");
  const navigate = useNavigate();
  const { profile, isLeader, isAdmin, isLoading, canSelectBusiness } = useCurrentUser();

  const handleTabChange = (id: TabId) => {
    if (id === "evals") {
      navigate({ to: "/avaliacoes" });
      return;
    }
    if (id === "hierarquia" as TabId) {
      navigate({ to: "/hierarquia" });
      return;
    }
    setTab(id);
  };

  const primaryTabs = useMemo(() => {
    const t: { id: TabId; label: string; icon: LucideIcon }[] = [
      { id: "home", label: "Início", icon: Home },
      { id: "journey", label: "Jornada", icon: Compass },
    ];
    if (isLeader) {
      t.push({ id: "evals", label: "Avaliações", icon: Star });
      t.push({ id: "leader", label: "Líder", icon: AlertTriangle });
    } else {
      t.push({ id: "points", label: "Pontos", icon: Trophy });
    }
    return t;
  }, [isLeader]);

  const moreGroups = useMemo(() => {
    const groups: { title: string; items: { id: TabId; label: string; icon: LucideIcon; desc: string }[] }[] = [];

    groups.push({
      title: "Pra você",
      items: [
        { id: "bussola", label: "Bússola das Essências", icon: Compass, desc: "Mapeamento comportamental (1x/ano)" },
        { id: "birthdays", label: "Aniversários", icon: Cake, desc: "Quem faz aniversário na semana" },
        { id: "iluminari", label: "Iluminari", icon: Sun, desc: "Compartilhar um momento" },
        { id: "schedule", label: "Roteiro", icon: CalendarDays, desc: "Sua escala da semana" },
        { id: "feedback", label: "Elogio Rápido", icon: MessageCircle, desc: "Envie e veja reconhecimentos" },
      ],
    });

    if (isLeader) {
      const gestao: { id: TabId; label: string; icon: LucideIcon; desc: string }[] = [
        { id: "points", label: "Gamificação", icon: Trophy, desc: "Ranking e conquistas" },
        { id: "analytics", label: "Performance da gamificação", icon: BarChart3, desc: "Consultas e snapshots por período" },
        { id: "vagas", label: "Vagas", icon: Briefcase, desc: "Briefings e recrutamento" },
      ];
      if (!isAdmin) gestao.push({ id: "team", label: "Elenco", icon: Users, desc: "Gerenciar pessoas" });
      groups.push({ title: "Gestão", items: gestao });
    }

    if (isAdmin) {
      const adminItems: { id: TabId; label: string; icon: LucideIcon; desc: string }[] = [
        { id: "broadcast", label: "Enviar recado", icon: Send, desc: "Notificar todo o elenco" },
        { id: "flagged-kudos", label: "Elogios sinalizados", icon: Flag, desc: "Revisar mensagens marcadas pela moderação" },
        { id: "disc-admin", label: "Bússola do time", icon: Compass, desc: "Perfis comportamentais (quem consentiu)" },
        { id: "hierarquia", label: "Elenco & Hierarquia", icon: Users, desc: "Definir líder e co-líder de cada pessoa" },
        { id: "pre-reg", label: "Pré-cadastro", icon: UserPlus, desc: "Importar planilha do elenco" },
        { id: "cycle", label: "Ciclo da gamificação", icon: Trophy, desc: "Resetar pontos a cada N dias" },
        { id: "wifi", label: "Rede permitida", icon: Wifi, desc: "Wi-Fi autorizado para login" },
      ];
      const email = (profile as { email?: string | null } | null)?.email?.toLowerCase();
      if (email && SUPREME_EMAILS.includes(email)) {
        adminItems.splice(1, 0, {
          id: "wellbeing",
          label: "Cuidado com o elenco",
          icon: HeartCrack,
          desc: "Quem está com energia baixa há um tempo",
        });
      }
      groups.push({ title: "Admin", items: adminItems });
    }

    return groups;
  }, [isLeader, isAdmin, profile]);

  const moreTabs = useMemo(() => moreGroups.flatMap((g) => g.items), [moreGroups]);

  const [moreOpen, setMoreOpen] = useState(false);

  const name = profile?.full_name?.split(" ")[0] ?? "";

  // Telas que se beneficiam do filtro de negócio (apenas admin/direção podem trocar)
  const showBusinessSelector =
    canSelectBusiness && (tab === "leader" || tab === "team" || tab === "points" || tab === "home");

  const screen = useMemo(() => {
    if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="animate-spin text-white/60" /></div>;
    switch (tab) {
      case "journey": return <JourneyScreen myUserId={profile?.id ?? ""} />;
      case "feedback": return <FeedbackScreen canSend={isLeader} />;
      case "schedule": return <ScheduleScreen canEdit={isLeader} myUserId={profile?.id ?? ""} />;
      case "team": return <TeamScreen isAdmin={isAdmin} />;
      case "leader": return <LeaderScreen isAdmin={isAdmin} />;
      case "points": return <GamificationScreen myUserId={profile?.id ?? ""} />;
      case "iluminari": return <IluminariScreen myUserId={profile?.id ?? ""} isAdmin={isAdmin} />;
      case "birthdays": return <BirthdaysScreen myUserId={profile?.id ?? ""} />;
      case "bussola": return <Bussola name={name} />;
      case "disc-admin": return <BussolaAdmin />;
      case "wellbeing": return <WellbeingAdmin />;
      case "flagged-kudos": return <FlaggedKudosAdmin />;
      case "vagas": return <JobsScreen isAdmin={isAdmin} />;
      case "wifi": return <WifiAllowlistScreen />;
      case "pre-reg": return <PreRegistrationsAdmin />;
      case "cycle": return <GamificationCycleAdmin />;
      case "analytics": return <GamificationAnalyticsAdmin />;
      case "broadcast": return <BroadcastAdminScreen />;
      default: return <HomeScreen name={name} go={setTab} isAdmin={isAdmin} isLeader={isLeader} />;
    }
  }, [tab, isLeader, isAdmin, isLoading, profile, name]);

  const moreActive = moreTabs.some((t) => t.id === tab);

  // Para o provider de negócio: admin/direção começam em "todos"; demais ficam fixos no próprio.
  const ownBusiness = (profile as { negocio?: string | null } | null)?.negocio ?? null;

  return (
    <BusinessProvider ownBusiness={ownBusiness} canSelect={!!canSelectBusiness}>
      <LiquidBackground>
        <main className="relative mx-auto min-h-screen w-full max-w-[430px] px-4 pb-32 pt-6">
          <AppHeader name={name} isAdmin={isAdmin} />
          {showBusinessSelector && <BusinessSelector />}
          <section className="relative">{screen}</section>
        </main>
        <BottomNav
          active={tab}
          onChange={handleTabChange}
          tabs={primaryTabs}
          moreActive={moreActive}
          onMore={() => setMoreOpen(true)}
        />
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="glass-strong max-h-[85vh] overflow-y-auto border-white/20 text-white rounded-t-[28px]">
            <SheetHeader>
              <SheetTitle className="text-white">Mais</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid gap-5 pb-6">
              {moreGroups.map((g) => (
                <div key={g.title} className="grid gap-2">
                  <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{g.title}</div>
                  {g.items.map((t) => {
                    const Icon = t.icon;
                    const a = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { handleTabChange(t.id); setMoreOpen(false); }}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
                          a ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/90 hover:bg-white/15",
                        )}
                      >
                        <Icon size={20} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{t.label}</div>
                          <div className="text-[11px] text-white/60">{t.desc}</div>
                        </div>
                        <ChevronRight size={16} className="opacity-60" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </LiquidBackground>
    </BusinessProvider>
  );
}
