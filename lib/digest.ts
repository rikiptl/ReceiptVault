import { db } from "./db";

export interface DigestData {
  periodLabel:  string;
  totalSpend:   number;
  receiptCount: number;
  reimbTotal:   number;
  topCategories: { name: string; amount: number; count: number }[];
  topMerchants:  { name: string; amount: number; count: number }[];
  unverified:    number;
  pendingReturns:number;
}

export async function buildDigestData(days = 7): Promise<DigestData> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const receipts = await db.receipt.findMany({
    where: { createdAt: { gte: since } },
    select: {
      total: true, category: true, merchant: true,
      reimbursable: true, verified: true, returnStatus: true,
    },
  });

  let totalSpend = 0, reimbTotal = 0;
  const catMap: Record<string, { amount: number; count: number }> = {};
  const merMap:  Record<string, { amount: number; count: number }> = {};

  for (const r of receipts) {
    const v = parseFloat(r.total ?? "");
    if (!isNaN(v) && v > 0) {
      totalSpend += v;
      if (r.reimbursable) reimbTotal += v;
      const cat = r.category ?? "Other";
      catMap[cat] = catMap[cat] ?? { amount: 0, count: 0 };
      catMap[cat].amount += v;
      catMap[cat].count  += 1;
      const mer = r.merchant ?? "Unknown";
      merMap[mer] = merMap[mer] ?? { amount: 0, count: 0 };
      merMap[mer].amount += v;
      merMap[mer].count  += 1;
    }
  }

  const [unverified, pendingReturns] = await Promise.all([
    db.receipt.count({ where: { ocrDone: true, verified: false } }),
    db.receipt.count({ where: { returnStatus: "pending" } }),
  ]);

  const topCategories = Object.entries(catMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const topMerchants = Object.entries(merMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    periodLabel:   `Last ${days} days`,
    totalSpend,
    receiptCount:  receipts.length,
    reimbTotal,
    topCategories,
    topMerchants,
    unverified,
    pendingReturns,
  };
}

// ── Slack Block Kit ──────────────────────────────────────────────────────────

export function buildSlackBlocks(d: DigestData): object {
  const catLines = d.topCategories.length
    ? d.topCategories.map((c) => `• *${c.name}*: $${c.amount.toFixed(2)} (${c.count})`).join("\n")
    : "_No spending this period_";

  const alerts: string[] = [];
  if (d.unverified > 0)     alerts.push(`📥 *${d.unverified}* receipt${d.unverified > 1 ? "s" : ""} need verification`);
  if (d.pendingReturns > 0) alerts.push(`↩️ *${d.pendingReturns}* pending return${d.pendingReturns > 1 ? "s" : ""}`);

  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🧾 ReceiptVault — ${d.periodLabel} Summary`, emoji: true },
      },
      { type: "divider" },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Total Spend*\n$${d.totalSpend.toFixed(2)}` },
          { type: "mrkdwn", text: `*Receipts*\n${d.receiptCount}` },
          { type: "mrkdwn", text: `*Reimbursable*\n$${d.reimbTotal.toFixed(2)}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Top Categories*\n${catLines}` },
      },
      ...(alerts.length
        ? [{
            type: "section",
            text: { type: "mrkdwn", text: `*Action Needed*\n${alerts.join("\n")}` },
          }]
        : []),
      { type: "divider" },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: "Sent by ReceiptVault · /settings to manage digest" }],
      },
    ],
  };
}

// ── HTML email ───────────────────────────────────────────────────────────────

export function buildDigestHtml(d: DigestData): string {
  const catRows = d.topCategories.map(
    (c) =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${c.name}</td>` +
      `<td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">$${c.amount.toFixed(2)}</td>` +
      `<td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280">${c.count}</td></tr>`
  ).join("");

  const alerts: string[] = [];
  if (d.unverified > 0)     alerts.push(`📥 ${d.unverified} receipt${d.unverified > 1 ? "s" : ""} need verification`);
  if (d.pendingReturns > 0) alerts.push(`↩️ ${d.pendingReturns} pending return${d.pendingReturns > 1 ? "s" : ""}`);

  const alertHtml = alerts.length
    ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin:16px 0">
        <p style="margin:0;font-size:14px;color:#854d0e;font-weight:600">Action Needed</p>
        ${alerts.map((a) => `<p style="margin:4px 0 0;font-size:13px;color:#92400e">${a}</p>`).join("")}
       </div>`
    : "";

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#16a34a;padding:24px 28px">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700">🧾 ReceiptVault</p>
    <p style="margin:4px 0 0;color:#bbf7d0;font-size:14px">${d.periodLabel} Spending Summary</p>
  </div>
  <div style="padding:24px 28px">
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Total Spend</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#111">$${d.totalSpend.toFixed(2)}</p>
      </div>
      <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Receipts</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#111">${d.receiptCount}</p>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Reimbursable</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#16a34a">$${d.reimbTotal.toFixed(2)}</p>
      </div>
    </div>

    ${alertHtml}

    <p style="font-weight:600;color:#111;font-size:15px;margin:20px 0 10px">Top Categories</p>
    ${d.topCategories.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#f9fafb">
        <th style="padding:6px 12px;text-align:left;color:#6b7280;font-weight:500">Category</th>
        <th style="padding:6px 12px;text-align:right;color:#6b7280;font-weight:500">Amount</th>
        <th style="padding:6px 12px;text-align:right;color:#6b7280;font-weight:500">Receipts</th>
      </tr></thead>
      <tbody>${catRows}</tbody>
    </table>` : `<p style="color:#9ca3af;font-size:14px">No spending this period.</p>`}
  </div>
  <div style="padding:16px 28px;background:#f9fafb;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">Sent by ReceiptVault · manage in /settings</p>
  </div>
</div></body></html>`;
}
