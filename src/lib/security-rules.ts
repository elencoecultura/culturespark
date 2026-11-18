// Regras puras de segurança usadas pelas server functions (sem I/O), num
// módulo próprio para terem teste de regressão (security-rules.test.ts).

// Perfis de pré-cadastro que dão papel de liderança: não se auto-cadastram.
const PRIVILEGED_PERFIS = new Set(["ADMIN", "DIREÇÃO", "DIRECAO", "GERENTE", "LÍDER", "LIDER"]);

export function isPrivilegedPerfil(perfil: string | null | undefined): boolean {
  return PRIVILEGED_PERFIS.has((perfil ?? "").trim().toUpperCase());
}

// Anexo (atestado/arquivo) precisa estar dentro da pasta do dono.
export function isOwnAttachmentPath(path: string, ownerId: string): boolean {
  return path.startsWith(`${ownerId}/`) && !path.includes("..") && !path.includes("//");
}

// Aniversário "perto": até 7 dias antes ou depois de `now` (fuso SP), só
// dia/mês. Cobre a semana inteira mostrada na tela de Aniversários.
export function isBirthdayNear(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!birthDate) return false;
  const [, bm, bd] = birthDate.split("-").map(Number);
  if (!bm || !bd) return false;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [ty, tm, td] = fmt.format(now).split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  return [ty - 1, ty, ty + 1].some(
    (y) => Math.abs(Date.UTC(y, bm - 1, bd) - today) <= 7 * 86_400_000,
  );
}

// IP do cliente para a trava de rede. Só vale header que a plataforma
// reescreve: na Vercel (onde o app roda), x-vercel-forwarded-for, x-real-ip e
// x-forwarded-for são sobrescritos pela borda e não dá pra forjar.
// cf-connecting-ip chegava na Vercel exatamente como o cliente mandou (dava
// pra se passar pelo IP do parque) e era lido primeiro; agora só é usado se
// nenhum header da Vercel existir (ex.: rodando atrás do Cloudflare).
export const CLIENT_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "x-real-ip",
  "x-forwarded-for",
  "cf-connecting-ip",
] as const;

export function pickClientIp(getHeader: (name: string) => string | undefined | null): string {
  for (const name of CLIENT_IP_HEADERS) {
    const v = getHeader(name);
    if (v) return v.split(",")[0]!.trim();
  }
  return "";
}

// ---------- Presença por localização (login e check-in) ----------

export type GeoPoint = { lat: number; lng: number; accuracy: number };
export type AllowedLocation = { name: string; lat: number; lng: number; radius_m: number };
export type GeoVerdict = {
  inside: boolean;
  nearest: { name: string; distance: number } | null;
  imprecise: boolean;
};

// Precisão acima disso costuma ser localização por IP/torre (desktop, GPS
// desligado): não dá pra afirmar nada, pede pra tentar de novo.
export const GEO_IMPRECISE_M = 500;
// Folga da precisão somada ao raio — dentro de prédio o GPS erra 20-100 m.
const GEO_TOLERANCE_CAP_M = 150;

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function evaluateGeo(point: GeoPoint, locations: AllowedLocation[]): GeoVerdict {
  const tolerance = Math.min(Math.max(point.accuracy, 0), GEO_TOLERANCE_CAP_M);
  let nearest: { name: string; distance: number; radius: number } | null = null;
  for (const loc of locations) {
    const distance = distanceMeters(point, loc);
    if (!nearest || distance - loc.radius_m < nearest.distance - nearest.radius) {
      nearest = { name: loc.name, distance, radius: loc.radius_m };
    }
  }
  if (!nearest) return { inside: false, nearest: null, imprecise: false };
  const inside = nearest.distance <= nearest.radius + tolerance;
  return {
    inside,
    nearest: { name: nearest.name, distance: Math.round(nearest.distance) },
    imprecise: !inside && point.accuracy > GEO_IMPRECISE_M,
  };
}

// Coordenadas coladas pelo admin: "-29.37, -50.87" ou link do Google Maps
// (".../@-29.37,-50.87,17z" ou "?q=-29.37,-50.87").
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const m = input.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// IP do cliente contra uma entrada da lista (IP exato ou CIDR IPv4, ex.: 10.1.0.0/24).
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

export function matchesIpEntry(clientIp: string, entry: string): boolean {
  if (!clientIp) return false;
  if (entry === clientIp) return true;
  if (!entry.includes("/")) return false;
  const [base, bitsStr] = entry.split("/");
  const bits = Number(bitsStr);
  const a = ipv4ToInt(clientIp);
  const b = ipv4ToInt(base);
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}
