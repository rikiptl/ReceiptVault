import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { db } from "@/lib/db";
import { runOcr } from "@/lib/ocr";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const receipt = await db.receipt.findUnique({ where: { id } });
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Reset OCR state
  await db.receipt.update({
    where: { id },
    data: {
      ocrDone:       false,
      merchant:      null,
      date:          null,
      total:         null,
      subtotal:      null,
      tax:           null,
      tip:           null,
      currency:      "USD",
      category:      null,
      ocrText:       null,
      items:         [],
      confidence:    null,
      paymentMethod: null,
      storePhone:    null,
    },
  });

  try {
    const buffer = await readFile(receipt.filePath);
    // Run OCR in background
    runOcr(id, receipt.filePath, receipt.mimeType, buffer).catch((err) => {
      console.error(`Re-run OCR failed for ${id}:`, err);
    });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "OCR restarted" });
}
