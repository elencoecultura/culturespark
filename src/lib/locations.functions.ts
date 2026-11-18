import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin: unidades onde login/check-in valem por localização, e o registro das
// últimas tentativas (pra descobrir IP novo ou raio pequeno demais).

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas admin");
}

const MIGRATION_HINT = "Falta aplicar a migration de localização no Supabase (20261118120000_acesso_por_localizacao.sql).";

export const listAllowedLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("allowed_locations")
      .select("id, name, lat, lng, radius_m, active, created_at")
      .order("name");
    if (error) return { locations: [], setupMissing: true as const };
    return { locations: data ?? [], setupMissing: false as const };
  });

export const addAllowedLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius_m: z.number().int().min(50).max(3000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("allowed_locations").insert({ ...data, created_by: context.userId });
    if (error) throw new Error(/relation|schema cache/i.test(error.message) ? MIGRATION_HINT : error.message);
    return { ok: true };
  });

export const updateAllowedLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean().optional(),
        radius_m: z.number().int().min(50).max(3000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("allowed_locations").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAllowedLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("allowed_locations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAccessAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ onlyBlocked: z.boolean().default(true) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("access_attempts")
      .select("id, user_id, context, method, allowed, reason, ip, nearest_location, distance_m, accuracy_m, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.onlyBlocked) q = q.eq("allowed", false);
    const { data: rows, error } = await q;
    if (error) return { attempts: [] };
    const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: ppl } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, attraction").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string; attraction: string | null }> };
    const byId = new Map((ppl ?? []).map((p) => [p.id, p]));
    return {
      attempts: (rows ?? []).map((r) => ({
        ...r,
        name: byId.get(r.user_id)?.full_name ?? "—",
        attraction: byId.get(r.user_id)?.attraction ?? null,
      })),
    };
  });
