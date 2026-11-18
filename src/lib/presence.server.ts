// Server-only. Regra única de "a pessoa está numa unidade?" para o login e
// para cada check-in. Passa quem é liberado de qualquer lugar (admin, líder,
// gerente, direção, Trupe, passe livre); os demais precisam estar num Wi-Fi
// da lista OU dentro do raio de uma unidade cadastrada.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateGeo, matchesIpEntry, type AllowedLocation, type GeoPoint } from "@/lib/security-rules";

export type PresenceContext = "login" | "checkin";

export type PresenceResult =
  | { allowed: true; reason: string }
  | {
      allowed: false;
      reason: "need_location" | "geo_outside" | "geo_imprecise" | "ip_blocked";
      nearest?: { name: string; distance: number } | null;
      accuracy?: number;
    };

// Validação por localização feita há pouco (ex.: no login) vale pro check-in
// logo em seguida, sem pedir o GPS de novo.
const RECENT_GEO_MS = 30 * 60 * 1000;
const RETENTION_DAYS = 90;

const FREE_ROLES = ["admin", "direcao", "gerente", "lider"] as const;

export async function exemptionReason(userId: string): Promise<string | null> {
  const checks = await Promise.all(
    FREE_ROLES.map((role) => supabaseAdmin.rpc("has_role", { _user_id: userId, _role: role })),
  );
  const i = checks.findIndex((c: any) => c.data);
  if (i === 0) return "admin";
  if (i > 0) return "leadership";
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("wifi_bypass, attraction")
    .eq("id", userId)
    .maybeSingle();
  if ((prof?.attraction ?? "").toUpperCase() === "TRUPE") return "trupe";
  if (prof?.wifi_bypass) return "bypass";
  return null;
}

// Tabela pode ainda não existir (migration não aplicada): trata como vazia.
async function activeLocations(): Promise<AllowedLocation[]> {
  const { data, error } = await supabaseAdmin
    .from("allowed_locations")
    .select("name, lat, lng, radius_m")
    .eq("active", true);
  if (error) return [];
  return (data ?? []) as AllowedLocation[];
}

async function logAttempt(row: {
  userId: string;
  context: PresenceContext;
  method: string;
  allowed: boolean;
  reason: string;
  ip: string;
  nearest?: { name: string; distance: number } | null;
  accuracy?: number;
}) {
  try {
    await supabaseAdmin.from("access_attempts").insert({
      user_id: row.userId,
      context: row.context,
      method: row.method,
      allowed: row.allowed,
      reason: row.reason,
      ip: row.ip || null,
      nearest_location: row.nearest?.name ?? null,
      distance_m: row.nearest?.distance ?? null,
      accuracy_m: row.accuracy != null ? Math.round(row.accuracy) : null,
    });
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
      await supabaseAdmin.from("access_attempts").delete().lt("created_at", cutoff);
    }
  } catch {
    // registro é diagnóstico: nunca derruba o login/check-in
  }
}

async function recentGeoPass(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - RECENT_GEO_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("access_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("allowed", true)
    .eq("method", "geo")
    .gte("created_at", since)
    .limit(1);
  return !error && (data?.length ?? 0) > 0;
}

/** Decide presença de quem NÃO é isento (chamar exemptionReason antes). */
export async function evaluatePresence(opts: {
  userId: string;
  context: PresenceContext;
  ip: string;
  geo?: GeoPoint | null;
}): Promise<PresenceResult> {
  const { userId, context, ip, geo } = opts;
  const [{ data: allow }, locations] = await Promise.all([
    supabaseAdmin.from("wifi_allowlist").select("ip"),
    activeLocations(),
  ]);
  const ipList = (allow ?? []).map((r) => r.ip as string);

  if (ip && ipList.some((entry) => matchesIpEntry(ip, entry))) {
    await logAttempt({ userId, context, method: "ip", allowed: true, reason: "ip_match", ip });
    return { allowed: true, reason: "ip_match" };
  }

  if (locations.length === 0) {
    // Sem unidade cadastrada: login segue só o IP (como sempre foi) e o
    // check-in fica livre — a trava de check-in só liga quando o admin
    // cadastrar a primeira unidade.
    if (context === "checkin") return { allowed: true, reason: "locations_unconfigured" };
    if (ipList.length === 0) return { allowed: true, reason: "allowlist_empty" };
    await logAttempt({ userId, context, method: "ip", allowed: false, reason: "ip_blocked", ip });
    return { allowed: false, reason: "ip_blocked" };
  }

  if (!geo) {
    if (await recentGeoPass(userId)) return { allowed: true, reason: "geo_recent" };
    return { allowed: false, reason: "need_location" };
  }

  const verdict = evaluateGeo(geo, locations);
  if (verdict.inside) {
    await logAttempt({ userId, context, method: "geo", allowed: true, reason: "geo_inside", ip, nearest: verdict.nearest, accuracy: geo.accuracy });
    return { allowed: true, reason: "geo_inside" };
  }
  const reason = verdict.imprecise ? "geo_imprecise" : "geo_outside";
  await logAttempt({ userId, context, method: "geo", allowed: false, reason, ip, nearest: verdict.nearest, accuracy: geo.accuracy });
  return { allowed: false, reason, nearest: verdict.nearest, accuracy: geo.accuracy };
}
