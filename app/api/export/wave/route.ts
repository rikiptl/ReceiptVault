import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/export/wave
 * Exports receipts in Wave Accounting CSV import format.
 *
 * Wave format:
 *   Transaction Date, Description, Debit Amount, Credit Amount,
 *   Account Name, Tax Name, Tax Amount
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year         = searchParams.get("year");
  const reimbursable = searchParams.get("reimbursable") === "true";
  const cat          = searchParams.get("cat") ?? "";

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

  const receipts = await db.receipt.findMany({ where, orderBy: { createdAt: "asc" } });

  const esc = (v: string | null | undefined) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };

  // Wave expects YYYY-MM-DD
  const fmtDate = (dateStr: string | null) => {
    if (!dateStr) return new Date().toISOString().slice(0, 10);
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  };

  const header = [
    "Transaction Date",
    "Description",
    "Debit Amount",
    "Credit Amount",
    "Account Name",
    "Tax Name",
    "Tax Amount",
  ];

  const rows = receipts.map((r) => {
    const debit = r.total ? parseFloat(r.total).toFixed(2) : "";
    const tax   = r.tax   ? parseFloat(r.tax).toFixed(2)   : "";
    const acct  = `${r.category ?? "Uncategorized"} Expenses`;
    return [
      esc(fmtDate(r.date)),
      esc(r.merchant ?? r.originalName),
      debit,           // debit (expense)
      "",              // credit (blank for expenses)
      esc(acct),
      "",              // tax name — user maps in Wave
      tax,
    ];
  });

  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const suffix = year ?? new Date().getFullYear();

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receiptvault-wave-${suffix}.csv"`,
    },
  });
}
