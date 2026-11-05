// Server-only: exporta um ReportResult em PDF (identidade Hector Studios,
// título, filtros, data e autor) e em Excel (uma aba por seção, um registro
// por linha).
import type { ReportResult } from "@/lib/reports/report-defs";

export type ExportMeta = { generatedBy: string; generatedAt: Date };

const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);
// Helvetica/WinAnsi não desenha emoji, controle nem quebra de linha.
export function pdfSafe(text: unknown): string {
  return Array.from(String(text ?? "").replace(/[\r\n\t]+/g, " "))
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(c);
    })
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

const stamp = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function renderXlsx(r: ReportResult, meta: ExportMeta): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const info = [
    ["Hector Studios · Por trás da Magia"],
    [r.title],
    [r.group],
    ...r.filtersLabel.map((f) => [f]),
    [`Gerado em ${stamp(meta.generatedAt)} por ${meta.generatedBy}`],
    ...r.notes.map((n) => [n]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Sobre");
  const used = new Set<string>(["Sobre"]);
  r.sections.forEach((s, i) => {
    let name =
      s.title
        .replace(/[\\/?*[\]:]/g, " ")
        .slice(0, 28)
        .trim() || `Seção ${i + 1}`;
    while (used.has(name)) name = `${name.slice(0, 25)} ${i + 1}`;
    used.add(name);
    const ws = XLSX.utils.aoa_to_sheet([
      s.columns,
      ...s.rows.map((row) => row.map((c) => (c == null ? "" : c))),
    ]);
    ws["!cols"] = s.columns.map((c, ci) => ({
      wch: Math.min(
        60,
        Math.max(c.length, ...s.rows.slice(0, 200).map((row) => String(row[ci] ?? "").length)) + 2,
      ),
    }));
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: s.rows.length, c: s.columns.length - 1 },
      }),
    };
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

export async function renderPdf(r: ReportResult, meta: ExportMeta): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`${r.title} · Hector Studios`);
  doc.setAuthor(meta.generatedBy);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842,
    H = 595,
    M = 32; // A4 deitado
  const navy = rgb(0.106, 0.122, 0.369);
  const magenta = rgb(0.894, 0.318, 0.961);
  const ink = rgb(0.12, 0.12, 0.18);
  const gray = rgb(0.42, 0.42, 0.5);
  const zebra = rgb(0.955, 0.955, 0.975);

  let page = doc.addPage([W, H]);
  let y = H;
  const pages: (typeof page)[] = [page];

  const text = (t: string, x: number, yy: number, size: number, f = font, color = ink) =>
    page.drawText(pdfSafe(t), { x, y: yy, size, font: f, color });
  const fit = (t: string, width: number, size: number, f = font) => {
    let s = pdfSafe(t);
    if (f.widthOfTextAtSize(s, size) <= width) return s;
    while (s.length > 1 && f.widthOfTextAtSize(`${s}…`, size) > width) s = s.slice(0, -1);
    return `${s}…`;
  };
  const wrap = (t: string, width: number, size: number, maxLines: number) => {
    const words = pdfSafe(t).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length)
      lines[maxLines - 1] = fit(`${lines[maxLines - 1]}…`, width, size);
    return lines.map((l) => fit(l, width, size));
  };

  const header = (first: boolean) => {
    page.drawRectangle({ x: 0, y: H - 46, width: W, height: 46, color: navy });
    page.drawRectangle({ x: 0, y: H - 49, width: W, height: 3, color: magenta });
    text("HECTOR STUDIOS", M, H - 29, 13, bold, rgb(1, 1, 1));
    text("Por trás da Magia · Relatórios", M + 128, H - 29, 10, font, rgb(0.85, 0.87, 1));
    text(
      r.group.toUpperCase(),
      W - M - bold.widthOfTextAtSize(pdfSafe(r.group.toUpperCase()), 9),
      H - 29,
      9,
      bold,
      rgb(0.85, 0.87, 1),
    );
    y = H - 72;
    if (first) {
      text(r.title, M, y, 18, bold, navy);
      y -= 18;
      text(r.filtersLabel.join("   ·   "), M, y, 8.5, font, gray);
      y -= 12;
      text(`Gerado em ${stamp(meta.generatedAt)} por ${meta.generatedBy}`, M, y, 8.5, font, gray);
      y -= 8;
      for (const n of r.notes) {
        y -= 11;
        text(fit(n, W - 2 * M, 8.5), M, y, 8.5, font, magenta);
      }
      y -= 16;
    }
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    pages.push(page);
    header(false);
  };
  header(true);

  for (const s of r.sections) {
    const size = 7.6;
    const avail = W - 2 * M;
    // Cada coluna tem um mínimo (o título dela, ou o conteúdo se for curto);
    // o que sobra da página vai para as colunas de texto longo.
    const headW = s.columns.map((c) => bold.widthOfTextAtSize(pdfSafe(c), size) + 8);
    const desired = s.columns.map((_, ci) => {
      const cells = s.rows
        .slice(0, 300)
        .map((row) => font.widthOfTextAtSize(pdfSafe(row[ci] ?? ""), size) + 8);
      return Math.min(320, Math.max(headW[ci], ...cells, 26));
    });
    // colunas curtas (datas, notas, ciclo) nunca são cortadas
    const mins = desired.map((d, ci) => (d <= 66 ? d : Math.max(headW[ci], 34)));
    const total = desired.reduce((a, b) => a + b, 0);
    let widths: number[];
    if (total > avail) {
      const minSum = mins.reduce((a, b) => a + b, 0);
      const extra = desired.reduce((acc, d, ci) => acc + (d - mins[ci]), 0) || 1;
      widths = desired.map(
        (d, ci) => mins[ci] + Math.max(0, avail - minSum) * ((d - mins[ci]) / extra),
      );
    } else {
      // tabela estreita com texto longo (mensagens): estica a coluna mais larga
      widths = desired.slice();
      const wide = desired.indexOf(Math.max(...desired));
      if (desired[wide] >= 200) widths[wide] += avail - total;
    }
    const lineH = 10;

    if (y < 90) newPage();
    text(s.title, M, y, 11.5, bold, navy);
    y -= 6;
    if (s.note) {
      y -= 10;
      text(fit(s.note, avail, 7.8), M, y, 7.8, font, gray);
    }
    y -= 6;
    const drawHead = () => {
      page.drawRectangle({
        x: M,
        y: y - 15,
        width: widths.reduce((a, b) => a + b, 0),
        height: 15,
        color: navy,
      });
      let x = M;
      s.columns.forEach((c, ci) => {
        text(fit(c, widths[ci] - 6, size, bold), x + 3, y - 10.5, size, bold, rgb(1, 1, 1));
        x += widths[ci];
      });
      y -= 15;
    };
    drawHead();
    if (!s.rows.length) {
      y -= 12;
      text("Sem registros para este filtro.", M + 3, y, size, font, gray);
      y -= 6;
    }
    s.rows.forEach((row, ri) => {
      const cells = row.map((c, ci) => wrap(String(c ?? "—"), widths[ci] - 6, size, 4));
      const lines = Math.max(1, ...cells.map((c) => c.length));
      const rowH = lines * lineH + 4;
      if (y - rowH < 36) {
        newPage();
        drawHead();
      }
      if (ri % 2 === 1)
        page.drawRectangle({
          x: M,
          y: y - rowH,
          width: widths.reduce((a, b) => a + b, 0),
          height: rowH,
          color: zebra,
        });
      let x = M;
      cells.forEach((cl, ci) => {
        cl.forEach((ln, li) => text(ln, x + 3, y - 9 - li * lineH, size));
        x += widths[ci];
      });
      y -= rowH;
    });
    y -= 22;
  }

  pages.forEach((p, i) => {
    const foot = pdfSafe(
      `Confidencial · Hector Studios · ${r.title} · gerado em ${stamp(meta.generatedAt)} por ${meta.generatedBy}`,
    );
    p.drawText(foot, { x: M, y: 16, size: 7, font, color: gray });
    const pg = `${i + 1}/${pages.length}`;
    p.drawText(pg, { x: W - M - font.widthOfTextAtSize(pg, 7), y: 16, size: 7, font, color: gray });
  });
  return doc.save();
}
