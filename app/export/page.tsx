import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Groceries", "Food & Dining", "Transport", "Shopping",
  "Healthcare", "Utilities", "Entertainment", "Accommodation",
  "Software/SaaS", "Other",
];

interface PageProps {
  searchParams: Promise<{
    year?: string;
    reimbursable?: string;
    cat?: string;
  }>;
}

// Build years list: current year back to first receipt's year (min 3 years shown)
async function getYears() {
  const oldest = await db.receipt.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const currentYear = new Date().getFullYear();
  const firstYear   = oldest ? oldest.createdAt.getFullYear() : currentYear;
  const years: number[] = [];
  for (let y = currentYear; y >= Math.min(firstYear, currentYear - 2); y--) years.push(y);
  return years;
}

export default async function ExportPage({ searchParams }: PageProps) {
  const params       = await searchParams;
  const year         = params.year ?? String(new Date().getFullYear());
  const reimbursable = params.reimbursable === "true";
  const cat          = params.cat ?? "";

  const years = await getYears();

  // Count receipts matching current filters
  const where = {
    ...(year !== "all" ? {
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00Z`),
        lt:  new Date(`${parseInt(year) + 1}-01-01T00:00:00Z`),
      },
    } : {}),
    ...(reimbursable ? { reimbursable: true } : {}),
    ...(cat ? { category: cat } : {}),
  };

  const [count, totalReceipts, reimbCount] = await Promise.all([
    db.receipt.count({ where }),
    db.receipt.count(),
    db.receipt.count({ where: { reimbursable: true } }),
  ]);

  // Sum totals for matched receipts (stored as string, must aggregate in JS)
  const matched = await db.receipt.findMany({ where, select: { total: true, reimbursable: true } });
  let matchedSpend = 0;
  let matchedReimb = 0;
  for (const r of matched) {
    const v = parseFloat(r.total ?? "");
    if (!isNaN(v)) {
      matchedSpend += v;
      if (r.reimbursable) matchedReimb += v;
    }
  }

  // Build export URL params
  const exportParams = new URLSearchParams();
  if (year !== "all") exportParams.set("year", year);
  if (reimbursable)   exportParams.set("reimbursable", "true");
  if (cat)            exportParams.set("cat", cat);
  const qs = exportParams.toString();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📤 Export & Tax</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Generate reports for tax season or expense reimbursement.
        </p>
      </div>

      {/* Filter form */}
      <form method="GET" action="/export" className="card space-y-5">
        <h2 className="font-semibold text-gray-900">Filter receipts</h2>

        {/* Year */}
        <div>
          <label className="text-xs text-gray-500 block mb-1.5 font-medium">Year</label>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <button
                key={y}
                type="submit"
                name="year"
                value={String(y)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  year === String(y)
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {y}
              </button>
            ))}
            <button
              type="submit"
              name="year"
              value="all"
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                year === "all"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              All time
            </button>
          </div>
          {/* Hidden fields so year toggle preserves other params */}
          {reimbursable && <input type="hidden" name="reimbursable" value="true" />}
          {cat && <input type="hidden" name="cat" value={cat} />}
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-gray-500 block mb-1.5 font-medium">Category</label>
          <div className="flex gap-2">
            <select name="cat" defaultValue={cat} className="input text-sm flex-1">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="btn-secondary text-sm px-4">Apply</button>
          </div>
        </div>

        {/* Reimbursable toggle */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
          <input
            type="hidden" name="reimbursable" value="false" />
          <label className="flex items-center gap-2.5 cursor-pointer flex-1">
            <input
              type="checkbox"
              name="reimbursable"
              value="true"
              defaultChecked={reimbursable}
              className="w-4 h-4 accent-brand-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">💰 Reimbursable receipts only</p>
              <p className="text-xs text-gray-500">
                {reimbCount} receipt{reimbCount !== 1 ? "s" : ""} marked reimbursable in your vault
              </p>
            </div>
          </label>
          <button type="submit" className="text-xs text-brand-600 hover:underline shrink-0">Apply</button>
        </div>
      </form>

      {/* Preview */}
      <div className="card bg-green-50 border-green-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-green-900">Export preview</h2>
          <span className="badge bg-green-100 text-green-700">
            {count} of {totalReceipts} receipts
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Total Spend</p>
            <p className="text-lg font-bold text-gray-900">${matchedSpend.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Reimbursable</p>
            <p className="text-lg font-bold text-green-600">${matchedReimb.toFixed(2)}</p>
          </div>
        </div>
        {count === 0 && (
          <p className="text-sm text-green-700 text-center py-2">
            No receipts match your filters.{" "}
            <Link href="/export" className="underline">Reset</Link>
          </p>
        )}
      </div>

      {/* Download buttons */}
      {count > 0 && (
        <div className="space-y-3">
          {/* PDF */}
          <a
            href={`/api/export/pdf${qs ? "?" + qs : ""}`}
            className="flex items-center gap-4 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors group"
          >
            <span className="text-3xl">📄</span>
            <div className="flex-1">
              <p className="font-semibold text-green-900 group-hover:text-green-700">
                Download PDF Tax Report
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Formatted report grouped by category · suitable for tax filing
              </p>
            </div>
            <span className="text-green-600 font-bold text-sm">PDF ↓</span>
          </a>

          {/* CSV */}
          <a
            href={`/api/export${qs ? "?" + qs : ""}`}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors group"
          >
            <span className="text-3xl">📊</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Download CSV</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Raw data for Excel / Google Sheets — includes all fields & tags
              </p>
            </div>
            <span className="text-gray-500 font-bold text-sm">CSV ↓</span>
          </a>
        </div>
      )}

      {/* Tips */}
      <div className="card bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm">Tax tips</h3>
        <ul className="text-xs text-blue-800 space-y-1.5">
          <li>💰 Mark receipts as <strong>Reimbursable</strong> on the edit page — then export only those for expense claims</li>
          <li>📋 The PDF report groups spending by category — handy for Schedule C or business expense deductions</li>
          <li>📊 Use the CSV in Excel to apply your own formulas or share with an accountant</li>
          <li>📅 Export year-by-year to keep separate records for each tax year</li>
        </ul>
      </div>
    </div>
  );
}
