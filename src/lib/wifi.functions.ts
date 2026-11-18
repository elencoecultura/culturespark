import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pickClientIp } from "@/lib/security-rules";

function clientIp(): string {
  return pickClientIp((name) => getRequestHeader(name));
}

const ipSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-fA-F0-9.:]+(\/\d{1,3})?$/, "IP inválido");

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1_000_000),
});

/**
 * Chamado logo após o login. Passa de qualquer lugar: admin, líder, gerente,
 * direção, Trupe, passe livre (wifi_bypass) e o 1º acesso. Os demais precisam
 * estar num Wi-Fi da lista OU dentro do raio de uma unidade (ver
 * presence.server.ts). Sem `geo` e fora do Wi-Fi, devolve
 * reason "need_location" — o cliente pede o GPS e chama de novo com `geo`.
 */
export const enforceWifiLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ geo: geoPointSchema.optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const ip = clientIp();
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { exemptionReason, evaluatePresence } = await import("@/lib/presence.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("first_login_at")
      .eq("id", userId)
      .maybeSingle();
    const firstAccess = !prof?.first_login_at;
    if (firstAccess) {
      await supabaseAdmin
        .from("profiles")
        .update({ first_login_at: new Date().toISOString() })
        .eq("id", userId);
    }

    const exempt = await exemptionReason(userId);
    if (exempt) return { allowed: true as const, reason: exempt, ip, firstAccess };
    if (firstAccess) return { allowed: true as const, reason: "first_access", ip, firstAccess };

    const result = await evaluatePresence({ userId, context: "login", ip, geo: data.geo ?? null });
    return { ...result, ip, firstAccess };
  });

export const getMyIp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ ip: clientIp() }));

export const listAllowedIps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin");
    const { data, error } = await context.supabase
      .from("wifi_allowlist")
      .select("ip, label, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { ips: data ?? [], currentIp: clientIp() };
  });

export const addAllowedIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ip: ipSchema, label: z.string().trim().max(80).optional() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin");
    const { error } = await context.supabase
      .from("wifi_allowlist")
      .upsert({ ip: data.ip, label: data.label ?? null, created_by: context.userId });
    if (error) throw error;
    return { ok: true };
  });

export const removeAllowedIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ip: ipSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin");
    const { error } = await context.supabase.from("wifi_allowlist").delete().eq("ip", data.ip);
    if (error) throw error;
    return { ok: true };
  });

export const listBypassUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, hero_id, attraction, role_title, wifi_bypass, active")
      .eq("active", true)
      .order("hero_id", { ascending: true });
    if (error) throw error;
    return { users: data ?? [] };
  });

export const setWifiBypass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), bypass: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ wifi_bypass: data.bypass })
      .eq("id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });
