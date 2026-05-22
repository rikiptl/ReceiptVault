import { db } from "@/lib/db";
import Link from "next/link";
import ReceiptCard from "@/components/ReceiptCard";

export const dynamic = "force-dynamic";

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

const SORT_OPTIONS = [
  { value: "date_desc",     label: "Newest first" },
  { value: "date_asc",      label: "Oldest first" },
  { value: "amount_desc",   label: "Highest amount" },
  { value: "amount_asc",    label: "Lowest amount" },
  { value: "merchant_asc",  label: "Merchant A–Z" },
  { value: "merchant_desc", label: "Merchant Z–A" },
];

interface PageProps {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    page?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: string;
    amountMax?: string;
    sort?: string;
  }>;
}

export default async function ReceiptsPage({ searchParams }: PageProps) {
  const params  = await searchParams;
  const q         = params.q?.trim() ?? "";
  const cat       = params.cat ?? "All";
  const page      = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize  = 12;
  const dateFrom  = params.dateFrom ?? "";
  const dateTo    = params.dateTo ?? "";
  const amountMin = params.amountMin ? parseFloat(params.amountMin) : null;
  const amountMax = params.amountMax ? parseFloat(params.amountMax) : null;
  const sort      = params.sort ?? "date_desc";

  // ── Prisma where clause ────────────────────────────────────────────────────
  const where = {
    ...(q ? {
      OR: [
        { merchant:  { contains: q, mode: "insensitive" as const } },
        { ocrText:   { contains: q, mode: "insensitive" as const } },
        { notes:     { contains: q, mode: "insensitive" as const } },
        { category:  { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(cat && cat !== "All" ? { category: cat } : {}),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00Z") } : {}),
        ...(dateTo   ? { lte: new Date(dateTo   + "T23:59:59Z") } : {}),
      },
    } : {}),
  };

  // ── DB orderBy (for non-amount sorts) ─────────────────────────────────────
  const dbOrderBy = sort.startsWith("merchant")
    ? { merchant: sort === "merchant_asc" ? "asc" as const : "desc" as const }
    : { createdAt: sort === "date_asc" ? "asc" as const : "desc" as const };

  // Fetch all matching rows (we need to filter/sort by amount in memory)
  const needsInMemorySort = sort.startsWith("amount");
  const needsAmountFilter = amountMin !== null || amountMax !== null;

  let receipts;
  let totalCount: number;

  if (needsInMemorySort || needsAmountFilter) {
    // Fetch all and sort/filter in memory
    const all = await db.receipt.findMany({ where, orderBy: dbOrderBy });

    const filtered = all.filter((r) => {
      const v = parseFloat(r.total ?? "");
      if (isNaN(v)) return amountMin === null && amountMax === null;
      if (amountMin !== null && v < amountMin) return false;
      if (amountMax !== null && v > amountMax) return false;
      return true;
    });

    if (sort === "amount_desc") {
      filtered.sort((a, b) => parseFloat(b.total ?? "0") - parseFloat(a.total ?? "0"));
    } else if (sort === "amount_asc") {
      filtered.sort((a, b) => parseFloat(a.total ?? "0") - parseFloat(b.total ?? "0"));
    }

    totalCount = filtered.length;
    receipts   = filtered.slice((page - 1) * pageSize, page * pageSize);
  } else {
    [receipts, totalCount] = await Promise.all([
      db.receipt.findMany({
        where,
        orderBy: dbOrderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.receipt.count({ where }),
    ]);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  // Build URL helper preserving all current filters
  const buildUrl = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, cat, page, dateFrom, dateTo, amountMin: params.amountMin, amountMax: params.amountMax, sort, ...overrides };
    if (merged.q)         p.set("q",         String(merged.q));
    if (merged.cat && merged.cat !== "All") p.set("cat", String(merged.cat));
    if (Number(merged.page) > 1) p.set("page", String(merged.page));
    if (merged.dateFrom)  p.set("dateFrom",  String(merged.dateFrom));
    if (merged.dateTo)    p.set("dateTo",    String(merged.dateTo));
    if (merged.amountMin) p.set("amountMin", String(merged.amountMin));
    if (merged.amountMax) p.set("amountMax", String(merged.amountMax));
    if (merged.sort && merged.sort !== "date_desc") p.set("sort", String(merged.sort));
    return `/receipts${p.toString() ? "?" + p.toString() : ""}`;
  };

  const hasFilters = q || cat !== "All" || dateFrom || dateTo || amountMin !== null || amountMax !== null || sort !== "date_desc";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Receipts</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {totalCount} receipt{totalCount !== 1 ? "s" : ""}
            {hasFilters ? " matching filters" : " stored"}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export?format=csv" className="btn-secondary text-sm hidden sm:flex items-center gap-1">
            📥 Export
          </a>
          <Link href="/upload" className="btn-primary text-sm">+ Upload</Link>
        </div>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────────────── */}
      <form method="GET" action="/receipts" className="card space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search merchant, items, notes…"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary px-5">Search</button>
          {hasFilters && (
            <a href="/receipts" className="btn-secondary">Clear</a>
          )}
        </div>

        {/* Row 2: date + amount + sort */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From date</label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To date</label>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Min amount ($)</label>
            <input
              type="number"
              name="amountMin"
              defaultValue={params.amountMin ?? ""}
              placeholder="0"
              min="0"
              step="0.01"
              className="input text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Max amount ($)</label>
            <input
              type="number"
              name="amountMax"
              defaultValue={params.amountMax ?? ""}
              placeholder="Any"
              min="0"
              step="0.01"
              className="input text-sm"
            />
          </div>
        </div>

        {/* Row 3: sort + hidden cat */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Sort by</label>
            <select name="sort" defaultValue={sort} className="input text-sm">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <input type="hidden" name="cat" value={cat} />
        </div>
      </form>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildUrl({ cat: c, page: 1 })}
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

      {/* Results */}
      {receipts.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500 mb-4">
            {hasFilters ? "No receipts match your filters" : "No receipts yet"}
          </p>
          {hasFilters ? (
            <a href="/receipts" className="btn-secondary">Clear filters</a>
          ) : (
            <Link href="/upload" className="btn-primary">Upload your first receipt</Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {receipts.map((r) => (
              <ReceiptCard key={r.id} receipt={r} query={q} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-2">
              {page > 1 && (
                <Link href={buildUrl({ page: page - 1 })} className="btn-secondary">← Prev</Link>
              )}
              <span className="text-sm text-gray-500 px-2">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={buildUrl({ page: page + 1 })} className="btn-secondary">Next →</Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
