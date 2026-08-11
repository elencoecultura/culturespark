import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Generates a PDF for an evaluation and returns it as base64 data URL.
// Client can trigger a download from the returned string.
export const generateEvaluationPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ evaluation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    // Fetch evaluation data (RLS-protected)
    const { data: ev, error } = await context.supabase
      .from("evaluations")
      .select("*, evaluation_cycles(*)")
      .eq("id", data.evaluation_id)
      .single();
    if (error) throw new Error(error.message);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name,attraction,role_title,email")
      .eq("id", ev.evaluatee_id)
      .maybeSingle();

    const { data: pillars } = await context.supabase
      .from("evaluation_pillars")
      .select("*")
      .order("sort_order");
    const { data: comps } = await context.supabase
      .from("evaluation_competencies")
      .select("*")
      .order("sort_order");
    const { data: scores } = await context.supabase
      .from("evaluation_scores")
      .select("*")
      .eq("evaluation_id", data.evaluation_id);
    const { data: pdis } = await context.supabase
      .from("evaluation_pdis")
      .select("*")
      .eq("evaluation_id", data.evaluation_id);

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([595, 842]); // A4
    let y = 800;
    const margin = 40;
    const purple = rgb(0.55, 0.32, 0.85);
    const dark = rgb(0.1, 0.1, 0.15);
    const gray = rgb(0.45, 0.45, 0.5);

    const drawText = (text: string, opts: { x?: number; size?: number; f?: any; color?: any } = {}) => {
      page.drawText(text, {
        x: opts.x ?? margin,
        y,
        size: opts.size ?? 10,
        font: opts.f ?? font,
        color: opts.color ?? dark,
      });
    };
    const ensureSpace = (needed: number) => {
      if (y - needed < 60) {
        page = doc.addPage([595, 842]);
        y = 800;
      }
    };

    // Header
    page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: purple });
    y = 810;
    drawText("HECTOR STUDIOS · Avaliação de Desempenho", {
      x: margin,
      size: 14,
      f: bold,
      color: rgb(1, 1, 1),
    });
    y = 760;

    // Meta
    drawText(`Ciclo: ${ev.evaluation_cycles?.name ?? "-"}`, { f: bold, size: 11 });
    y -= 16;
    drawText(
      `Período: ${ev.evaluation_cycles?.starts_on ?? "-"} a ${ev.evaluation_cycles?.ends_on ?? "-"}`,
      { size: 10, color: gray },
    );
    y -= 20;
    drawText(`Avaliado(a): ${profile?.full_name ?? "-"}`, { f: bold, size: 11 });
    y -= 14;
    drawText(`Atração: ${profile?.attraction ?? "-"}  ·  Cargo: ${profile?.role_title ?? "-"}`, {
      size: 10,
      color: gray,
    });
    y -= 24;

    // Pillars & competencies
    for (const p of pillars ?? []) {
      ensureSpace(60);
      page.drawRectangle({ x: margin, y: y - 4, width: 515, height: 18, color: rgb(0.93, 0.9, 0.98) });
      drawText(p.name.toUpperCase(), { x: margin + 6, size: 11, f: bold, color: purple });
      y -= 24;
      const pillarComps = (comps ?? []).filter((c: any) => c.pillar_id === p.id);
      for (const c of pillarComps) {
        ensureSpace(28);
        const compScores = (scores ?? []).filter((s: any) => s.competency_id === c.id);
        const avg = compScores.length
          ? (compScores.reduce((a: number, s: any) => a + Number(s.score), 0) / compScores.length).toFixed(1)
          : "—";
        drawText(`• ${c.name}`, { size: 10 });
        drawText(`Nota: ${avg} / Esperado: ${c.expected_score}`, {
          x: 420,
          size: 10,
          f: bold,
          color: purple,
        });
        y -= 14;
        if (c.description) {
          drawText(c.description.slice(0, 110), { x: margin + 12, size: 8, color: gray });
          y -= 12;
        }
      }
      y -= 8;
    }

    // PDIs
    ensureSpace(60);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 4, width: 515, height: 18, color: rgb(0.93, 0.9, 0.98) });
    drawText("PLANOS DE DESENVOLVIMENTO (PDI)", { x: margin + 6, size: 11, f: bold, color: purple });
    y -= 24;
    if ((pdis ?? []).length === 0) {
      drawText("Nenhum PDI registrado neste ciclo.", { size: 10, color: gray });
      y -= 14;
    }
    for (const p of pdis ?? []) {
      ensureSpace(50);
      drawText(`• ${p.objective}`, { size: 10, f: bold });
      y -= 14;
      if (p.actions) {
        drawText(`Ações: ${p.actions.slice(0, 100)}`, { x: margin + 12, size: 9, color: gray });
        y -= 12;
      }
      if (p.due_on) {
        drawText(`Prazo: ${p.due_on}`, { x: margin + 12, size: 9, color: gray });
        y -= 12;
      }
      y -= 4;
    }

    // Signatures
    ensureSpace(120);
    y -= 24;
    drawText("Assinaturas", { size: 11, f: bold });
    y -= 30;
    page.drawLine({ start: { x: margin, y }, end: { x: 260, y }, thickness: 0.7, color: dark });
    page.drawLine({ start: { x: 320, y }, end: { x: 550, y }, thickness: 0.7, color: dark });
    y -= 12;
    drawText("Avaliado(a)", { x: margin, size: 9, color: gray });
    drawText("Líder / Avaliador", { x: 320, size: 9, color: gray });

    const bytes = await doc.save();
    const b64 = Buffer.from(bytes).toString("base64");
    return {
      filename: `avaliacao-${(profile?.full_name ?? "elenco").replace(/\s+/g, "_")}.pdf`,
      dataUrl: `data:application/pdf;base64,${b64}`,
    };
  });
