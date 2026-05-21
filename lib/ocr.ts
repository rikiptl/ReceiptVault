import { db } from "./db";

const OCR_BASE_URL =
  process.env.OCR_BASE_URL ?? "http://localhost:11435/v1";

/**
 * Calls the Tesseract OCR microservice (OpenAI-compatible API),
 * parses the structured receipt data, and updates the DB record.
 */
export async function runOcr(
  receiptId: string,
  _filePath: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  try {
    const b64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${b64}`;

    const res = await fetch(`${OCR_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OCR_MODEL ?? "tesseract-ocr",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
      // 2-minute timeout
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      throw new Error(`OCR service returned ${res.status}`);
    }

    const json = await res.json();
    const rawContent = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse OCR JSON:", rawContent);
    }

    // Update DB with extracted fields
    await db.receipt.update({
      where: { id: receiptId },
      data: {
        merchant:    (parsed.merchant as string) || null,
        date:        (parsed.date as string) || null,
        total:       (parsed.total as string) || null,
        tax:         (parsed.tax as string) || null,
        currency:    (parsed.currency as string) || "USD",
        category:    (parsed.category as string) || null,
        ocrText:     (parsed.description as string) || null,
        items:       Array.isArray(parsed.items) ? parsed.items : [],
        notes:       (parsed.notes as string) || null,
        ocrDone:     true,
      },
    });
  } catch (err) {
    console.error(`OCR error for receipt ${receiptId}:`, err);
    // Mark as done even on failure so client stops polling
    await db.receipt.update({
      where: { id: receiptId },
      data: { ocrDone: true },
    });
  }
}
