"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface ReturnReceipt {
  id: string;
  merchant: string | null;
  originalName: string;
  date: string | null;
  total: string | null;
  currency: string;
  category: string | null;
  returnDeadline: string | null;
  returnStatus: string | null;   // "pending" | "completed" | "waived"
  returnNotes: string | null;
  createdAt: string;
}

type Filter = "all" | "pending" | "completed" | "waived";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: "Pending",   color: "text-orange-700", bg: "bg-orange-50 border-orange-200",  icon: "🔄" },
  completed: { label: "Completed", color: "text-green-700",  bg: "bg-green-50 border-green-200",   icon: "✅" },
  waived:    { label: "Waived",    color: "text-gray-500",   bg: "bg-gray-50 border-gray-200",     icon: "🚫" },
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

function deadlineInfo(deadline: string | null): { label: string; urgent: boolean; overdue: boolean } {
  if (!deadline) return { label: "No deadline set", urgent: false, overdue: false };
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0)  return { label: `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`,  urgent: true,  overdue: true };
  if (days === 0) return { label: "Due today!",                                                           urgent: true,  overdue: false };
  if (days <= 3)  return { label: `${days} day${days !== 1 ? "s" : ""} left`,                            urgent: true,  overdue: false };
  if (days <= 7)  return { label: `${days} days left`,                                                   urgent: false, overdue: false };
  const d = new Date(deadline);
  return {
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    urgent: false,
    overdue: false,
  };
}

export default function ReturnsPage() {
  const [receipts, setReceipts] = useState<ReturnReceipt[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Filter>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/returns");
      const data = await res.json();
      setReceipts(data.results ?? []);
    } catch {
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string | null) => {
    setUpdating(id);
    try {
      await fetch(`/api/receipts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnStatus: status }),
      });
      await load();
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  const filtered = receipts.filter((r) =>
    filter === "all" ? true : r.returnStatus === filter
  );

  const counts = {
    all:       receipts.length,
    pending:   receipts.filter((r) => r.returnStatus === "pending").length,
    completed: receipts.filter((r) => r.returnStatus === "completed").length,
    waived:    receipts.filter((r) => r.returnStatus === "waived").length,
  };

  const urgentCount = receipts.filter((r) => {
    if (r.returnStatus !== "pending" || !r.returnDeadline) return false;
    const days = Math.ceil((new Date(r.returnDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 3;
  }).length;

  const TABS: { key: Filter; label: string; icon: string }[] = [
    { key: "all",       label: "All",       icon: "📦" },
    { key: "pending",   label: "Pending",   icon: "🔄" },
    { key: "completed", label: "Completed", icon: "✅" },
    { key: "waived",    label: "Waived",    icon: "🚫" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">↩️ Returns</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Track items you need to return — search by item name, merchant or category
          </p>
        </div>
        <Link href="/search" className="btn-secondary text-sm shrink-0">
          🔍 Search receipts
        </Link>
      </div>

      {/* ── Urgent alert ─────────────────────────────────────────────── */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
          <span className="text-2xl shrink-0">🚨</span>
          <p className="text-sm font-semibold text-red-700 flex-1">
            {urgentCount} return{urgentCount !== 1 ? "s" : ""} due within 3 days — act fast!
          </p>
        </div>
      )}

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      {!loading && receipts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pending",   value: counts.pending,   color: "text-orange-600", bg: "bg-orange-50" },
            { label: "Completed", value: counts.completed, color: "text-green-600",  bg: "bg-green-50"  },
            { label: "Waived",    value: counts.waived,    color: "text-gray-500",   bg: "bg-gray-50"   },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              filter === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                filter === t.key ? "bg-gray-100 text-gray-700" : "bg-white text-gray-500"
              }`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-16">
          <span className="inline-block w-6 h-6 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!loading && receipts.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">📦</p>
          <p className="text-gray-600 font-semibold">No returns tracked yet</p>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            Open any receipt and enable return tracking to start monitoring your return windows.
          </p>
          <Link href="/receipts" className="btn-primary inline-block mt-2">Browse receipts</Link>
        </div>
      )}

      {!loading && receipts.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No {filter} returns
        </div>
      )}

      {/* ── Returns list ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map((r) => {
          const status  = r.returnStatus ?? "pending";
          const cfg     = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
          const emoji   = CATEGORY_EMOJI[r.category ?? ""] ?? "🛍️";
          const dl      = deadlineInfo(r.returnDeadline);
          const isBusy  = updating === r.id;

          return (
            <div
              key={r.id}
              className={`card border ${cfg.bg} space-y-3 transition-all`}
            >
              {/* Top row */}
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/receipts/${r.id}`}
                    className="font-semibold text-gray-900 text-sm hover:text-brand-700 transition-colors"
                  >
                    {r.merchant ?? r.originalName}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.category ?? "Uncategorized"}
                    {r.date ? ` · Purchased ${r.date}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-bold text-gray-900 text-sm">
                    {fmtAmount(r.total, r.currency)}
                  </p>
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
              </div>

              {/* Deadline row */}
              {(r.returnDeadline || status === "pending") && (
                <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                  dl.overdue
                    ? "bg-red-100 text-red-700"
                    : dl.urgent
                    ? "bg-orange-100 text-orange-700"
                    : "bg-white/60 text-gray-500"
                }`}>
                  <span>{dl.overdue ? "⛔" : dl.urgent ? "⏰" : "📅"}</span>
                  <span className="font-medium">Return deadline:</span>
                  <span className={dl.urgent || dl.overdue ? "font-bold" : ""}>{dl.label}</span>
                </div>
              )}

              {/* Return notes */}
              {r.returnNotes && (
                <p className="text-xs text-gray-500 italic leading-relaxed bg-white/60 rounded-lg px-3 py-2">
                  {r.returnNotes}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap pt-1">
                <Link
                  href={`/receipts/${r.id}`}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  View receipt →
                </Link>
                {status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(r.id, "completed")}
                      disabled={isBusy}
                      className="text-xs py-1.5 px-3 rounded-lg font-medium bg-green-600 text-white hover:bg-green-500 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {isBusy
                        ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : "✅"}
                      Returned
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "waived")}
                      disabled={isBusy}
                      className="text-xs py-1.5 px-3 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-60"
                    >
                      🚫 Waive
                    </button>
                  </>
                )}
                {status === "completed" && (
                  <button
                    onClick={() => updateStatus(r.id, "pending")}
                    disabled={isBusy}
                    className="text-xs py-1.5 px-3 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-60"
                  >
                    ↩ Mark pending
                  </button>
                )}
                {status === "waived" && (
                  <button
                    onClick={() => updateStatus(r.id, "pending")}
                    disabled={isBusy}
                    className="text-xs py-1.5 px-3 rounded-lg font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-60"
                  >
                    🔄 Reopen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tip for searching ─────────────────────────────────────────── */}
      {!loading && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">💡 Pro tip: Search by item name</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Need to find a receipt for a specific product? Use{" "}
            <Link href="/search" className="font-semibold underline hover:text-blue-800">
              Search
            </Link>{" "}
            and type the item name (e.g. &ldquo;blue shirt&rdquo;, &ldquo;router&rdquo;, &ldquo;headphones&rdquo;)
            — OCR reads every word on the receipt, so it finds it instantly.
          </p>
        </div>
      )}

    </div>
  );
}
