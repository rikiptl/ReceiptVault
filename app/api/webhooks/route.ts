import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/webhooks — list all webhooks */
export async function GET() {
  const hooks = await db.webhook.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(hooks);
}

/** POST /api/webhooks — create a webhook */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, label, secret, events } = body as Record<string, string>;

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ error: "Valid URL required" }, { status: 400 });
  }

  const hook = await db.webhook.create({
    data: {
      url,
      label:  label  ?? "",
      secret: secret ?? "",
      events: events ?? "receipt.created,receipt.ocr_completed",
    },
  });

  return NextResponse.json(hook, { status: 201 });
}
