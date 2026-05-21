import Link from "next/link";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getStats() {
  const [total, thisMonth, recentReceipts] = await Promise.all([
    db.receipt.count(),
    db.receipt.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    db.receipt.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Sum totals manually since stored as string
  const allReceipts = await db.receipt.findMany({ select: { total: true, currency: true } });
  const spend = allReceipts.reduce((acc, r) => {
    const val = parseFloat(r.total ?? "0");
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const categoryMap: Record<string, number> = {};
  const catReceipts = await db.receipt.findMany({ select: { category: true } });
  for (const r of catReceipts) {
    const cat = r.category ?? "Other";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const topCategory =
    Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return { total, thisMonth, spend, topCategory, recentReceipts };
}

export default async function DashboardPage() {
  const { total, thisMonth, spend, topCategory, recentReceipts } =
    await getStats();

  const stats = [
    {
      label: "Total Receipts",
      value: total.toString(),
      icon: "🧾",
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "This Month",
      value: thisMonth.toString(),
      icon: "📅",
      color: "bg-purple-50 text-purple-700",
    },
    {
      label: "Total Spend",
      value: `$${spend.toFixed(2)}`,
      icon: "💰",
      color: "bg-green-50 text-green-700",
    },
    {
      label: "Top Category",
      value: topCategory,
      icon: "📊",
      color: "bg-orange-50 text-orange-700",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card flex flex-col gap-2">
            <span className={`text-2xl w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
              {s.icon}
            </span>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Receipts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Receipts
          </h2>
          <Link
            href="/receipts"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            View all →
          </Link>
        </div>

        {recentReceipts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🧾</p>
            <p className="text-gray-500 mb-4">No receipts yet</p>
            <Link href="/upload" className="btn-primary">
              Upload your first receipt
            </Link>
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
                      {r.category ?? "Uncategorized"} ·{" "}
                      {formatDate(r.createdAt.toISOString())}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 text-sm">
                    {r.total
                      ? formatCurrency(r.total, r.currency)
                      : "—"}
                  </p>
                  {r.verified && (
                    <span className="badge bg-green-50 text-green-700">
                      ✓ verified
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/receipts"
          className="card hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer"
        >
          <span className="text-3xl">🔍</span>
          <div>
            <p className="font-semibold text-gray-900">Search Receipts</p>
            <p className="text-sm text-gray-500">Find any receipt instantly</p>
          </div>
        </Link>
        <Link
          href="/api/export?format=csv"
          className="card hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer"
        >
          <span className="text-3xl">📥</span>
          <div>
            <p className="font-semibold text-gray-900">Export CSV</p>
            <p className="text-sm text-gray-500">Download for tax season</p>
          </div>
        </Link>
        <Link
          href="/upload"
          className="card hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer"
        >
          <span className="text-3xl">📸</span>
          <div>
            <p className="font-semibold text-gray-900">Scan Receipt</p>
            <p className="text-sm text-gray-500">Upload photo or PDF</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
