import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { db } from "@/lib/db";
import { dispatchWebhook, receiptPayload } from "@/lib/webhooks";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const receipt = await db.receipt.findUnique({ where: { id } });
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(receipt);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "merchant",
    "date",
    "total",
    "tax",
    "currency",
    "category",
    "notes",
    "verified",
    "tags",
    "isRecurring",
    "recurringInterval",
    "warrantyExpiry",
    "reimbursable",
    "returnDeadline",
    "returnStatus",
    "returnNotes",
    "subtotal",
    "tip",
    "confidence",
    "paymentMethod",
    "storePhone",
    "projectId",
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  try {
    const updated = await db.receipt.update({ where: { id }, data });
    dispatchWebhook("receipt.updated", receiptPayload(updated as Record<string, unknown>));
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const receipt = await db.receipt.delete({ where: { id } });
    // Delete file from disk (best-effort)
    unlink(receipt.filePath).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
