import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin pode alterar a hierarquia.");
}

// Garante que quem vai virar manager_id/co_leader_id de alguém de fato tem
// papel de liderança — evita que um manager_id aponte pra uma conta elenco
// e essa conta ganhe acesso de líder por tabela via can_view_user_data/
// can_access_evaluation (RLS), sem nunca ter recebido o papel.
async function assertLeadershipRole(supabase: any, ids: (string | null | undefined)[]) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (!uniqueIds.length) return;
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", uniqueIds);
  const leadershipRoles = new Set(["lider", "leader", "gerente", "direcao", "admin"]);
  const rolesById = new Map<string, string[]>();
  (roleRows ?? []).forEach((r: any) => {
    const arr = rolesById.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesById.set(r.user_id, arr);
  });
  for (const id of uniqueIds) {
    const roles = rolesById.get(id) ?? [];
    if (!roles.some((r) => leadershipRoles.has(r))) {
      throw new Error("A pessoa escolhida como líder/co-líder não tem papel de liderança.");
    }
  }
}

// Lista todo o elenco/liderança com o líder e co-líder atuais.
// Retorna também nomes dos líderes já resolvidos para exibir sem N+1 no cliente.
export const listCastWithHierarchy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id,full_name,role_title,negocio,setor,attraction,active,manager_id,co_leader_id,email")
      .order("full_name");
    if (error) throw new Error(error.message);

    const rows = profiles ?? [];
    const nameById = new Map<string, string>(rows.map((p: any) => [p.id, p.full_name]));

    const { data: rolesRows } = await context.supabase
      .from("user_roles")
      .select("user_id, role");
    const rolesById = new Map<string, string[]>();
    (rolesRows ?? []).forEach((r: any) => {
      const arr = rolesById.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesById.set(r.user_id, arr);
    });

    return rows.map((p: any) => ({
      ...p,
      manager_name: p.manager_id ? nameById.get(p.manager_id) ?? null : null,
      co_leader_name: p.co_leader_id ? nameById.get(p.co_leader_id) ?? null : null,
      roles: rolesById.get(p.id) ?? [],
    }));
  });

// Lista quem pode ser líder/co-líder (rank >= lider).
export const listAssignableLeaders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: rolesRows } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["lider", "gerente", "direcao", "admin"]);
    const leaderIds = Array.from(new Set((rolesRows ?? []).map((r: any) => r.user_id)));
    if (!leaderIds.length) return [];
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id,full_name,role_title,negocio,active")
      .in("id", leaderIds)
      .eq("active", true)
      .order("full_name");
    const roleMap = new Map<string, string[]>();
    (rolesRows ?? []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return (profs ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const updateProfileHierarchy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        profile_id: z.string().uuid(),
        manager_id: z.string().uuid().nullable().optional(),
        co_leader_id: z.string().uuid().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    await assertLeadershipRole(context.supabase, [data.manager_id, data.co_leader_id]);
    const patch: {
      manager_id?: string | null;
      co_leader_id?: string | null;
      active?: boolean;
    } = {};
    if (data.manager_id !== undefined) patch.manager_id = data.manager_id;
    if (data.co_leader_id !== undefined) patch.co_leader_id = data.co_leader_id;
    if (data.active !== undefined) patch.active = data.active;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkAssignLeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        profile_ids: z.array(z.string().uuid()).min(1),
        manager_id: z.string().uuid().nullable().optional(),
        co_leader_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    await assertLeadershipRole(context.supabase, [data.manager_id, data.co_leader_id]);
    const patch: { manager_id?: string | null; co_leader_id?: string | null } = {};
    if (data.manager_id !== undefined) patch.manager_id = data.manager_id;
    if (data.co_leader_id !== undefined) patch.co_leader_id = data.co_leader_id;
    if (Object.keys(patch).length === 0) return { updated: 0 };
    const { error, count } = await context.supabase
      .from("profiles")
      .update(patch, { count: "exact" })
      .in("id", data.profile_ids);
    if (error) throw new Error(error.message);
    return { updated: count ?? data.profile_ids.length };
  });
