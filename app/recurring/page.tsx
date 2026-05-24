import { db } from "@/lib/db";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const INTERVAL_ORDER = ["weekly", "monthly", "quarterly", "yearly"];

const INTERVAL_META: Record<string, { label: string; shortLabel: string; toMonthly: number }> = {
  weekly:    { label: "Weekly",    shortLabel: "wk",  toMonthly: 4.333 },
  monthly:   { label: "Monthly",   shortLabel: "mo",  toMonthly: 1     },
  quarterly: { label: "Quarterly", shortLabel: "qtr", toMonthly: 1 / 3 },
  yearly:    { label: "Yearly",    shortLabel: "yr",  toMonthly: 1 / 12 },
};

const CATEGORY_EMOJI: Record<string, string> = {
  "Groceries":      "🛒",
  "Food & Dining":  "🍔",
  "Transport":      "🚗",
  "Shopping":       "🛍️",
  "Healthcare":     "💊",
  "Utilities":      "⚡",
  "Entertainment":  "🎬",
  "Accommodation":  "🏨",
  "Software/SaaS":  "💻",
  "Other":          "📄",
};

function toMonthly(amount: number, interval: string): number {
  return amount * (INTERVAL_META[interval]?.toMonthly ?? 1);
}

export default async function RecurringPage() {
  const receipts = await db.receipt.findMany({
    where:   { isRecurring: true },
    orderBy: [{ recurringInterval: "asc" }, { merchant: "asc" }],
  });

  // Group by interval
  const byInterval: Record<string, typeof receipts> = {};
  for (const r of receipts) {
    const key = r.recurringInterval ?? "monthly";
    (byInterval[key] ??= []).push(r);
  }

  // Grand total monthly cost
  let totalMonthly = 0;
  for (const r of receipts) {
    const amt = parseFloat(r.total ?? "");
    if (!isNaN(amt) && amt > 0) {
      totalMonthly += toMonthly(amt, r.recurringInterval ?? "monthly");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🔁 Subscriptions</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {receipts.length} recurring receipt{receipts.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <Link href="/receipts?recurring=true" className="btn-secondary text-sm">
          View in list →
        </Link>
      </div>

      {/* Summary cards */}
      {receipts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-indigo-600">${totalMonthly.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Est. / month</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-gray-900">${(totalMonthly * 12).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Est. / year</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-gray-900">{receipts.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Subscriptions</p>
          </div>
        </div>
      )}

      {/* Groups */}
      {receipts.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">🔁</p>
          <p className="text-gray-500 font-medium mb-2">No recurring receipts yet</p>
          <p className="text-sm text-gray-400 mb-6">
            Open any receipt, tick "Recurring subscription" and set an interval to track it here.
          </p>
          <Link href="/receipts" className="btn-primary">Browse Receipts</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {INTERVAL_ORDER.map((interval) => {
            const items = byInterval[interval];
            if (!items?.length) return null;

            const meta = INTERVAL_META[interval];
            let groupMonthly = 0;
            for (const r of items) {
              const amt = parseFloat(r.total ?? "");
              if (!isNaN(amt) && amt > 0) groupMonthly += toMonthly(amt, interval);
            }

            return (
              <section key={interval}>
                {/* Section header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-900">
                    {meta.label}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {items.length} subscription{items.length !== 1 ? "s" : ""}
                    </span>
                  </h2>
                  <span className="text-sm font-semibold text-indigo-600">
                    ~${groupMonthly.toFixed(2)}/mo
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((r) => {
                    const amt     = parseFloat(r.total ?? "");
                    const monthly = !isNaN(amt) && amt > 0 ? toMonthly(amt, interval) : null;
                    const emoji   = CATEGORY_EMOJI[r.category ?? ""] ?? "🧾";

                    return (
                      <Link
                        key={r.id}
                        href={`/receipts/${r.id}`}
                        className="flex items-center gap-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        <span className="text-2xl shrink-0">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {r.merchant ?? r.originalName}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {r.category ?? "Uncategorized"} · {formatDate(r.createdAt.toISOString())}
                          </p>
                          {r.tags.length > 0 && (
                            <p className="text-xs text-indigo-500 mt-0.5 truncate">
                              {r.tags.join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-900 text-sm">
                            {r.total ? formatCurrency(r.total, r.currency) : "—"}
                            <span className="text-xs font-normal text-gray-400">/{meta.shortLabel}</span>
                          </p>
                          {monthly !== null && interval !== "monthly" && (
                            <p className="text-xs text-indigo-600 mt-0.5">
                              ~${monthly.toFixed(2)}/mo
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      {receipts.length > 0 && (
        <div className="card bg-blue-50 border-blue-100 text-xs text-blue-800 space-y-1">
          <p className="font-semibold text-blue-900 mb-1">Monthly estimate notes</p>
          <p>📅 Weekly × 4.33 · Quarterly ÷ 3 · Yearly ÷ 12</p>
          <p>💡 Uses the most recent recorded amount per subscription</p>
        </div>
      )}
    </div>
  );
}
