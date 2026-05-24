"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface SearchResult {
  id: string;
  merchant: string | null;
  originalName: string;
  date: string | null;
  total: string | null;
  currency: string;
  category: string | null;
  createdAt: string;
}

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

function fmtAmount(total: string | null, currency: string) {
  if (!total) return "—";
  const n = parseFloat(total);
  if (isNaN(n)) return total;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function SearchPage() {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 280);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">⚡ Search</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Real-time search across merchant, category, notes and OCR text
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-gray-400 pointer-events-none select-none">
          🔍
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Type to search receipts…"
          className="input pl-10 pr-10 h-12 text-base w-full"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
          </span>
        )}
        {!loading && query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xl leading-none transition-colors"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Result count */}
      {searched && !loading && (
        <p className="text-xs text-gray-400 px-0.5">
          {results.length === 0
            ? `No results for "${query}"`
            : `${results.length} result${results.length !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => {
            const emoji = CATEGORY_EMOJI[r.category ?? ""] ?? "🧾";
            const date  = r.date ?? fmtDate(r.createdAt);

            return (
              <Link
                key={r.id}
                href={`/receipts/${r.id}`}
                className="flex items-center gap-3 card hover:shadow-md transition-all group"
              >
                <span className="text-2xl shrink-0">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm group-hover:text-brand-700 transition-colors truncate">
                    {r.merchant ?? r.originalName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {r.category ?? "Uncategorized"} · {date}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 text-sm">
                    {fmtAmount(r.total, r.currency)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">View →</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty / idle state */}
      {!query.trim() && (
        <div className="text-center py-14">
          <p className="text-5xl mb-3">🔍</p>
          <p className="text-gray-400 text-sm">Start typing to search all your receipts</p>
          <p className="text-gray-300 text-xs mt-2">merchant · category · notes · receipt text</p>
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && query.trim() && (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">🤷</p>
          <p className="text-gray-500 text-sm mb-3">No receipts match <strong>"{query}"</strong></p>
          <Link href="/upload" className="btn-secondary text-sm">Upload a receipt</Link>
        </div>
      )}
    </div>
  );
}
