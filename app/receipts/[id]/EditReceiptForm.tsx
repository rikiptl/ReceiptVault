"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

const CATEGORIES = [
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

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD"];

interface Receipt {
  id: string;
  merchant: string | null;
  date: string | null;
  total: string | null;
  tax: string | null;
  currency: string;
  category: string | null;
  notes: string | null;
  verified: boolean;
}

export default function EditReceiptForm({ receipt }: { receipt: Receipt }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    merchant: receipt.merchant ?? "",
    date: receipt.date ?? "",
    total: receipt.total ?? "",
    tax: receipt.tax ?? "",
    currency: receipt.currency,
    category: receipt.category ?? "",
    notes: receipt.notes ?? "",
    verified: receipt.verified,
  });

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      router.refresh();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this receipt? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/receipts/${receipt.id}`, { method: "DELETE" });
      router.push("/receipts");
    } catch {
      setError("Failed to delete.");
      setDeleting(false);
    }
  };

  const handleRerunOcr = useCallback(async () => {
    if (!confirm("Re-run OCR? This will overwrite the current extracted data.")) return;
    setRerunning(true);
    setError("");
    try {
      await fetch(`/api/receipts/${receipt.id}/ocr`, { method: "POST" });
      // Poll until done
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        const check = await fetch(`/api/receipts/${receipt.id}`);
        const data = await check.json();
        if (data.ocrDone) break;
        attempts++;
      }
      router.refresh();
    } catch {
      setError("Re-run OCR failed.");
    } finally {
      setRerunning(false);
    }
  }, [receipt.id, router]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Merchant</label>
          <input
            className="input"
            value={form.merchant}
            onChange={(e) => set("merchant", e.target.value)}
            placeholder="e.g. Walmart"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Date</label>
          <input
            className="input"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            placeholder="MM/DD/YYYY"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Total</label>
          <input
            className="input"
            value={form.total}
            onChange={(e) => set("total", e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tax</label>
          <input
            className="input"
            value={form.tax}
            onChange={(e) => set("tax", e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Currency</label>
          <select
            className="input"
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Category</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Select...</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Any additional notes..."
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 accent-brand-600"
          checked={form.verified}
          onChange={(e) => set("verified", e.target.checked)}
        />
        <span className="text-sm text-gray-700">Mark as verified</span>
      </label>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}
      {saved && (
        <p className="text-green-600 text-sm">✓ Saved successfully</p>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex-1"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={handleRerunOcr}
          disabled={rerunning}
          className="btn-secondary flex items-center gap-1"
          title="Re-extract data from the original image"
        >
          {rerunning ? (
            <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : "🔄"}
          {rerunning ? "Running…" : "Re-run OCR"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="btn-secondary text-red-600 hover:bg-red-50"
        >
          {deleting ? "..." : "🗑️"}
        </button>
      </div>
    </div>
  );
}
