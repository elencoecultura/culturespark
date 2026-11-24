// Regras do check-in diário compartilhadas entre servidor e app.

export const CHECKIN_TZ = "America/Sao_Paulo";

/** Mensagem que o servidor devolve quando falta o check-in do dia; o app reconhece e leva pro check-in. */
export const CHECKIN_REQUIRED_MESSAGE =
  "Faça seu check-in de energia do dia antes de interagir. Ele fica no topo da tela inicial.";

export function isCheckinRequiredError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return msg.includes(CHECKIN_REQUIRED_MESSAGE);
}

/** Data (aaaa-mm-dd) no fuso do app. */
export function saoPauloDayKey(d: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHECKIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);
}
