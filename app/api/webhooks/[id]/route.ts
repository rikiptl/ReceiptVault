import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

/** PATCH /api/webhooks/[id] — update label/secret/events/enabled */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const allowed = ["url", "label", "secret", "events", "enabled"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }

  try {
    const hook = await db.webhook.update({ where: { id }, data });
    return NextResponse.json(hook);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/** DELETE /api/webhooks/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await db.webhook.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
