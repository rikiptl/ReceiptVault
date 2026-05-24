import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import ProjectEditPanel from "./ProjectEditPanel";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }> }

const CATEGORY_EMOJI: Record<string, string> = {
  "Groceries": "🛒", "Food & Dining": "🍔", "Transport": "🚗",
  "Shopping": "🛍️", "Healthcare": "💊", "Utilities": "⚡",
  "Entertainment": "🎬", "Accommodation": "🏨", "Software/SaaS": "💻",
  "Other": "📄",
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();

  const receipts = await db.receipt.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });

  let totalSpend = 0;
  const categoryMap: Record<string, number> = {};
  for (const r of receipts) {
    const v = parseFloat(r.total ?? "");
    if (!isNaN(v) && v > 0) {
      totalSpend += v;
      const cat = r.category ?? "Other";
      categoryMap[cat] = (categoryMap[cat] ?? 0) + v;
    }
  }

  const topCats = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-gray-700">Projects</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{project.name}</span>
      </div>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="card" style={{ borderLeft: `4px solid ${project.color}` }}>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: project.color + "20" }}
          >
            {project.icon}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-500 text-sm mt-1">{project.description}</p>
            )}
          </div>
          {/* Edit panel (client component) */}
          <ProjectEditPanel project={project} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Receipts</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{receipts.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Spend</p>
            <p className="text-2xl font-black text-green-600 mt-0.5">
              ${totalSpend.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Receipt</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">
              {receipts.length > 0 ? `$${(totalSpend / receipts.length).toFixed(2)}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Category breakdown ─────────────────────────────────────── */}
      {topCats.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Spending by category</h2>
          {topCats.map(([cat, spend]) => {
            const pct = Math.round((spend / totalSpend) * 100);
            return (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">
                    {CATEGORY_EMOJI[cat] ?? "📄"} {cat}
                  </span>
                  <span className="font-semibold text-gray-900">
                    ${spend.toFixed(0)}
                    <span className="text-gray-400 font-normal ml-1">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: project.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Export buttons ─────────────────────────────────────────── */}
      {receipts.length > 0 && (
        <div className="flex gap-3">
          <a
            href={`/api/export?projectId=${project.id}`}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            📊 Export CSV
          </a>
          <a
            href={`/api/export/pdf?projectId=${project.id}`}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            📄 Export PDF
          </a>
        </div>
      )}

      {/* ── Receipts list ──────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">
            {receipts.length === 0 ? "No receipts yet" : `${receipts.length} receipt${receipts.length !== 1 ? "s" : ""}`}
          </h2>
          <Link href="/receipts" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            Add receipts →
          </Link>
        </div>

        {receipts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🧾</p>
            <p className="text-gray-400 text-sm mb-3">No receipts in this project yet.</p>
            <p className="text-gray-400 text-xs">
              Open any receipt → Edit Details → assign it to this project.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {receipts.map((r) => {
              const emoji = CATEGORY_EMOJI[r.category ?? ""] ?? "🧾";
              return (
                <Link
                  key={r.id}
                  href={`/receipts/${r.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {r.merchant ?? r.originalName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {r.category ?? "Uncategorized"} · {r.date ?? formatDate(r.createdAt.toISOString())}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {r.total ? formatCurrency(r.total, r.currency) : "—"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
