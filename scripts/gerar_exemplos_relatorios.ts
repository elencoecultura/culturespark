// Gera um exemplo em PDF e Excel de cada relatório, com os dados reais, numa
// pasta local (não publica nada). Uso: bun scripts/gerar_exemplos_relatorios.ts PASTA_DE_SAIDA
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildReport } from "@/lib/reports/build.server";
import { renderPdf, renderXlsx } from "@/lib/reports/render.server";
import { REPORTS, periodPreset, type ReportFilters } from "@/lib/reports/report-defs";

const env = Object.fromEntries(
  readFileSync(join(import.meta.dir, "..", ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")),
      l
        .slice(l.indexOf("=") + 1)
        .trim()
        .replace(/^"|"$/g, ""),
    ]),
);
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const meta = { generatedBy: "Exemplo gerado pelo Claude (dados reais)", generatedAt: new Date() };
const ano = periodPreset("ano");
for (const r of REPORTS) {
  const f: ReportFilters =
    r.key === "engajamento"
      ? periodPreset("semana")
      : r.key === "aniversariantes" || r.key === "tempo_de_casa"
        ? periodPreset("mes")
        : ano;
  const res = await buildReport(sb, r.key, f);
  const base = `${String(REPORTS.indexOf(r) + 1).padStart(2, "0")}_${r.key}`;
  writeFileSync(join(out, `${base}.pdf`), await renderPdf(res, meta));
  writeFileSync(join(out, `${base}.xlsx`), await renderXlsx(res, meta));
  console.log(base, res.sections.map((s) => `${s.title}: ${s.rows.length}`).join(" | "));
}
// Exemplo de visão individual
const { data: top } = await sb
  .from("profiles")
  .select("id, full_name")
  .eq("full_name", "Aline da Silva Martins")
  .maybeSingle();
if (top) {
  const res = await buildReport(sb, "elogios_recebidos", { ...ano, person: top.id });
  writeFileSync(join(out, "12_elogios_recebidos_individual.pdf"), await renderPdf(res, meta));
  writeFileSync(join(out, "12_elogios_recebidos_individual.xlsx"), await renderXlsx(res, meta));
  console.log("12_individual", res.sections.map((s) => `${s.title}: ${s.rows.length}`).join(" | "));
}
