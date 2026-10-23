import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
  password: z.string().min(6, "Senha precisa ter 6+ caracteres").max(72),
});

export type RegistrationInput = z.infer<typeof schema>;

// Precisa espelhar exatamente public.normalize_name() (SQL) — que tira acento
// via translate() antes do lower(trim(...)). Comparar só com .toLowerCase()
// (sem tirar acento) faz nomes com ã/ô/á/etc. nunca baterem com o
// name_normalized já salvo no banco, mesmo com o pré-cadastro existindo.
const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

export const registerHero = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyPreRegistration, isPrivilegedPerfil } = await import("@/lib/pre-registration.server");

    const normalizedFullName = normalizeName(data.full_name);

    // Pre-check: must exist in pre_registrations and not be claimed.
    // Reads the table directly (admin client) — the public RPC intentionally hides PII now.
    // Duas consultas separadas (sem .or() montado com texto do usuário: nome com
    // vírgula/parêntese mudava o filtro do PostgREST).
    const cols = "id, full_name, email, cargo, setor, perfil, negocio, name_normalized, claimed_by";
    const { data: byEmail, error: eErr } = await supabaseAdmin
      .from("pre_registrations")
      .select(cols)
      .ilike("email", data.email.replace(/[\\%_]/g, "\\$&"))
      .limit(1);
    if (eErr) throw new Error(eErr.message);
    let pre = (byEmail ?? [])[0] as any;
    if (!pre) {
      const { data: byName, error: nErr } = await supabaseAdmin
        .from("pre_registrations")
        .select(cols)
        .eq("name_normalized", normalizedFullName)
        .limit(1);
      if (nErr) throw new Error(nErr.message);
      pre = (byName ?? [])[0] as any;
    }
    if (!pre) {
      throw new Error(
        "Não encontramos seu nome no pré-cadastro. Procure seu líder ou um admin para te incluir antes de criar a conta.",
      );
    }
    if (pre.claimed_by) {
      throw new Error("Esse pré-cadastro já foi usado. Faça login ou peça reset de senha.");
    }
    // Pré-cadastro com e-mail só pode ser usado por esse e-mail: o nome sozinho
    // não prova que é a pessoa.
    if (pre.email && pre.email.trim().toLowerCase() !== data.email) {
      throw new Error("Esse pré-cadastro está ligado a outro e-mail. Use o e-mail informado ao RH ou procure um admin.");
    }
    // Papéis de liderança não se auto-cadastram: o admin cria a conta pelo
    // painel (Pré-cadastro → Criar conta), que confere a identidade.
    if (isPrivilegedPerfil(pre.perfil)) {
      throw new Error("Cadastros de liderança são ativados por um admin. Procure o RH ou um admin para liberar sua conta.");
    }

    // Create the auth user. O vínculo com o pré-cadastro é feito aqui no
    // servidor (applyPreRegistration), não pelo que o cliente mandou.
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
      app_metadata: { pre_registration_id: pre.id },
    });

    if (error || !created.user) {
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Este email já está cadastrado.");
      }
      throw new Error("Falha ao criar cadastro. Tente de novo ou procure um líder.");
    }

    await applyPreRegistration(created.user.id, pre.id);

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("hero_id, full_name, negocio, setor, role_title")
      .eq("id", created.user.id)
      .single();

    if (pErr || !profile) {
      throw new Error("Cadastro criado, mas falhou ao recuperar perfil. Procure um líder.");
    }

    return {
      hero_id: profile.hero_id as string,
      full_name: profile.full_name as string,
      negocio: (profile.negocio ?? pre.negocio) as string,
      setor: (profile.setor ?? pre.setor) as string | null,
      cargo: (profile.role_title ?? pre.cargo) as string | null,
      perfil: pre.perfil as string,
    };
  });
