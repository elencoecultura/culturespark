import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, Mail, KeyRound, Link2, Eye, EyeOff, Check, X } from "lucide-react";
import {
  listAccounts,
  updateAccountEmail,
  resetAccountPassword,
  generateAccountAccessLink,
} from "@/lib/accounts-admin.functions";

function genPassword() {
  const words = ["Fenix", "Aurora", "Celeste", "Magia", "Estrela", "Portal"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}!`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

type Account = {
  id: string;
  full_name: string;
  hero_id: string | null;
  attraction: string | null;
  role_title: string | null;
  active: boolean;
  email: string;
  email_confirmed: boolean;
  last_sign_in_at: string | null;
  created_at: string | null;
};

function AccountRow({ account }: { account: Account }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<"email" | "password" | null>(null);

  const emailFn = useServerFn(updateAccountEmail);
  const [newEmail, setNewEmail] = useState(account.email);
  const editEmail = useMutation({
    mutationFn: () => emailFn({ data: { user_id: account.id, new_email: newEmail } }),
    onSuccess: () => {
      toast.success("Email atualizado");
      qc.invalidateQueries({ queryKey: ["accounts-admin"] });
      setExpanded(null);
    },
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });

  const passFn = useServerFn(resetAccountPassword);
  const [newPassword, setNewPassword] = useState(() => genPassword());
  const [showPass, setShowPass] = useState(false);
  const resetPass = useMutation({
    mutationFn: () => passFn({ data: { user_id: account.id, new_password: newPassword } }),
    onSuccess: () => {
      toast.success("Senha alterada", {
        description: `Repasse pra ${account.full_name} por um canal direto (WhatsApp, etc): ${newPassword}`,
      });
      setExpanded(null);
    },
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });

  const linkFn = useServerFn(generateAccountAccessLink);
  const genLink = useMutation({
    mutationFn: () => linkFn({ data: { user_id: account.id } }),
    onSuccess: (r) => {
      navigator.clipboard?.writeText(r.link).catch(() => {});
      toast.success("Link copiado", { description: "Cola e manda direto pra pessoa. Expira em 1h." });
    },
    onError: (e: any) => toast.error("Não deu", { description: e.message }),
  });

  return (
    <div className="glass-chip rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-display text-[15px] font-black tracking-[-0.02em] text-white">
              {account.full_name || "Sem nome"}
            </div>
            {!account.active && (
              <span className="shrink-0 rounded-full bg-magic-red/20 px-2 py-0.5 text-[10px] font-bold text-magic-red">
                inativo
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-white/70">{account.email || "sem email"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
            {account.hero_id && <span>{account.hero_id}</span>}
            {account.attraction && <span>{account.attraction}</span>}
            <span className={account.email_confirmed ? "text-magic-green/80" : "text-magic-amber/80"}>
              {account.email_confirmed ? "email confirmado" : "email não confirmado"}
            </span>
            <span>último acesso: {fmtDate(account.last_sign_in_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => setExpanded(expanded === "email" ? null : "email")}
            className="rounded-lg bg-white/10 p-2 text-white/80 hover:bg-white/20"
            title="Alterar email"
          >
            <Mail className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpanded(expanded === "password" ? null : "password")}
            className="rounded-lg bg-white/10 p-2 text-white/80 hover:bg-white/20"
            title="Trocar senha"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => genLink.mutate()}
            disabled={genLink.isPending}
            className="rounded-lg bg-white/10 p-2 text-white/80 hover:bg-white/20 disabled:opacity-50"
            title="Gerar link de acesso (copia automático)"
          >
            {genLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded === "email" && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2 text-[13px] text-white outline-none"
            placeholder="novo@email.com"
          />
          <button
            onClick={() => editEmail.mutate()}
            disabled={editEmail.isPending || !newEmail.includes("@")}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-grad px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {editEmail.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar
          </button>
          <button onClick={() => setExpanded(null)} className="shrink-0 rounded-xl bg-white/10 p-2 text-white/70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {expanded === "password" && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2">
            <div className="glass-input flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2">
              <input
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
              />
              <button onClick={() => setShowPass((v) => !v)} className="shrink-0 text-white/60">
                {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button
              onClick={() => resetPass.mutate()}
              disabled={resetPass.isPending || newPassword.length < 6}
              className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-grad px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {resetPass.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Trocar
            </button>
            <button onClick={() => setExpanded(null)} className="shrink-0 rounded-xl bg-white/10 p-2 text-white/70">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => setNewPassword(genPassword())}
            className="mt-2 text-[11.5px] font-semibold text-celeste underline-offset-4 hover:underline"
          >
            gerar outra senha
          </button>
        </div>
      )}
    </div>
  );
}

export default function AccountsAdmin() {
  const fn = useServerFn(listAccounts);
  const { data, isLoading } = useQuery({ queryKey: ["accounts-admin"], queryFn: () => fn() });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter(
      (r) => r.full_name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q) || r.hero_id?.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <>
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <ShieldCheck size={13} /> Admin
        </div>
        <h1 className="mt-1.5 font-display text-[24px] font-black tracking-[-0.03em] text-white">Contas cadastradas</h1>
        <p className="text-[12.5px] text-white/65">
          Veja quem já criou conta e resolva problema de login — trocar email, redefinir senha ou gerar um link de acesso direto.
        </p>
      </div>

      <div className="glass-input mt-4 flex items-center gap-2 rounded-2xl px-4 py-3">
        <Search className="h-4 w-4 text-white/50" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, email ou hero_id"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="px-1 text-[11.5px] text-white/50">
            {filtered.length} conta{filtered.length === 1 ? "" : "s"}
          </div>
          {filtered.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
          {filtered.length === 0 && (
            <div className="glass-chip rounded-2xl px-4 py-6 text-center text-[13px] text-white/70">
              Nenhuma conta encontrada.
            </div>
          )}
        </div>
      )}
    </>
  );
}
