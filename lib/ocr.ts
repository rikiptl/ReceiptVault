import { db } from "./db";

const OCR_BASE_URL = process.env.OCR_BASE_URL ?? "http://localhost:11435/v1";

/**
 * Calls the Tesseract OCR microservice (OpenAI-compatible API),
 * parses the structured receipt data, checks for field-level duplicates,
 * and updates the DB record.
 *
 * v2 fields: subtotal, tip, confidence, paymentMethod, storePhone, suggestedTags
 */
export async function runOcr(
  receiptId: string,
  _filePath: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  try {
    const b64     = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${b64}`;

    const res = await fetch(`${OCR_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OCR_MODEL ?? "tesseract-ocr",
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: dataUrl } }],
          },
        ],
      }),
      signal: AbortSignal.timeout(180_000), // 3 min for complex receipts
    });

    if (!res.ok) throw new Error(`OCR service returned ${res.status}`);

    const json       = await res.json();
    const rawContent = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse OCR JSON:", rawContent.slice(0, 200));
    }

    const merchant = (parsed.merchant as string) || null;
    const date     = (parsed.date     as string) || null;
    const total    = (parsed.total    as string) || null;

    // ── Field-level duplicate detection ───────────────────────────────────────
    let dupeNote = "";
    if (merchant && total && date) {
      const existing = await db.receipt.findFirst({
        where: {
          id:       { not: receiptId },
          merchant: { equals: merchant, mode: "insensitive" },
          total,
          date,
        },
        select: { id: true },
      });
      if (existing) {
        dupeNote = `⚠️ Possible duplicate of receipt ${existing.id}`;
      }
    }

    // ── Auto-apply suggested tags ─────────────────────────────────────────────
    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? (parsed.suggestedTags as string[])
      : [];

    // Merge with any existing tags (avoids overwriting user-set tags on re-run)
    const current = await db.receipt.findUnique({
      where: { id: receiptId },
      select: { tags: true },
    });
    const mergedTags = Array.from(
      new Set([...(current?.tags ?? []), ...suggestedTags])
    );

    // ── Update DB ─────────────────────────────────────────────────────────────
    await db.receipt.update({
      where: { id: receiptId },
      data: {
        merchant,
        date,
        total,
        subtotal:      (parsed.subtotal      as string) || null,
        tax:           (parsed.tax           as string) || null,
        tip:           (parsed.tip           as string) || null,
        currency:      (parsed.currency      as string) || "USD",
        category:      (parsed.category      as string) || null,
        ocrText:       (parsed.description   as string) || null,
        items:         Array.isArray(parsed.items) ? parsed.items : [],
        confidence:    typeof parsed.confidence === "number" ? parsed.confidence : null,
        paymentMethod: (parsed.paymentMethod as string) || null,
        storePhone:    (parsed.phone         as string) || null,
        tags:          mergedTags,
        notes:         dupeNote || ((parsed.notes as string) || null),
        ocrDone:       true,
      },
    });

    console.log(
      `[OCR] ${receiptId} → merchant="${merchant}" total="${total}" ` +
      `confidence=${parsed.confidence} payment="${parsed.paymentMethod}" ` +
      `tags=[${mergedTags.join(",")}]`
    );
  } catch (err) {
    console.error(`OCR error for receipt ${receiptId}:`, err);
    await db.receipt.update({
      where: { id: receiptId },
      data: { ocrDone: true },
    });
  }
}
