import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin");
}

// Lista todas as contas já criadas (profiles + dados reais do auth.users) —
// ferramenta de suporte pra resolver problema de cadastro (email errado,
// senha esquecida, etc). Email/confirmação/último acesso vêm sempre do
// auth.users ao vivo, nunca de profiles.email (que pode ficar desatualizado).
export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, hero_id, attraction, negocio, role_title, active")
      .order("full_name");
    if (error) throw new Error(error.message);

    const { data: usersList, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
    if (usersErr) throw new Error(usersErr.message);
    const authById = new Map(usersList.users.map((u) => [u.id, u]));

    return (profiles ?? []).map((p) => {
      const u = authById.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        hero_id: p.hero_id,
        attraction: p.attraction ?? p.negocio ?? null,
        role_title: p.role_title,
        active: p.active,
        email: u?.email ?? "",
        email_confirmed: !!u?.email_confirmed_at,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        created_at: u?.created_at ?? null,
      };
    });
  });

export const updateAccountEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        new_email: z.string().trim().toLowerCase().email("Email inválido").max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      email: data.new_email,
      email_confirm: true,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("Esse email já está em uso por outra conta.");
      }
      throw new Error(error.message);
    }

    // profiles.email só é preenchido pelo trigger de criação — precisa
    // atualizar manualmente aqui pra não ficar desatualizado.
    await supabaseAdmin.from("profiles").update({ email: data.new_email }).eq("id", data.user_id);

    return { ok: true };
  });

export const resetAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        new_password: z.string().min(6, "Senha precisa ter 6+ caracteres").max(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Gera um link de acesso direto (magic link) sem enviar email — útil quando
// a pessoa trava no login e o admin quer mandar o link por WhatsApp.
export const generateAccountAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: u, error: userErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (userErr || !u.user?.email) throw new Error("Conta sem email válido.");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: u.user.email,
    });
    if (error) throw new Error(error.message);
    return { link: link.properties.action_link };
  });
