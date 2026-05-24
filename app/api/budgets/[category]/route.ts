import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params {
  params: Promise<{ category: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { category } = await params;
  try {
    await db.budget.delete({ where: { category: decodeURIComponent(category) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
