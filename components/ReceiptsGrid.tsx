"use client";

import { useState, useCallback, useRef } from "react";
import ReceiptCard from "@/components/ReceiptCard";

const CATEGORIES = [
  "Groceries", "Food & Dining", "Transport", "Shopping",
  "Healthcare", "Utilities", "Entertainment", "Accommodation",
  "Software/SaaS", "Other",
];

interface Receipt {
  id: string;
  merchant: string | null;
  originalName: string;
  date: string | null;
  total: string | null;
  currency: string;
  category: string | null;
  verified: boolean;
  ocrDone: boolean;
  createdAt: Date;
  tags: string[];
  isRecurring: boolean;
  warrantyExpiry: Date | null;
  reimbursable: boolean;
}

interface Props {
  receipts: Receipt[];
  query?: string;
}

type BulkPanel = null | "category" | "tag";

export default function ReceiptsGrid({ receipts, query = "" }: Props) {
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting]       = useState(false);
  const [updating, setUpdating]       = useState(false);
  const [panel, setPanel]             = useState<BulkPanel>(null);
  const [tagInput, setTagInput]       = useState("");
  const tagInputRef                   = useRef<HTMLInputElement>(null);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enterSelectMode = () => { setSelectMode(true);  setSelectedIds(new Set()); setPanel(null); };
  const exitSelectMode  = () => { setSelectMode(false); setSelectedIds(new Set()); setPanel(null); };
  const selectAll       = () => setSelectedIds(new Set(receipts.map((r) => r.id)));
  const openPanel       = (p: BulkPanel) => {
    setPanel((prev) => prev === p ? null : p);
    if (p === "tag") setTimeout(() => tagInputRef.current?.focus(), 50);
  };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`Permanently delete ${count} receipt${count !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/receipts/${id}`, { method: "DELETE" })
        )
      );
      window.location.reload();
    } catch {
      alert("Some receipts could not be deleted.");
      setDeleting(false);
    }
  };

  // ── Bulk category assign ──────────────────────────────────────────────────
  const handleBulkCategory = async (category: string) => {
    if (!category) return;
    setUpdating(true);
    setPanel(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/receipts/${id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ category }),
          })
        )
      );
      window.location.reload();
    } catch {
      alert("Some receipts could not be updated.");
      setUpdating(false);
    }
  };

  // ── Bulk tag add ──────────────────────────────────────────────────────────
  const handleBulkTag = async () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    setUpdating(true);
    setPanel(null);
    const receiptMap = new Map(receipts.map((r) => [r.id, r]));
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => {
          const r       = receiptMap.get(id);
          const current = r?.tags ?? [];
          const tags    = current.includes(tag) ? current : [...current, tag];
          return fetch(`/api/receipts/${id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ tags }),
          });
        })
      );
      window.location.reload();
    } catch {
      alert("Some receipts could not be tagged.");
      setUpdating(false);
    }
  };

  const busy = deleting || updating;

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between min-h-[28px]">
        {!selectMode ? (
          <button
            onClick={enterSelectMode}
            className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors flex items-center gap-1"
          >
            ☑ Select
          </button>
        ) : (
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-brand-600">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select receipts"}
            </span>
            <button onClick={selectAll} className="text-gray-500 hover:text-gray-800 underline underline-offset-2">
              All
            </button>
            <button onClick={exitSelectMode} className="text-gray-400 hover:text-gray-700">Cancel</button>
          </div>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {receipts.map((r) => (
          <ReceiptCard
            key={r.id}
            receipt={r}
            query={query}
            selectable={selectMode}
            selected={selectedIds.has(r.id)}
            onToggle={() => toggleOne(r.id)}
          />
        ))}
      </div>

      {/* ── Floating action bar ───────────────────────────────────────── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-16 sm:bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex flex-col items-stretch gap-0 bg-gray-900 text-white rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden min-w-[280px]">

            {/* ── Category panel ──────────────────────────────────────── */}
            {panel === "category" && (
              <div className="px-3 pt-3 pb-2 border-b border-white/10">
                <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wide">Set category for all selected</p>
                <div className="grid grid-cols-2 gap-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleBulkCategory(cat)}
                      className="text-left text-xs px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors truncate"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tag panel ───────────────────────────────────────────── */}
            {panel === "tag" && (
              <div className="px-3 pt-3 pb-2 border-b border-white/10">
                <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wide">Add tag to all selected</p>
                <div className="flex gap-2">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleBulkTag(); }}
                    placeholder="e.g. business"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-white/40"
                  />
                  <button
                    onClick={handleBulkTag}
                    className="bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* ── Action buttons ───────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="text-sm font-medium whitespace-nowrap mr-1">
                {selectedIds.size} receipt{selectedIds.size !== 1 ? "s" : ""}
              </span>

              {/* Category */}
              <button
                onClick={() => openPanel("category")}
                disabled={busy}
                title="Set category"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
                  panel === "category" ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                🏷️ Category
              </button>

              {/* Tag */}
              <button
                onClick={() => openPanel("tag")}
                disabled={busy}
                title="Add tag"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
                  panel === "tag" ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                # Tag
              </button>

              {/* Delete */}
              <button
                onClick={handleBulkDelete}
                disabled={busy}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              >
                {deleting
                  ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "🗑️"}
                {deleting ? "…" : "Delete"}
              </button>

              {/* Close */}
              <button
                onClick={exitSelectMode}
                disabled={busy}
                className="text-gray-400 hover:text-white px-1 text-lg leading-none transition-colors ml-auto"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
