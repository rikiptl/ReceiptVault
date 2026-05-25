import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDigestData, buildSlackBlocks, buildDigestHtml } from "@/lib/digest";

/**
 * POST /api/digest/send?days=7
 * Sends the spending digest to Slack and/or email (via Resend).
 */
export async function POST(req: NextRequest) {
  const days     = parseInt(new URL(req.url).searchParams.get("days") ?? "7");
  const settings = await db.appSettings.findUnique({ where: { id: "singleton" } });

  if (!settings) {
    return NextResponse.json({ ok: false, error: "No settings configured" }, { status: 400 });
  }

  const data = await buildDigestData(days);
  const results: Record<string, string> = {};

  // ── Slack ─────────────────────────────────────────────────────────────────
  if (settings.slackWebhookUrl) {
    try {
      const res = await fetch(settings.slackWebhookUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildSlackBlocks(data)),
        signal:  AbortSignal.timeout(10_000),
      });
      results.slack = res.ok ? "sent" : `error ${res.status}`;
    } catch (err) {
      results.slack = `failed: ${err instanceof Error ? err.message : err}`;
    }
  }

  // ── Email via Resend REST API ─────────────────────────────────────────────
  if (settings.resendApiKey && settings.digestToEmail) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${settings.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    settings.digestFromEmail || "digest@receiptvault.app",
          to:      [settings.digestToEmail],
          subject: `ReceiptVault — ${data.periodLabel} Spending Summary ($${data.totalSpend.toFixed(2)})`,
          html:    buildDigestHtml(data),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await res.json() as { id?: string; message?: string };
      results.email = res.ok ? `sent (id: ${body.id})` : `error: ${body.message}`;
    } catch (err) {
      results.email = `failed: ${err instanceof Error ? err.message : err}`;
    }
  }

  if (!Object.keys(results).length) {
    return NextResponse.json({
      ok: false,
      error: "No Slack webhook or email configured in Settings",
    }, { status: 400 });
  }

  return NextResponse.json({ ok: true, results, summary: {
    totalSpend:   data.totalSpend,
    receiptCount: data.receiptCount,
    periodLabel:  data.periodLabel,
  }});
}
