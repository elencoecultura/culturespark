import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { User, Mail, Lock, Loader2, CheckCircle2, ArrowRight, Sparkles, Building2, Search } from "lucide-react";
import LiquidBackground from "@/components/link-cultura/LiquidBackground";
import hectorLogo from "@/assets/hector-logo.png";
import { registerHero } from "@/lib/registration.functions";
import { lookupPreRegistration, searchPreRegistrations } from "@/lib/pre-registration.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro · Encantômetro" },
      { name: "description", content: "Faça seu cadastro de Herói da Cultura." },
    ],
  }),
  component: CadastroPage,
});

type Success = {
  full_name: string;
  negocio: string;
  setor: string | null;
  cargo: string | null;
  perfil: string;
};

type MatchRow = {
  id: string;
  full_name: string;
  already_claimed: boolean;
};


type Lookup = (MatchRow & { found: true }) | { found: false } | null;

function CadastroPage() {
  const register = useServerFn(registerHero);
  const lookup = useServerFn(lookupPreRegistration);
  const search = useServerFn(searchPreRegistrations);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);
  const [match, setMatch] = useState<Lookup>(null);
  const [suggestions, setSuggestions] = useState<MatchRow[]>([]);
  const [checking, setChecking] = useState(false);
  const [picked, setPicked] = useState<MatchRow | null>(null);
  const debRef = useRef<number | null>(null);

  // Debounced lookup + fuzzy search whenever name/email changes
  useEffect(() => {
    if (debRef.current) window.clearTimeout(debRef.current);
    if (picked) return; // user already chose from suggestions
    if (fullName.trim().length < 2 && !email.includes("@")) {
      setMatch(null);
      setSuggestions([]);
      return;
    }
    debRef.current = window.setTimeout(async () => {
      setChecking(true);
      try {
        const name = fullName.trim();
        const hasEmail = email.includes("@");
        const [exact, near] = await Promise.all([
          lookup({
            data: {
              email: hasEmail ? email.trim() : undefined,
              full_name: name.length >= 2 ? name : undefined,
            },
          }),
          name.length >= 2
            ? search({ data: { q: name, limit: 5 } })
            : Promise.resolve([] as MatchRow[]),
        ]);
        setMatch(exact as Lookup);
        // Filter out the exact match from suggestions
        const exactId = (exact as Lookup)?.found ? (exact as MatchRow).id : null;
        setSuggestions(((near as MatchRow[]) ?? []).filter((r) => r.id !== exactId));
      } catch {
        setMatch(null);
        setSuggestions([]);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => {
      if (debRef.current) window.clearTimeout(debRef.current);
    };
  }, [fullName, email, lookup, search, picked]);

  function pickSuggestion(row: MatchRow) {
    setPicked(row);
    setFullName(row.full_name);
    setMatch({ found: true, ...row });
    setSuggestions([]);
  }

  function clearPicked() {
    setPicked(null);
    setMatch(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await register({
        data: { full_name: fullName.trim(), email: email.trim().toLowerCase(), password: pass },
      });
      setSuccess({
        full_name: res.full_name,
        negocio: res.negocio,
        setor: res.setor,
        cargo: res.cargo,
        perfil: res.perfil,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar";
      toast.error("Não rolou cadastrar", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = match?.found === true && !match.already_claimed && pass.length >= 6;

  return (
    <LiquidBackground>
      <main className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-6 pb-10 pt-12">
        <div className="flex flex-col items-center text-center">
          <img
            src={hectorLogo}
            alt="Hector Studios"
            className="h-16 w-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <h1 className="mt-8 font-display text-[30px] font-black leading-[0.95] tracking-[-0.04em] text-white text-balance">
            {success ? "Cadastro confirmado" : "Vire um Herói da Cultura"}
          </h1>
          <p className="mt-3 max-w-[320px] text-[14px] leading-relaxed text-white/75">
            {success
              ? "Sua conta tá pronta. Bora entrar?"
              : "Digite seu nome e email do pré-cadastro. A gente já preenche o resto."}
          </p>
        </div>

        {success ? (
          <div className="glass-strong mt-10 rounded-[32px] p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-magic-green to-celeste">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <div className="mt-6 space-y-1 text-[14px] text-white/85">
              <p className="font-semibold text-[17px] text-white">{success.full_name}</p>
              <p className="text-white/65">
                {success.cargo ?? "—"} · {success.setor ?? "—"}
              </p>
              <p className="text-white/55 text-[12.5px]">
                {success.negocio} · nível {success.perfil}
              </p>
            </div>

            <a
              href="/login"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[15px] font-semibold text-blu transition active:scale-[0.98]"
            >
              Entrar no app
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="glass-strong mt-8 space-y-3 rounded-[32px] p-6">
            <Field icon={<User className="h-4 w-4" />} label="Nome completo">
              <input
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (picked) setPicked(null);
                }}
                maxLength={120}
                className="w-full bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
                placeholder="Como está na sua carteira"
              />
            </Field>

            <Field icon={<Mail className="h-4 w-4" />} label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                className="w-full bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
                placeholder="voce@email.com"
              />
            </Field>

            {/* Match preview */}
            <MatchPreview match={match} checking={checking} onClear={picked ? clearPicked : undefined} />

            {/* Fuzzy suggestions */}
            {!picked && suggestions.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-1.5 px-1 pb-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
                  <Search className="h-3 w-3" />
                  {match?.found ? "Outros parecidos" : "Talvez seja você"}
                </div>
                <ul className="space-y-1">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => pickSuggestion(s)}
                        disabled={s.already_claimed}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-white/90 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        <span>
                          <span className="block font-semibold">{s.full_name}</span>
                        </span>

                        {s.already_claimed ? (
                          <span className="text-[10.5px] uppercase tracking-wider text-magic-red/80">
                            já usado
                          </span>
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Field icon={<Lock className="h-4 w-4" />} label="Senha">
              <input
                type="password"
                required
                autoComplete="new-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                minLength={6}
                maxLength={72}
                className="w-full bg-transparent text-[15px] text-white placeholder:text-white/40 focus:outline-none"
                placeholder="mín. 6 caracteres"
              />
            </Field>

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="!mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[15px] font-semibold text-blu transition active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Criar conta <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <p className="!mt-4 text-center text-[11px] leading-relaxed text-white/55">
              Seus dados ficam no banco protegido da Hector. Não tem cadastro? Procure seu líder.
            </p>
          </form>
        )}
      </main>
    </LiquidBackground>
  );
}

function MatchPreview({
  match,
  checking,
  onClear,
}: {
  match: Lookup;
  checking: boolean;
  onClear?: () => void;
}) {
  if (checking) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12.5px] text-white/60">
        <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
        Procurando você no pré-cadastro…
      </div>
    );
  }
  if (!match) return null;
  if (!match.found) {
    return (
      <div className="rounded-2xl border border-magic-amber/30 bg-magic-amber/10 px-4 py-3 text-[12.5px] text-magic-amber">
        Não te achamos exatamente. Veja as sugestões abaixo ou confirme o nome como está na carteira.
      </div>
    );
  }
  if (match.already_claimed) {
    return (
      <div className="rounded-2xl border border-magic-red/30 bg-magic-red/10 px-4 py-3 text-[12.5px] text-magic-red">
        Esse cadastro já foi usado. Vá em <a href="/login" className="underline">/login</a> ou peça reset de senha.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-magic-green/30 bg-magic-green/10 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-magic-green/90">
          <Sparkles className="h-3.5 w-3.5" /> Encontramos você
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-white/60 underline-offset-2 hover:underline"
          >
            trocar
          </button>
        )}
      </div>
      <p className="mt-1 text-[15px] font-semibold text-white">{match.full_name}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/65">
        <Building2 className="h-3.5 w-3.5" />
        Seus dados completos aparecem após o login.
      </p>

    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/55">
        {icon}
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
