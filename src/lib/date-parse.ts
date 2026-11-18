// Data da planilha -> "AAAA-MM-DD". Aceita data do Excel (Date ou número
// serial), "dd/mm/aaaa" e "aaaa-mm-dd". Qualquer outra coisa vira null.
export function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ok = (y: number, m: number, d: number) =>
    y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // cellDates do xlsx devolve meia-noite local; arredonda pro dia certo
    const t = new Date(v.getTime() + 12 * 3600_000);
    return ok(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  if (typeof v === "number" && v > 0 && v < 80000) {
    const t = new Date(Math.round((v - 25569) * 86400_000));
    return ok(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const str = String(v).trim();
  let m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return ok(Number(m[3]), Number(m[2]), Number(m[1]));
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return ok(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}
