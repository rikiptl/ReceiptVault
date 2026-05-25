import crypto from "crypto";
import { db } from "./db";

export type WebhookEvent =
  | "receipt.created"
  | "receipt.ocr_completed"
  | "receipt.updated"
  | "receipt.deleted";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  receipt: Record<string, unknown>;
}

/**
 * Fire all enabled webhooks that subscribe to `event`.
 * Runs entirely in the background — never throws, never blocks the caller.
 */
export function dispatchWebhook(
  event: WebhookEvent,
  receipt: Record<string, unknown>
): void {
  // Intentionally not awaited — fire-and-forget
  _dispatch(event, receipt).catch((err) =>
    console.error("[webhook] dispatch error:", err)
  );
}

async function _dispatch(
  event: WebhookEvent,
  receipt: Record<string, unknown>
): Promise<void> {
  const hooks = await db.webhook.findMany({ where: { enabled: true } });
  if (!hooks.length) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    receipt,
  };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    hooks
      .filter((h) => h.events.split(",").map((e) => e.trim()).includes(event))
      .map((h) => deliverOne(h.url, h.secret, body, h.id))
  );
}

async function deliverOne(
  url: string,
  secret: string,
  body: string,
  hookId: string
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ReceiptVault-Webhook/1.0",
    "X-ReceiptVault-Event": "webhook",
  };

  // HMAC-SHA256 signature when a secret is set
  if (secret) {
    const sig = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    headers["X-ReceiptVault-Signature"] = `sha256=${sig}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000), // 10 s max
    });
    console.log(`[webhook] ${hookId} → ${url} : ${res.status}`);
  } catch (err) {
    console.error(`[webhook] ${hookId} → ${url} failed:`, err);
  }
}

/** Build a clean receipt object to include in webhook payloads */
export function receiptPayload(r: Record<string, unknown>): Record<string, unknown> {
  return {
    id:               r.id,
    merchant:         r.merchant,
    date:             r.date,
    total:            r.total,
    subtotal:         r.subtotal,
    tax:              r.tax,
    tip:              r.tip,
    currency:         r.currency,
    category:         r.category,
    tags:             r.tags,
    confidence:       r.confidence,
    paymentMethod:    r.paymentMethod,
    storePhone:       r.storePhone,
    reimbursable:     r.reimbursable,
    isRecurring:      r.isRecurring,
    recurringInterval:r.recurringInterval,
    warrantyExpiry:   r.warrantyExpiry,
    returnStatus:     r.returnStatus,
    returnDeadline:   r.returnDeadline,
    projectId:        r.projectId,
    verified:         r.verified,
    ocrDone:          r.ocrDone,
    originalName:     r.originalName,
    fileSize:         r.fileSize,
    createdAt:        r.createdAt,
    updatedAt:        r.updatedAt,
  };
}
