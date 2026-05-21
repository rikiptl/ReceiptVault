import { db } from "@/lib/db";
import Link from "next/link";
import ReceiptCard from "@/components/ReceiptCard";

const CATEGORIES = [
  "All",
  "Groceries",
  "Food & Dining",
  "Transport",
  "Shopping",
  "Healthcare",
  "Utilities",
  "Entertainment",
  "Accommodation",
  "Software/SaaS",
  "Other",
];

interface PageProps {
  searchParams: Promise<{ q?: string; cat?: string; page?: string }>;
}

export default async function ReceiptsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const cat = params.cat ?? "All";
  const page = parseInt(params.page ?? "1", 10);
  const pageSize = 12;

  const where = {
    ...(q
      ? {
          OR: [
            { merchant: { contains: q, mode: "insensitive" as const } },
            { ocrText: { contains: q, mode: "insensitive" as const } },
            { notes: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(cat && cat !== "All" ? { category: cat } : {}),
  };

  const [receipts, totalCount] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.receipt.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Receipts</h1>
          <p className="text-gray-500 mt-1">
            {totalCount} receipt{totalCount !== 1 ? "s" : ""} stored
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/export?format=csv"
            className="btn-secondary text-sm flex items-center gap-1"
          >
            📥 Export CSV
          </a>
          <Link href="/upload" className="btn-primary text-sm">
            + Upload
          </Link>
        </div>
      </div>

      {/* Search */}
      <form className="flex gap-2" method="GET">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search merchant, items, notes..."
          className="input flex-1"
        />
        <input type="hidden" name="cat" value={cat} />
        <button type="submit" className="btn-primary">
          Search
        </button>
        {q && (
          <a href="/receipts" className="btn-secondary">
            Clear
          </a>
        )}
      </form>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/receipts?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              cat === c
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      {/* Receipt grid */}
      {receipts.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500 mb-4">
            {q || cat !== "All"
              ? "No receipts match your search"
              : "No receipts yet"}
          </p>
          {!q && cat === "All" && (
            <Link href="/upload" className="btn-primary">
              Upload your first receipt
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/receipts?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${cat !== "All" ? `&cat=${encodeURIComponent(cat)}` : ""}`}
              className="btn-secondary"
            >
              ← Prev
            </Link>
          )}
          <span className="flex items-center px-4 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/receipts?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${cat !== "All" ? `&cat=${encodeURIComponent(cat)}` : ""}`}
              className="btn-secondary"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
