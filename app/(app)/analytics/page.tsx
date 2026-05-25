import { db } from "@/lib/db";
import SpendByCategory  from "@/components/charts/SpendByCategory";
import YearOverYear     from "@/components/charts/YearOverYear";
import TopMerchants     from "@/components/charts/TopMerchants";
import SpendingTimeline from "@/components/charts/SpendingTimeline";

export const dynamic = "force-dynamic";

// ── Data aggregation (server-side) ────────────────────────────────────────────
async function getAnalyticsData() {
  const receipts = await db.receipt.findMany({
    select: { total: true, category: true, merchant: true, createdAt: true, currency: true },
  });

  const now           = new Date();
  const thisYear      = now.getFullYear();
  const lastYear      = thisYear - 1;
  const thisMonthStart = new Date(thisYear, now.getMonth(), 1);

  const byCategory: Record<string, { total: number; count: number }> = {};
  const byMonthKey:  Record<string, number>                          = {};
  const byMerchant:  Record<string, { total: number; count: number }> = {};
  const byCurrency:  Record<string, { total: number; count: number }> = {};
  const categorySet  = new Set<string>();

  let totalSpend     = 0;
  let thisMonthSpend = 0;
  let validCount     = 0;

  for (const r of receipts) {
    const amount = parseFloat(r.total ?? "");
    if (isNaN(amount) || amount <= 0) continue;

    totalSpend += amount;
    validCount++;
    if (r.createdAt >= thisMonthStart) thisMonthSpend += amount;

    // Currency breakdown
    const cur = r.currency || "USD";
    byCurrency[cur] ??= { total: 0, count: 0 };
    byCurrency[cur].total += amount;
    byCurrency[cur].count++;

    // Category
    const cat = r.category ?? "Uncategorized";
    categorySet.add(cat);
    byCategory[cat] ??= { total: 0, count: 0 };
    byCategory[cat].total += amount;
    byCategory[cat].count++;

    // Month key → "YYYY-MM"
    const d   = r.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonthKey[key] = (byMonthKey[key] ?? 0) + amount;

    // Merchant
    if (r.merchant) {
      byMerchant[r.merchant] ??= { total: 0, count: 0 };
      byMerchant[r.merchant].total += amount;
      byMerchant[r.merchant].count++;
    }
  }

  // 13-month rolling trend
  const trendData = Array.from({ length: 13 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (12 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      total: Math.round((byMonthKey[key] ?? 0) * 100) / 100,
    };
  });

  // Year-over-year (Jan–Dec, this year vs last year)
  const yoyData = Array.from({ length: 12 }, (_, i) => {
    const label   = new Date(thisYear, i, 1).toLocaleString("en-US", { month: "short" });
    const thisKey = `${thisYear}-${String(i + 1).padStart(2, "0")}`;
    const lastKey = `${lastYear}-${String(i + 1).padStart(2, "0")}`;
    return {
      month:    label,
      thisYear: Math.round((byMonthKey[thisKey] ?? 0) * 100) / 100,
      lastYear: Math.round((byMonthKey[lastKey] ?? 0) * 100) / 100,
    };
  });

  // Category breakdown sorted by spend
  const categoryData = Object.entries(byCategory)
    .map(([name, d]) => ({ name, total: Math.round(d.total * 100) / 100, count: d.count }))
    .sort((a, b) => b.total - a.total);

  // Top 10 merchants by spend
  const merchantData = Object.entries(byMerchant)
    .map(([name, d]) => ({ name, total: Math.round(d.total * 100) / 100, count: d.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const currencies = Object.keys(byCurrency).sort();
  const currencyData = currencies.map((cur) => ({
    currency: cur,
    total:    Math.round(byCurrency[cur].total * 100) / 100,
    count:    byCurrency[cur].count,
  }));

  // Sorted category list for the timeline filter (by spend, top 8)
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name]) => name);

  return {
    totalSpend:      Math.round(totalSpend * 100) / 100,
    thisMonthSpend:  Math.round(thisMonthSpend * 100) / 100,
    avgPerReceipt:   validCount > 0 ? Math.round((totalSpend / validCount) * 100) / 100 : 0,
    totalReceipts:   receipts.length,
    validCount,
    thisYear,
    lastYear,
    trendData,
    yoyData,
    categoryData,
    merchantData,
    currencies,
    currencyData,
    topCategories,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return v >= 1000
    ? `$${(v / 1000).toFixed(1)}k`
    : `$${v.toFixed(2)}`;
}

function ChartCard({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  const summaryStats = [
    { label: "Total Spend",     value: fmt(data.totalSpend),     icon: "💰", color: "bg-green-50 text-green-700" },
    { label: "This Month",      value: fmt(data.thisMonthSpend),  icon: "📅", color: "bg-blue-50 text-blue-700" },
    { label: "Avg per Receipt", value: fmt(data.avgPerReceipt),   icon: "📊", color: "bg-purple-50 text-purple-700" },
    { label: "Receipts Tracked",value: data.totalReceipts.toString(), icon: "🧾", color: "bg-orange-50 text-orange-700" },
  ];

  const noData        = data.validCount === 0;
  const multiCurrency = data.currencies.length > 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📊 Analytics</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Spending insights across {data.totalReceipts} receipt{data.totalReceipts !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Multi-currency warning */}
      {multiCurrency && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-xl shrink-0">🌐</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm">
              Multiple currencies detected ({data.currencies.join(", ")})
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Totals are summed without conversion and may not reflect true spend. Breakdown by currency below.
            </p>
          </div>
        </div>
      )}

      {noData ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500 mb-2">No spending data yet</p>
          <p className="text-sm text-gray-400">Upload receipts with totals to see charts here.</p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryStats.map((s) => (
              <div key={s.label} className="card flex flex-col gap-2 py-4">
                <span className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                  {s.icon}
                </span>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Hero: interactive spending timeline ── */}
          <SpendingTimeline categories={data.topCategories} />

          {/* Row 1: Category pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Spend by Category"
              subtitle="All-time breakdown"
            >
              <SpendByCategory data={data.categoryData} />
            </ChartCard>

            {/* Top merchants mini-list fills the right col on large screens */}
            {data.merchantData.length > 0 && (
              <ChartCard
                title="Top Merchants"
                subtitle={`Top ${Math.min(data.merchantData.length, 5)} by spend`}
              >
                <TopMerchants data={data.merchantData.slice(0, 5)} />
              </ChartCard>
            )}
          </div>

          {/* Row 2: Year-over-year */}
          <ChartCard
            title="Year-over-Year"
            subtitle={`${data.thisYear} vs ${data.lastYear}`}
          >
            <YearOverYear
              data={data.yoyData}
              thisYear={data.thisYear}
              lastYear={data.lastYear}
            />
          </ChartCard>

          {/* Row 3: Currency breakdown (only when multiple currencies) */}
          {multiCurrency && (
            <ChartCard
              title="🌐 Spend by Currency"
              subtitle="Receipts are not converted — original amounts shown"
            >
              <div className="space-y-3">
                {data.currencyData.map((c) => {
                  const pct = Math.round((c.total / data.totalSpend) * 100);
                  return (
                    <div key={c.currency}>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="font-medium text-gray-800">{c.currency}</span>
                        <span className="text-gray-500">
                          <span className="font-semibold text-gray-900">${c.total.toFixed(2)}</span>
                          {" "}· {c.count} receipt{c.count !== 1 ? "s" : ""}
                          {" "}· {pct}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
