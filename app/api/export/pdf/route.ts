import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
// @ts-ignore — pdfkit types declared via @types/pdfkit
import PDFDocument from "pdfkit";

// ── Colour palette ────────────────────────────────────────────────────────────
const GREEN  = "#16a34a";
const DARK   = "#111827";
const MED    = "#374151";
const LIGHT  = "#6b7280";
const RULE   = "#e5e7eb";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: string | null | undefined) => {
  if (!v) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? v : `$${n.toFixed(2)}`;
};
const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return s; }
};

// ── PDF builder ───────────────────────────────────────────────────────────────
async function buildPDF(params: {
  year: string | null;
  reimbursable: boolean;
  cat: string;
}): Promise<Buffer> {
  const { year, reimbursable, cat } = params;

  // ── Query ──────────────────────────────────────────────────────────────────
  const where = {
    ...(year ? {
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00Z`),
        lt:  new Date(`${parseInt(year) + 1}-01-01T00:00:00Z`),
      },
    } : {}),
    ...(reimbursable ? { reimbursable: true } : {}),
    ...(cat ? { category: cat } : {}),
  };

  const receipts = await db.receipt.findMany({
    where,
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });

  // ── Aggregate ──────────────────────────────────────────────────────────────
  let totalSpend = 0;
  let reimbSpend = 0;
  const byCategory: Record<string, { items: typeof receipts; total: number }> = {};

  for (const r of receipts) {
    const amt = parseFloat(r.total ?? "");
    const v   = isNaN(amt) ? 0 : amt;
    totalSpend += v;
    if (r.reimbursable) reimbSpend += v;

    const key = r.category ?? "Uncategorized";
    byCategory[key] ??= { items: [], total: 0 };
    byCategory[key].items.push(r);
    byCategory[key].total += v;
  }

  const categories = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);

  // ── Document ───────────────────────────────────────────────────────────────
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data",  (c: Buffer) => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_W = doc.page.width  - 100; // usable width (margin 50 each side)
    const L      = 50;                    // left margin
    const R      = L + PAGE_W;            // right edge

    // ── COLUMN X positions ───────────────────────────────────────────────────
    const COL = {
      date:     L,
      merchant: L + 75,
      notes:    L + 235,
      reimb:    L + 355,
      amount:   R,
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const hr = (y: number, color = RULE) => {
      doc.moveTo(L, y).lineTo(R, y).strokeColor(color).lineWidth(0.5).stroke();
    };

    const needsPage = (extraPx = 40) => {
      if (doc.y + extraPx > doc.page.height - 60) {
        doc.addPage();
        return true;
      }
      return false;
    };

    // ── PAGE 1: HEADER ────────────────────────────────────────────────────────
    doc
      .fontSize(22).fillColor(GREEN).font("Helvetica-Bold")
      .text("ReceiptVault", L, 50, { continued: true })
      .fontSize(22).fillColor(DARK)
      .text("  Tax Report");

    const subtitle = [
      year ? `Year: ${year}` : "All time",
      reimbursable ? "Reimbursable only" : null,
      cat ? `Category: ${cat}` : null,
    ].filter(Boolean).join(" · ");

    doc
      .fontSize(10).fillColor(LIGHT).font("Helvetica")
      .text(`${subtitle}   ·   Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, L, doc.y + 4);

    hr(doc.y + 10, GREEN);
    doc.moveDown(1.2);

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    doc.fontSize(11).fillColor(DARK).font("Helvetica-Bold").text("SUMMARY");
    doc.moveDown(0.4);

    const summaryRow = (label: string, value: string, highlight = false) => {
      const y = doc.y;
      doc
        .fontSize(9).fillColor(MED).font("Helvetica")
        .text(label, L, y, { width: PAGE_W - 100 })
        .font(highlight ? "Helvetica-Bold" : "Helvetica")
        .fillColor(highlight ? GREEN : DARK)
        .text(value, L, y, { width: PAGE_W, align: "right" });
      doc.moveDown(0.35);
    };

    summaryRow("Total Receipts",       `${receipts.length}`);
    summaryRow("Total Spend",          `$${totalSpend.toFixed(2)}`, true);
    if (!reimbursable) {
      summaryRow("Reimbursable",         `$${reimbSpend.toFixed(2)}`);
      summaryRow("Non-reimbursable",     `$${(totalSpend - reimbSpend).toFixed(2)}`);
    }

    doc.moveDown(0.5);

    // ── CATEGORY SUMMARY TABLE ────────────────────────────────────────────────
    doc.fontSize(11).fillColor(DARK).font("Helvetica-Bold").text("BY CATEGORY");
    doc.moveDown(0.4);

    for (const [name, { items, total }] of categories) {
      const y = doc.y;
      doc
        .fontSize(9).fillColor(MED).font("Helvetica")
        .text(name, L, y, { width: PAGE_W - 120 })
        .text(`${items.length} receipt${items.length !== 1 ? "s" : ""}`, L, y, { width: PAGE_W - 70, align: "right" })
        .fillColor(DARK).font("Helvetica-Bold")
        .text(`$${total.toFixed(2)}`, L, y, { width: PAGE_W, align: "right" });
      doc.moveDown(0.35);
    }

    hr(doc.y + 6);
    doc.moveDown(1.5);

    // ── PER-CATEGORY DETAIL ───────────────────────────────────────────────────
    for (const [catName, { items, total }] of categories) {
      needsPage(80);

      // Category heading
      doc.fontSize(12).fillColor(GREEN).font("Helvetica-Bold").text(catName, L);
      doc.fontSize(9).fillColor(LIGHT).font("Helvetica")
        .text(`$${total.toFixed(2)} · ${items.length} receipt${items.length !== 1 ? "s" : ""}`, L);
      doc.moveDown(0.4);

      // Column headers
      const hY = doc.y;
      doc.fontSize(8).fillColor(LIGHT).font("Helvetica-Bold")
        .text("Date",     COL.date,     hY, { width: 70 })
        .text("Merchant", COL.merchant, hY, { width: 155 })
        .text("Notes",    COL.notes,    hY, { width: 115 })
        .text("Reimb.",   COL.reimb,    hY, { width: 40, align: "center" })
        .text("Amount",   COL.amount,   hY, { width: 60, align: "right" });

      doc.moveDown(0.25);
      hr(doc.y);
      doc.moveDown(0.3);

      // Receipt rows
      for (const r of items) {
        needsPage(20);
        const rY = doc.y;
        const amount = parseFloat(r.total ?? "");
        doc
          .fontSize(8).fillColor(MED).font("Helvetica")
          .text(fmtDate(r.date ?? r.createdAt.toISOString()), COL.date,     rY, { width: 70 })
          .text(r.merchant ?? r.originalName,                  COL.merchant, rY, { width: 155, ellipsis: true })
          .fillColor(LIGHT)
          .text((r.notes ?? r.tags.join(", ") ?? "").slice(0, 40), COL.notes, rY, { width: 115, ellipsis: true })
          .fillColor(r.reimbursable ? GREEN : LIGHT)
          .text(r.reimbursable ? "✓" : "–",                    COL.reimb,    rY, { width: 40, align: "center" })
          .fillColor(DARK).font("Helvetica-Bold")
          .text(isNaN(amount) ? "—" : `$${amount.toFixed(2)}`, COL.amount,   rY, { width: 60, align: "right" });
        doc.moveDown(0.5);
      }

      // Category total row
      hr(doc.y);
      doc.moveDown(0.3);
      const tY = doc.y;
      doc
        .fontSize(8).fillColor(MED).font("Helvetica-Bold")
        .text("Category Total", COL.merchant, tY, { width: 155 })
        .fillColor(GREEN)
        .text(`$${total.toFixed(2)}`, COL.amount, tY, { width: 60, align: "right" });
      doc.moveDown(1.5);
    }

    // ── GRAND TOTAL ───────────────────────────────────────────────────────────
    needsPage(60);
    hr(doc.y, GREEN);
    doc.moveDown(0.5);
    const gY = doc.y;
    doc
      .fontSize(11).fillColor(DARK).font("Helvetica-Bold")
      .text("GRAND TOTAL", L, gY, { width: PAGE_W - 90 })
      .fillColor(GREEN)
      .text(`$${totalSpend.toFixed(2)}`, L, gY, { width: PAGE_W, align: "right" });
    if (!reimbursable && reimbSpend > 0) {
      doc.moveDown(0.4);
      const rY2 = doc.y;
      doc
        .fontSize(9).fillColor(LIGHT).font("Helvetica")
        .text(`Reimbursable: $${reimbSpend.toFixed(2)}`, L, rY2, { width: PAGE_W - 90 })
        .text(`Non-reimbursable: $${(totalSpend - reimbSpend).toFixed(2)}`, L, rY2, { width: PAGE_W, align: "right" });
    }

    // ── PAGE NUMBERS ──────────────────────────────────────────────────────────
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7).fillColor(LIGHT).font("Helvetica")
        .text(
          `ReceiptVault Tax Report · Page ${i + 1} of ${pages.count}`,
          L, doc.page.height - 35,
          { width: PAGE_W, align: "center" }
        );
    }

    doc.end();
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year         = searchParams.get("year");
  const reimbursable = searchParams.get("reimbursable") === "true";
  const cat          = searchParams.get("cat") ?? "";

  try {
    const pdf = await buildPDF({ year, reimbursable, cat });

    const parts  = [year ?? "all", reimbursable ? "reimbursable" : "", cat].filter(Boolean);
    const filename = `receiptvault-tax-${parts.join("-")}.pdf`;

    return new NextResponse(pdf, {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(pdf.length),
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
