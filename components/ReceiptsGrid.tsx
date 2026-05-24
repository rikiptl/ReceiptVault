"use client";

import { useState, useCallback } from "react";
import ReceiptCard from "@/components/ReceiptCard";

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

export default function ReceiptsGrid({ receipts, query = "" }: Props) {
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting]       = useState(false);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => setSelectedIds(new Set(receipts.map((r) => r.id)));

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
      // Reload the server-rendered page so counts + list refresh correctly
      window.location.reload();
    } catch {
      alert("Some receipts could not be deleted. Please try again.");
      setDeleting(false);
    }
  };

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
            <button
              onClick={selectAll}
              className="text-gray-500 hover:text-gray-800 underline underline-offset-2"
            >
              All
            </button>
            <button
              onClick={exitSelectMode}
              className="text-gray-400 hover:text-gray-700"
            >
              Cancel
            </button>
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

      {/* ── Floating action bar (appears when items are selected) ─────── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-16 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3 bg-gray-900 text-white pl-5 pr-3 py-3 rounded-2xl shadow-2xl ring-1 ring-white/10">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedIds.size} receipt{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {deleting ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>🗑️</span>
              )}
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={exitSelectMode}
              disabled={deleting}
              className="text-gray-400 hover:text-white px-1 text-lg leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
