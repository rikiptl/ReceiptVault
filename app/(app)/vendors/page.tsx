import { db } from "@/lib/db";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORY_EMOJI: Record<string, string> = {
  "Groceries": "🛒", "Food & Dining": "🍔", "Transport": "🚗",
  "Shopping": "🛍️", "Healthcare": "💊", "Utilities": "⚡",
  "Entertainment": "🎬", "Accommodation": "🏨", "Software/SaaS": "💻",
  "Other": "📄",
};

export default async function VendorsPage() {
  const receipts = await db.receipt.findMany({
    where: { merchant: { not: null } },
    select: {
      id: true, merchant: true, total: true, currency: true,
      category: true, createdAt: true, date: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // ── Build vendor map ────────────────────────────────────────────────────────
  type VendorEntry = {
    merchant: string;
    totalSpend: number;
    count: number;
    lastDate: Date;
    avgAmount: number;
    topCategory: string;
    categoryCount: Record<string, number>;
  };

  const vendorMap: Record<string, VendorEntry> = {};

  for (const r of receipts) {
    const key = (r.merchant ?? "").trim().toLowerCase();
    if (!key) continue;
    const name = r.merchant!.trim();
    const val  = parseFloat(r.total ?? "");
    const amt  = isNaN(val) ? 0 : val;
    const cat  = r.category ?? "Other";

    if (!vendorMap[key]) {
      vendorMap[key] = {
        merchant: name,
        totalSpend: 0,
        count: 0,
        lastDate: r.createdAt,
        avgAmount: 0,
        topCategory: cat,
        categoryCount: {},
      };
    }

    const v = vendorMap[key];
    v.totalSpend += amt;
    v.count++;
    if (r.createdAt > v.lastDate) {
      v.lastDate = r.createdAt;
      v.merchant = name; // use most recent casing
    }
    v.categoryCount[cat] = (v.categoryCount[cat] ?? 0) + 1;
  }

  // Finalize
  const vendors = Object.values(vendorMap).map((v) => {
    v.avgAmount  = v.count > 0 ? v.totalSpend / v.count : 0;
    v.topCategory = Object.entries(v.categoryCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Other";
    return v;
  }).sort((a, b) => b.totalSpend - a.totalSpend);

  const topVendor   = vendors[0];
  const totalSpend  = vendors.reduce((s, v) => s + v.totalSpend, 0);
  const totalTxns   = vendors.reduce((s, v) => s + v.count, 0);

  function fmtDate(d: Date) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🏪 Vendor Insights</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Per-merchant spending — find where your money really goes
        </p>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────── */}
      {vendors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center py-3">
            <p className="text-2xl font-black text-gray-900">{vendors.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Unique vendors</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xl font-black text-green-600 truncate">
              ${totalSpend.toFixed(0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{totalTxns} transactions</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-sm font-black text-gray-900 truncate leading-tight px-1">
              {topVendor?.merchant ?? "—"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Top vendor</p>
          </div>
        </div>
      )}

      {/* ── Vendor list ────────────────────────────────────────────── */}
      {vendors.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🏪</p>
          <p className="text-gray-500">No vendor data yet — upload some receipts first.</p>
          <Link href="/upload" className="btn-primary inline-block mt-4">Upload receipt</Link>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          <div className="pb-3 flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-widest">
            <span>Vendor</span>
            <div className="flex gap-8 pr-1">
              <span>Avg</span>
              <span>Receipts</span>
              <span>Total</span>
            </div>
          </div>
          {vendors.map((v, i) => {
            const emoji = CATEGORY_EMOJI[v.topCategory] ?? "🧾";
            const barW  = totalSpend > 0 ? Math.round((v.totalSpend / vendors[0].totalSpend) * 100) : 0;
            return (
              <div key={v.merchant} className="py-3.5 group">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <span className="text-xs font-bold text-gray-300 w-5 shrink-0">
                    #{i + 1}
                  </span>
                  {/* Emoji */}
                  <span className="text-xl shrink-0">{emoji}</span>
                  {/* Name + last seen */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/search?q=${encodeURIComponent(v.merchant)}`}
                      className="font-semibold text-gray-900 text-sm hover:text-brand-700 transition-colors truncate block"
                    >
                      {v.merchant}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {v.topCategory} · Last: {fmtDate(v.lastDate)}
                    </p>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <p className="text-xs text-gray-500">${v.avgAmount.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{v.count}</p>
                    </div>
                    <div className="w-20">
                      <p className="text-sm font-bold text-gray-900">
                        ${v.totalSpend.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Spend bar */}
                <div className="mt-2 ml-8 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${barW}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tip ────────────────────────────────────────────────────── */}
      {vendors.length > 0 && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">💡 Click any vendor to search</p>
          <p className="text-xs text-blue-600">
            Clicking a vendor name opens Search pre-filtered for that merchant —
            so you can see every receipt from them.
          </p>
        </div>
      )}

    </div>
  );
}
