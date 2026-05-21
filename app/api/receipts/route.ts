import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const cat = searchParams.get("cat") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

  const where = {
    ...(q
      ? {
          OR: [
            { merchant: { contains: q, mode: "insensitive" as const } },
            { ocrText: { contains: q, mode: "insensitive" as const } },
            { notes: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(cat && cat !== "All" ? { category: cat } : {}),
  };

  const [receipts, total] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.receipt.count({ where }),
  ]);

  return NextResponse.json({ receipts, total, page, pageSize });
}
