import Link from "next/link";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import MonthlyTrend from "@/components/charts/MonthlyTrend";

export const dynamic = "force-dynamic";

// ── Colour helpers ────────────────────────────────────────────────────────────
function budgetBarColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80)  return "bg-yellow-400";
  return "bg-green-500";
}
function budgetTextColor(pct: number) {
  if (pct >= 100) return "text-red-600";
  if (pct >= 80)  return "text-yellow-600";
  return "text-green-600";
}

async function getStats() {
  const now            = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    total,
    thisMonthCount,
    recentReceipts,
    allReceipts,
    lastMonthReceipts,
    warrantyAlerts,
    budgets,
    unverifiedCount,
    pendingReturns,
  ] = await Promise.all([
    db.receipt.count(),
    db.receipt.count({ where: { createdAt: { gte: thisMonthStart } } }),
    db.receipt.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.receipt.findMany({ select: { total: true, currency: true, category: true, createdAt: true } }),
    db.receipt.findMany({
      where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
      select: { total: true },
    }),
    // Warranties expiring in ≤7 days
    db.receipt.findMany({
      where: {
        warrantyExpiry: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, merchant: true, originalName: true, warrantyExpiry: true },
      orderBy: { warrantyExpiry: "asc" },
    }),
    db.budget.findMany({ orderBy: { category: "asc" } }),
    // Unverified receipts (OCR done but not verified)
    db.receipt.count({ where: { verified: false, ocrDone: true } }),
    // Pending returns
    db.receipt.findMany({
      where: { returnStatus: "pending" },
      select: { id: true, merchant: true, originalName: true, returnDeadline: true, total: true, currency: true },
      orderBy: { returnDeadline: "asc" },
      take: 5,
    }),
  ]);

  // Spend calculations
  let totalSpend     = 0;
  let thisMonthSpend = 0;
  let lastMonthSpend = 0;
  const categoryMap: Record<string, number> = {};
  const thisMonthSpendByCat: Record<string, number> = {};

  const byMonthKey: Record<string, number> = {};

  for (const r of allReceipts) {
    const v = parseFloat(r.total ?? "");
    if (isNaN(v) || v <= 0) continue;
    totalSpend += v;

    if (r.createdAt >= thisMonthStart) {
      thisMonthSpend += v;
      const cat = r.category ?? "Other";
      thisMonthSpendByCat[cat] = (thisMonthSpendByCat[cat] ?? 0) + v;
    }

    const cat = r.category ?? "Other";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;

    // 6-month rolling trend
    const d   = r.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonthKey[key] = (byMonthKey[key] ?? 0) + v;
  }

  // Build last 6 months trend array
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      total: Math.round((byMonthKey[key] ?? 0) * 100) / 100,
    };
  });

  for (const r of lastMonthReceipts) {
    const v = parseFloat(r.total ?? "");
    if (!isNaN(v) && v > 0) lastMonthSpend += v;
  }

  const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Delta vs last month
  let deltaLabel = "";
  let deltaPositive = true;
  if (lastMonthSpend > 0) {
    const delta    = thisMonthSpend - lastMonthSpend;
    const deltaPct = Math.round(Math.abs(delta / lastMonthSpend) * 100);
    deltaPositive  = delta >= 0;
    deltaLabel     = `${delta >= 0 ? "↑" : "↓"} ${deltaPct}% vs last month`;
  } else if (thisMonthSpend > 0) {
    deltaLabel    = "First receipts this month";
    deltaPositive = true;
  }

  return {
    total, thisMonthCount, totalSpend, thisMonthSpend,
    deltaLabel, deltaPositive,
    topCategory, recentReceipts,
    warrantyAlerts,
    budgets,
    thisMonthSpendByCat,
    trendData,
    pendingReturns,
    unverifiedCount,
  };
}

export default async function DashboardPage() {
  const {
    total, thisMonthCount, totalSpend, thisMonthSpend,
    deltaLabel, deltaPositive,
    topCategory, recentReceipts,
    warrantyAlerts,
    budgets,
    thisMonthSpendByCat,
    trendData,
    pendingReturns,
    unverifiedCount,
  } = await getStats();

  const stats = [
    {
      label: "Total Receipts",
      value: total.toString(),
      icon: "🧾",
      color: "bg-blue-50 text-blue-700",
      sub: null,
    },
    {
      label: "This Month",
      value: thisMonthCount.toString(),
      icon: "📅",
      color: "bg-purple-50 text-purple-700",
      sub: null,
    },
    {
      label: "Total Spend",
      value: `$${totalSpend.toFixed(2)}`,
      icon: "💰",
      color: "bg-green-50 text-green-700",
      sub: deltaLabel ? { text: deltaLabel, positive: deltaPositive } : null,
    },
    {
      label: "Top Category",
      value: topCategory,
      icon: "📊",
      color: "bg-orange-50 text-orange-700",
      sub: null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Warranty alert banner ─────────────────────────────────────── */}
      {warrantyAlerts.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
          <span className="text-2xl shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-yellow-800 text-sm">
              {warrantyAlerts.length === 1
                ? "1 warranty expires within 7 days"
                : `${warrantyAlerts.length} warranties expire within 7 days`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {warrantyAlerts.slice(0, 3).map((r) => {
                const days = Math.ceil(
                  (new Date(r.warrantyExpiry!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <li key={r.id} className="text-xs text-yellow-700">
                    <Link href={`/receipts/${r.id}`} className="hover:underline font-medium">
                      {r.merchant ?? r.originalName}
                    </Link>
                    {" "}— expires in {days} day{days !== 1 ? "s" : ""}
                  </li>
                );
              })}
            </ul>
          </div>
          <Link
            href="/warranties"
            className="shrink-0 text-xs text-yellow-700 font-medium hover:underline"
          >
            View all →
          </Link>
        </div>
      )}

      {/* ── Pending Returns alert ────────────────────────────────────── */}
      {pendingReturns.length > 0 && (() => {
        const urgentReturns = pendingReturns.filter((r) => {
          if (!r.returnDeadline) return false;
          const days = Math.ceil((new Date(r.returnDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return days <= 3;
        });
        return (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${
            urgentReturns.length > 0
              ? "bg-red-50 border-red-200"
              : "bg-blue-50 border-blue-200"
          }`}>
            <span className="text-2xl shrink-0">{urgentReturns.length > 0 ? "🚨" : "↩️"}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${urgentReturns.length > 0 ? "text-red-800" : "text-blue-800"}`}>
                {pendingReturns.length} pending return{pendingReturns.length !== 1 ? "s" : ""}
                {urgentReturns.length > 0 && ` · ${urgentReturns.length} due within 3 days!`}
              </p>
              <ul className="mt-1 space-y-0.5">
                {pendingReturns.slice(0, 3).map((r) => {
                  const dl = r.returnDeadline
                    ? Math.ceil((new Date(r.returnDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <li key={r.id} className={`text-xs ${urgentReturns.length > 0 ? "text-red-700" : "text-blue-700"}`}>
                      <Link href={`/receipts/${r.id}`} className="hover:underline font-medium">
                        {r.merchant ?? r.originalName}
                      </Link>
                      {dl !== null && (
                        <span className={dl <= 0 ? "font-bold" : ""}>
                          {" "}— {dl <= 0 ? "overdue!" : dl === 0 ? "due today!" : `${dl} day${dl !== 1 ? "s" : ""} left`}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <Link
              href="/returns"
              className={`shrink-0 text-xs font-medium hover:underline ${urgentReturns.length > 0 ? "text-red-700" : "text-blue-700"}`}
            >
              View all →
            </Link>
          </div>
        );
      })()}

      {/* ── Unverified inbox ─────────────────────────────────────────── */}
      {unverifiedCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200">
          <span className="text-2xl shrink-0">📥</span>
          <div className="flex-1">
            <p className="font-semibold text-indigo-800 text-sm">
              {unverifiedCount} receipt{unverifiedCount !== 1 ? "s" : ""} need review
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              OCR extracted data — verify amounts and categories are correct
            </p>
          </div>
          <Link
            href="/receipts?verified=false"
            className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Review →
          </Link>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Track receipts everywhere — OCR powered document management
          </p>
        </div>
        <Link href="/upload" className="btn-primary flex items-center gap-2">
          <span>+</span> Upload Receipt
        </Link>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card flex flex-col gap-2">
            <span className={`text-2xl w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
              {s.icon}
            </span>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
            {s.sub && (
              <p className={`text-xs font-medium ${s.sub.positive ? "text-green-600" : "text-red-500"}`}>
                {s.sub.text}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Spending trend (6 months) ─────────────────────────────────── */}
      {trendData.some((d) => d.total > 0) && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">📈 Spending Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
            </div>
            <Link href="/analytics" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Full analytics →
            </Link>
          </div>
          <MonthlyTrend data={trendData} />
        </div>
      )}

      {/* ── Budget overview ───────────────────────────────────────────── */}
      {budgets.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">💰 Monthly Budgets</h2>
            <Link href="/budgets" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Manage →
            </Link>
          </div>
          <div className="space-y-3">
            {budgets.map((b) => {
              const s   = thisMonthSpendByCat[b.category] ?? 0;
              const pct = Math.min(Math.round((s / b.monthlyLimit) * 100), 999);
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 font-medium">{b.category}</span>
                    <span className="text-xs text-gray-500">
                      <span className={`font-semibold ${budgetTextColor(pct)}`}>
                        ${s.toFixed(0)}
                      </span>
                      {" / "}${b.monthlyLimit.toFixed(0)}
                      {" "}
                      <span className={`font-medium ${budgetTextColor(pct)}`}>({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${budgetBarColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Receipts ───────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Receipts</h2>
          <Link href="/receipts" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            View all →
          </Link>
        </div>

        {recentReceipts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🧾</p>
            <p className="text-gray-500 mb-4">No receipts yet</p>
            <Link href="/upload" className="btn-primary">Upload your first receipt</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentReceipts.map((r) => (
              <Link
                key={r.id}
                href={`/receipts/${r.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
                    🧾
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {r.merchant ?? r.originalName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {r.category ?? "Uncategorized"} · {formatDate(r.createdAt.toISOString())}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 text-sm">
                    {r.total ? formatCurrency(r.total, r.currency) : "—"}
                  </p>
                  {r.verified && (
                    <span className="badge bg-green-50 text-green-700">✓ verified</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/search" className="card hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer">
          <span className="text-3xl">🔍</span>
          <div>
            <p className="font-semibold text-gray-900">Search</p>
            <p className="text-sm text-gray-500">Find any receipt</p>
          </div>
        </Link>
        <Link href="/returns" className="card hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer">
          <span className="text-3xl">↩️</span>
          <div>
            <p className="font-semibold text-gray-900">Returns</p>
            <p className="text-sm text-gray-500">Track return windows</p>
          </div>
        </Link>
        <Link href="/analytics" className="card hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer">
          <span className="text-3xl">📊</span>
          <div>
            <p className="font-semibold text-gray-900">Analytics</p>
            <p className="text-sm text-gray-500">Charts & insights</p>
          </div>
        </Link>
        <Link href="/export" className="card hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer">
          <span className="text-3xl">📤</span>
          <div>
            <p className="font-semibold text-gray-900">Export</p>
            <p className="text-sm text-gray-500">PDF & CSV reports</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
