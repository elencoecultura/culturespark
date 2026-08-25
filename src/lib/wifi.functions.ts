import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function clientIp(): string {
  const fromCf = getRequestHeader("cf-connecting-ip");
  if (fromCf) return fromCf.trim();
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = getRequestHeader("x-real-ip");
  if (real) return real.trim();
  return "";
}

const ipSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-fA-F0-9.:]+(\/\d{1,3})?$/, "IP inválido");

// Match an IP against entries (supports IPv4 CIDR like 10.101.0.0/24)
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) + o;
  }
  return n >>> 0;
}

function matchesEntry(clientIp: string, entry: string): boolean {
  if (!clientIp) return false;
  if (entry === clientIp) return true;
  if (entry.includes("/")) {
    const [base, bitsStr] = entry.split("/");
    const bits = Number(bitsStr);
    const a = ipv4ToInt(clientIp);
    const b = ipv4ToInt(base);
    if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    if (bits === 0) return true;
    const mask = (~0 << (32 - bits)) >>> 0;
    return (a & mask) === (b & mask);
  }
  return false;
}

/**
 * Called right after login. Returns whether the user is allowed to use the app
 * from the current network. Marks first_login_at on the very first successful access.
 *
 * Rules:
 *  - admin: sempre passa (precisa poder mexer no app de qualquer lugar)
 *  - liderança comum (líder/gerente/direção) NÃO tem bypass automático —
 *    só quem foi explicitamente liberado no painel (wifi_bypass) escapa da
 *    trava de rede, mesmo sendo líder.
 *  - first access (first_login_at is null): allowed AND timestamped
 *  - subsequent access: allowed only if client IP is in wifi_allowlist
 *  - empty allowlist: allowed (lock not configured yet — graceful default)
 */
export const enforceWifiLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ip = clientIp();
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });

    // profile flag + per-user bypass (sensitive columns: read with admin client)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("first_login_at, wifi_bypass")
      .eq("id", userId)
      .maybeSingle();

    const firstAccess = !prof?.first_login_at;

    if (firstAccess) {
      await supabaseAdmin
        .from("profiles")
        .update({ first_login_at: new Date().toISOString() })
        .eq("id", userId);
    }

    if (isAdmin) {
      return { allowed: true as const, reason: "admin", ip, firstAccess };
    }
    if (prof?.wifi_bypass) {
      return { allowed: true as const, reason: "bypass", ip, firstAccess };
    }
    if (firstAccess) {
      return { allowed: true as const, reason: "first_access", ip, firstAccess };
    }


    // Read allowlist (table is admin-only via RLS) with the already-imported admin client
    const { data: allow } = await supabaseAdmin.from("wifi_allowlist").select("ip");
    const list = (allow ?? []).map((r) => r.ip);

    if (list.length === 0) {
      return { allowed: true as const, reason: "allowlist_empty", ip, firstAccess };
    }
    if (ip && list.some((entry) => matchesEntry(ip, entry))) {
      return { allowed: true as const, reason: "ip_match", ip, firstAccess };
    }
    return { allowed: false as const, reason: "ip_blocked", ip, firstAccess };
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
