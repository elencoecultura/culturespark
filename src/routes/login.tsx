import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import LiquidBackground from "@/components/link-cultura/LiquidBackground";
import hectorLogo from "@/assets/hector-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enforceWifiLock } from "@/lib/wifi.functions";


export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar · Encantômetro" },
      { name: "description", content: "Acesse o Encantômetro da Hector Studios." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      setLoading(false);
      toast.error("Não rolou entrar", { description: error.message });
      return;
    }

    // Wi-Fi lock: first access free, depois só pelo IP autorizado (admin sempre passa)
    try {
      const check = await enforceWifiLock();
      if (!check.allowed) {
        await supabase.auth.signOut();
        setLoading(false);
        toast.error("Rede não autorizada", {
          description: `Este Wi-Fi (${check.ip || "IP desconhecido"}) não está liberado. Conecte-se ao Wi-Fi do parque.`,
        });
        return;
      }
    } catch (err) {
      // Em caso de falha do check, não trava o usuário — log silencioso
      console.warn("wifi check failed", err);
    }

    setLoading(false);
    toast.success("Bem-vindo de volta");
    navigate({ to: "/app" });
  }



  return (
    <LiquidBackground>
      <main className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-6 pb-10 pt-14">
        <div className="flex flex-col items-center text-center">
          <img
            src={hectorLogo}
            alt="Hector Studios"
            className="h-20 w-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <h1 className="mt-10 font-display text-[34px] font-black leading-[0.95] tracking-[-0.04em] text-white text-balance">
            Bem-vindo de volta
          </h1>
          <p className="mt-3 max-w-[300px] text-[14px] leading-relaxed text-white/75">
            Entre pra continuar cuidando da cultura — um gesto por vez.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="glass-strong mt-10 rounded-[32px] p-6"
        >
          <label className="block">
            <span className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
              E-mail
            </span>
            <div className="glass-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <Mail size={18} className="shrink-0 text-white/60" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@hector.studio"
                className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="mt-4 block">
            <span className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
              Senha
            </span>
            <div className="glass-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <Lock size={18} className="shrink-0 text-white/60" />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
                autoComplete="current-password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-[15px] font-semibold tracking-[0.01em] text-blu shadow-glow transition active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Entrar <ArrowRight size={18} strokeWidth={2.4} /></>}
          </button>


        </form>

        <button className="mx-auto mt-6 text-[13px] font-medium text-white/70 underline-offset-4 hover:underline">
          Esqueci minha senha
        </button>

        <p className="mt-auto pt-10 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
          Hector Studios · Encantômetro
        </p>
      </main>
    </LiquidBackground>
  );
}

