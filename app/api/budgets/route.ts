import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const budgets = await db.budget.findMany({ orderBy: { category: "asc" } });
  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const { category, monthlyLimit } = await req.json();

  if (!category || typeof monthlyLimit !== "number" || monthlyLimit <= 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const budget = await db.budget.upsert({
    where: { category },
    create: { id: crypto.randomUUID(), category, monthlyLimit },
    update: { monthlyLimit },
  });

  return NextResponse.json(budget);
}
