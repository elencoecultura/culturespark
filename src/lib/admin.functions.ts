import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// "leader" não existe mais como papel (virou "lider") — checagem antiga
// nunca batia com conta real nenhuma. Aceita qualquer papel de liderança.
const LEADERSHIP_ROLES = ["admin", "lider", "leader", "gerente", "direcao"] as const;
async function myLeadershipTier(supabase: any, userId: string) {
  const checks = await Promise.all(
    LEADERSHIP_ROLES.map((role) => supabase.rpc("has_role", { _user_id: userId, _role: role })),
  );
  const [isAdmin, isLider, , isGerente, isDirecao] = checks.map((c: any) => c.data);
  if (!checks.some((c: any) => c.data)) throw new Error("Forbidden");
  return { isAdmin, isLeaderTier: isLider, isGerente, isDirecao };
}

// Time de gente (Elenco) — escopado igual ao painel de check-ins:
// líder só vê quem tem manager_id apontando pra ele, gerente/direção veem
// a atração/negócio inteiro, admin e attraction/negocio="TODOS" veem tudo.
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tier = await myLeadershipTier(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: myProfile } = await supabaseAdmin
      .from("profiles")
      .select("attraction, negocio")
      .eq("id", context.userId)
      .maybeSingle();
    const hasTodosScope = myProfile?.attraction === "TODOS" || myProfile?.negocio === "TODOS";
    const seesAll = tier.isAdmin || hasTodosScope;
    const seesWholeAttraction = seesAll || tier.isGerente || tier.isDirecao;

    let q = supabaseAdmin.from("profiles").select("*").order("full_name");
    if (!seesAll) {
      q = seesWholeAttraction ? q.eq("attraction", myProfile?.attraction ?? "__none__") : q.eq("manager_id", context.userId);
    }
    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
      : { data: [] as { user_id: string; role: string }[] };
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
    const emailById = new Map(usersList.users.map((u) => [u.id, u.email ?? ""]));
    return (profiles ?? []).map((p) => ({
      ...p,
      email: emailById.get(p.id) ?? "",
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        role: z.enum(["admin", "direcao", "gerente", "lider", "elenco"]),
        attraction: z.string().optional(),
        weekly_hours: z.number().int().min(0).max(80).optional(),
        days_off: z.array(z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      attraction: data.attraction ?? null,
      weekly_hours: data.weekly_hours ?? 0,
      days_off: data.days_off ?? [],
    });
    // remove default messenger if other role chosen
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    return { id: uid };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().optional(),
        attraction: z.string().nullable().optional(),
        weekly_hours: z.number().int().min(0).max(80).optional(),
        days_off: z.array(z.string()).optional(),
        active: z.boolean().optional(),
        role: z.enum(["admin", "direcao", "gerente", "lider", "elenco"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, role, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length) {
      const { error } = await (supabaseAdmin.from("profiles") as any).update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    }
    if (role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
      await supabaseAdmin.from("user_roles").insert({ user_id: id, role });
    }
    return { ok: true };
  });

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return {
      userId: context.userId,
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
    };
  });
