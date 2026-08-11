import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
  password: z.string().min(6, "Senha precisa ter 6+ caracteres").max(72),
});

export type RegistrationInput = z.infer<typeof schema>;

export const registerHero = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pre-check: must exist in pre_registrations and not be claimed.
    // Reads the table directly (admin client) — the public RPC intentionally hides PII now.
    const { data: preRows, error: lErr } = await supabaseAdmin
      .from("pre_registrations")
      .select("id, full_name, email, cargo, setor, perfil, negocio, name_normalized, claimed_by")
      .or(`email.ilike.${data.email},name_normalized.eq.${data.full_name.toLowerCase()}`)
      .limit(5);
    if (lErr) throw new Error(lErr.message);
    const pre = (preRows ?? []).find(
      (r: any) =>
        (r.email && r.email.toLowerCase() === data.email.toLowerCase()) ||
        r.name_normalized === data.full_name.toLowerCase(),
    ) as any;
    if (!pre) {
      throw new Error(
        "Não encontramos seu nome no pré-cadastro. Procure seu líder ou um admin para te incluir antes de criar a conta.",
      );
    }
    if (pre.claimed_by) {
      throw new Error("Esse pré-cadastro já foi usado. Faça login ou peça reset de senha.");
    }


    // Create the auth user (trigger handle_new_user does profile + role + claim)
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });

    if (error || !created.user) {
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Este email já está cadastrado.");
      }
      throw new Error(error?.message || "Falha ao criar cadastro");
    }

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
