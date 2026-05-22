import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/tags — returns all distinct tags used across receipts
export async function GET() {
  const receipts = await db.receipt.findMany({
    select: { tags: true },
    where: { tags: { isEmpty: false } },
  });
  const allTags = new Set<string>();
  for (const r of receipts) {
    for (const tag of r.tags) allTags.add(tag);
  }
  return NextResponse.json(Array.from(allTags).sort());
}
