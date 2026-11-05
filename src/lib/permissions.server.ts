// Server-only: checagem de ação pelo catálogo (perfil + liberação individual).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { can, type Overrides } from "@/lib/permissions-catalog";

export async function loadPermissionContext(userId: string) {
  const [{ data: roles }, { data: ov }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("user_permission_overrides").select("key, allowed").eq("user_id", userId),
  ]);
  const overrides: Overrides = {};
  for (const o of ov ?? []) overrides[o.key] = o.allowed;
  return { roles: (roles ?? []).map((r) => r.role as string), overrides };
}

export async function assertAction(userId: string, action: string) {
  const { roles, overrides } = await loadPermissionContext(userId);
  if (!can("action", action, roles, overrides))
    throw new Error("Você não tem permissão para esta ação.");
}

export async function trackAccess(userId: string, module: string) {
  await supabaseAdmin.rpc("track_access", { _user_id: userId, _module: module });
}
