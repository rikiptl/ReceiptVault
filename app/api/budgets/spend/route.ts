import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Returns { [category]: totalSpendThisMonth } for all categories that have receipts
export async function GET() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const receipts = await db.receipt.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      category:  { not: null },
    },
    select: { category: true, total: true },
  });

  const spend: Record<string, number> = {};
  for (const r of receipts) {
    const cat = r.category!;
    const amt = parseFloat(r.total ?? "");
    if (!isNaN(amt) && amt > 0) {
      spend[cat] = (spend[cat] ?? 0) + amt;
    }
  }

  return NextResponse.json(spend);
}
