import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import LiquidBackground from "@/components/link-cultura/LiquidBackground";
import hectorLogo from "@/assets/hector-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Definir senha · Por trás da Magia" },
      { name: "description", content: "Defina sua senha de acesso ao Por trás da Magia." },
    ],
  }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // O link de convite/recuperação estabelece a sessão automaticamente
    // (Supabase lê o token no hash da URL). Só liberamos o formulário
    // depois de confirmar que a sessão existe.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        toast.error("Link inválido ou expirado", {
          description: "Peça um novo link de acesso.",
        });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pass.length < 6) {
      toast.error("Senha muito curta", { description: "Use ao menos 6 caracteres." });
      return;
    }
    if (pass !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) {
      toast.error("Não rolou definir a senha", { description: error.message });
      return;
    }
    toast.success("Senha definida!");
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
            Definir senha
          </h1>
          <p className="mt-3 max-w-[300px] text-[14px] leading-relaxed text-white/75">
            Escolha a senha que vai usar daqui pra frente pra entrar no Por trás da Magia.
          </p>
        </div>

        <form onSubmit={onSubmit} className="glass-strong mt-10 rounded-[32px] p-6">
          <label className="block">
            <span className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
              Nova senha
            </span>
            <div className="glass-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <Lock size={18} className="shrink-0 text-white/60" />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="mín. 6 caracteres"
                className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
                autoComplete="new-password"
                disabled={!ready}
              />
            </div>
          </label>

          <label className="mt-4 block">
            <span className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
              Confirmar senha
            </span>
            <div className="glass-input mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <Lock size={18} className="shrink-0 text-white/60" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="repita a senha"
                className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
                autoComplete="new-password"
                disabled={!ready}
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || !ready}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-[15px] font-semibold tracking-[0.01em] text-blu shadow-glow transition active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Salvar senha <ArrowRight size={18} strokeWidth={2.4} />
              </>
            )}
          </button>
        </form>

        <p className="mt-auto pt-10 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
          Hector Studios · Por trás da Magia
        </p>
      </main>
    </LiquidBackground>
  );
}
