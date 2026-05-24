import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const receipts = await db.receipt.findMany({
    where: { returnStatus: { not: null } },
    select: {
      id: true,
      merchant: true,
      originalName: true,
      date: true,
      total: true,
      currency: true,
      category: true,
      returnDeadline: true,
      returnStatus: true,
      returnNotes: true,
      createdAt: true,
    },
    orderBy: [
      // nulls last for deadline, then by createdAt
      { returnDeadline: "asc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json({ results: receipts });
}
