import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Attach receipt stats to each project
  const withStats = await Promise.all(
    projects.map(async (p) => {
      const receipts = await db.receipt.findMany({
        where: { projectId: p.id },
        select: { total: true, currency: true, createdAt: true },
      });
      const count = receipts.length;
      let totalSpend = 0;
      for (const r of receipts) {
        const v = parseFloat(r.total ?? "");
        if (!isNaN(v)) totalSpend += v;
      }
      const lastActivity = receipts.reduce<Date | null>((max, r) =>
        !max || r.createdAt > max ? r.createdAt : max, null
      );
      return { ...p, count, totalSpend, lastActivity };
    })
  );

  return NextResponse.json(withStats);
}

export async function POST(req: NextRequest) {
  const { name, description, color, icon } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const project = await db.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: color || "#22c55e",
      icon:  icon  || "📁",
    },
  });
  return NextResponse.json(project, { status: 201 });
}
