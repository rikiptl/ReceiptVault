import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/webhooks/[id]/test
 * Sends a sample `receipt.test` event to the configured URL so the user can
 * verify their endpoint is reachable and their secret is correct.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const hook = await db.webhook.findUnique({ where: { id } });
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = JSON.stringify({
    event: "receipt.test",
    timestamp: new Date().toISOString(),
    receipt: {
      id:           "test-00000000-0000-0000-0000-000000000000",
      merchant:     "Test Merchant",
      date:         "2026-01-15",
      total:        "42.99",
      currency:     "USD",
      category:     "Shopping",
      tags:         ["test"],
      confidence:   95,
      paymentMethod:"Visa",
      reimbursable: false,
      ocrDone:      true,
      verified:     false,
      createdAt:    new Date().toISOString(),
    },
  });

  const headers: Record<string, string> = {
    "Content-Type":   "application/json",
    "User-Agent":     "ReceiptVault-Webhook/1.0",
    "X-ReceiptVault-Event": "receipt.test",
  };

  if (hook.secret) {
    const sig = crypto.createHmac("sha256", hook.secret).update(payload).digest("hex");
    headers["X-ReceiptVault-Signature"] = `sha256=${sig}`;
  }

  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
    return NextResponse.json({ ok: true, status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
