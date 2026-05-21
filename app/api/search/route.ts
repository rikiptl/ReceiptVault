import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const receipts = await db.receipt.findMany({
    where: {
      OR: [
        { merchant: { contains: q, mode: "insensitive" } },
        { ocrText: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { date: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      merchant: true,
      date: true,
      total: true,
      currency: true,
      category: true,
      originalName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ results: receipts, count: receipts.length });
}
