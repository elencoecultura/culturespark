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
