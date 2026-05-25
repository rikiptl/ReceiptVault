import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/export/quickbooks
 * Exports receipts in QuickBooks Online-compatible CSV format.
 * QBO accepts: Date, Description, Amount, Account, Tax Amount, Memo
 *
 * Also supports ?format=iif for QuickBooks Desktop IIF format.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year         = searchParams.get("year");
  const reimbursable = searchParams.get("reimbursable") === "true";
  const cat          = searchParams.get("cat") ?? "";
  const format       = searchParams.get("format") ?? "csv"; // "csv" | "iif"

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
    orderBy: { createdAt: "asc" },
  });

  // ── QuickBooks Online CSV ────────────────────────────────────────────────
  if (format !== "iif") {
    const esc = (v: string | null | undefined) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };

    // Format date as MM/DD/YYYY for QBO
    const fmtDate = (dateStr: string | null) => {
      if (!dateStr) return "";
      // Try parsing YYYY-MM-DD or similar
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${m}/${day}/${d.getFullYear()}`;
    };

    const header = ["Date", "Description", "Amount", "Account", "Tax Amount", "Memo"];
    const rows = receipts.map((r) => {
      const amount = r.total ? `-${parseFloat(r.total).toFixed(2)}` : "";
      const tax    = r.tax   ?  parseFloat(r.tax).toFixed(2)        : "0.00";
      const account = `Expenses:${r.category ?? "Uncategorized"}`;
      return [
        esc(fmtDate(r.date)),
        esc(r.merchant ?? r.originalName),
        amount,
        esc(account),
        tax,
        esc(r.notes ?? ""),
      ];
    });

    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const suffix = year ?? new Date().getFullYear();
    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="receiptvault-quickbooks-${suffix}.csv"`,
      },
    });
  }

  // ── QuickBooks Desktop IIF ───────────────────────────────────────────────
  // IIF format: header rows (!TRNS / !SPL) followed by transaction pairs
  const lines: string[] = [
    "!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
    "!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
    "!ENDTRNS",
  ];

  const fmtDateIIF = (dateStr: string | null) => {
    if (!dateStr) return new Date().toLocaleDateString("en-US");
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  for (const r of receipts) {
    const amount  = r.total ? (-parseFloat(r.total)).toFixed(2) : "0.00";
    const sAmount = r.total ? parseFloat(r.total).toFixed(2)    : "0.00";
    const date    = fmtDateIIF(r.date);
    const name    = (r.merchant ?? "").replace(/\t/g, " ");
    const cat     = (r.category ?? "Uncategorized").replace(/\t/g, " ");
    const memo    = (r.notes ?? "").replace(/\t/g, " ");

    lines.push(
      `TRNS\tEXPENSE\t${date}\tChecking\t${name}\t${amount}\t${memo}`,
      `SPL\tEXPENSE\t${date}\t${cat}\t${name}\t${sAmount}\t`,
      "ENDTRNS"
    );
  }

  const iif = lines.join("\n");
  const suffix = year ?? new Date().getFullYear();
  return new NextResponse(iif, {
    headers: {
      "Content-Type":        "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="receiptvault-qb-desktop-${suffix}.iif"`,
    },
  });
}
