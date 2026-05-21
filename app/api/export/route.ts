import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  const where = year
    ? {
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lt: new Date(`${parseInt(year) + 1}-01-01T00:00:00Z`),
        },
      }
    : {};

  const receipts = await db.receipt.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  // Build CSV
  const header = [
    "Date",
    "Merchant",
    "Total",
    "Tax",
    "Currency",
    "Category",
    "Verified",
    "OCR Text (excerpt)",
    "Notes",
    "Filename",
    "Uploaded At",
  ];

  const escape = (val: string | null | undefined) => {
    if (val == null) return "";
    const s = String(val).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s}"`
      : s;
  };

  const rows = receipts.map((r) => [
    escape(r.date),
    escape(r.merchant),
    escape(r.total),
    escape(r.tax),
    escape(r.currency),
    escape(r.category),
    r.verified ? "Yes" : "No",
    escape(r.ocrText?.slice(0, 200)),
    escape(r.notes),
    escape(r.originalName),
    r.createdAt.toISOString(),
  ]);

  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");

  const filename = year
    ? `receiptvault-${year}.csv`
    : `receiptvault-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
