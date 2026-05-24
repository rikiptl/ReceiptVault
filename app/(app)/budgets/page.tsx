"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const CATEGORIES = [
  "Groceries", "Food & Dining", "Transport", "Shopping",
  "Healthcare", "Utilities", "Entertainment", "Accommodation",
  "Software/SaaS", "Other",
];

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

interface Budget {
  category: string;
  monthlyLimit: number;
}

interface SpendData {
  [category: string]: number;
}

function progressColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80)  return "bg-yellow-400";
  return "bg-green-500";
}

function progressBg(pct: number) {
  if (pct >= 100) return "bg-red-50 border-red-200";
  if (pct >= 80)  return "bg-yellow-50 border-yellow-200";
  return "bg-white border-gray-200";
}

export default function BudgetsPage() {
  const [budgets,  setBudgets]  = useState<Budget[]>([]);
  const [spend,    setSpend]    = useState<SpendData>({});
  const [loading,  setLoading]  = useState(true);

  // Add form
  const [addCat,   setAddCat]   = useState(CATEGORIES[0]);
  const [addLimit, setAddLimit] = useState("");
  const [adding,   setAdding]   = useState(false);
  const [addError, setAddError] = useState("");

  // Edit inline
  const [editCat,   setEditCat]   = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        fetch("/api/budgets"),
        fetch("/api/budgets/spend"),
      ]);
      setBudgets(await bRes.json());
      setSpend(await sRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(addLimit);
    if (!addCat || isNaN(limit) || limit <= 0) {
      setAddError("Enter a valid limit greater than $0");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/budgets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ category: addCat, monthlyLimit: limit }),
      });
      if (!res.ok) throw new Error();
      setAddLimit("");
      await load();
    } catch {
      setAddError("Failed to save. Try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (cat: string) => {
    const limit = parseFloat(editLimit);
    if (isNaN(limit) || limit <= 0) return;
    await fetch("/api/budgets", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ category: cat, monthlyLimit: limit }),
    });
    setEditCat(null);
    await load();
  };

  const handleDelete = async (cat: string) => {
    if (!confirm(`Remove budget for "${cat}"?`)) return;
    await fetch(`/api/budgets/${encodeURIComponent(cat)}`, { method: "DELETE" });
    await load();
  };

  const now        = new Date();
  const monthName  = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpend = budgets.reduce((s, b) => s + (spend[b.category] ?? 0), 0);

  const usedCategories = new Set(budgets.map((b) => b.category));
  const available      = CATEGORIES.filter((c) => !usedCategories.has(c));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">💰 Budget Tracker</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Set monthly spend limits per category — {monthName}
          </p>
        </div>
        <Link href="/dashboard" className="btn-secondary text-sm">← Dashboard</Link>
      </div>

      {/* Summary cards */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-gray-900">${totalLimit.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total budget</p>
          </div>
          <div className="card text-center py-4">
            <p className={`text-2xl font-bold ${totalSpend > totalLimit ? "text-red-600" : "text-gray-900"}`}>
              ${totalSpend.toFixed(0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Spent so far</p>
          </div>
          <div className="card text-center py-4">
            <p className={`text-2xl font-bold ${totalLimit - totalSpend < 0 ? "text-red-600" : "text-green-600"}`}>
              ${Math.abs(totalLimit - totalSpend).toFixed(0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalSpend > totalLimit ? "Over budget" : "Remaining"}
            </p>
          </div>
        </div>
      )}

      {/* Budget list */}
      {loading ? (
        <div className="card text-center py-10 text-gray-400">Loading…</div>
      ) : budgets.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">💸</p>
          <p className="text-gray-500 font-medium">No budgets set yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first category budget below</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const s   = spend[b.category] ?? 0;
            const pct = Math.min(Math.round((s / b.monthlyLimit) * 100), 999);
            const remaining = b.monthlyLimit - s;
            const emoji = CATEGORY_EMOJI[b.category] ?? "📄";

            return (
              <div key={b.category} className={`card border ${progressBg(pct)} space-y-3`}>
                {/* Top row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{emoji}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{b.category}</p>
                      <p className="text-xs text-gray-400">
                        ${s.toFixed(2)} of ${b.monthlyLimit.toFixed(2)}
                        {remaining < 0
                          ? <span className="text-red-600 font-medium"> · ${Math.abs(remaining).toFixed(2)} over</span>
                          : <span className="text-gray-400"> · ${remaining.toFixed(2)} left</span>
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-sm font-bold ${pct >= 100 ? "text-red-600" : pct >= 80 ? "text-yellow-600" : "text-green-600"}`}>
                      {pct}%
                    </span>
                    <button
                      onClick={() => { setEditCat(b.category); setEditLimit(String(b.monthlyLimit)); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xs"
                      title="Edit"
                    >✏️</button>
                    <button
                      onClick={() => handleDelete(b.category)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs"
                      title="Remove"
                    >🗑️</button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Inline edit */}
                {editCat === b.category && (
                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                    <input
                      type="number"
                      value={editLimit}
                      onChange={(e) => setEditLimit(e.target.value)}
                      className="input text-sm flex-1"
                      placeholder="New monthly limit"
                      min="1"
                      step="0.01"
                      autoFocus
                    />
                    <button onClick={() => handleEdit(b.category)} className="btn-primary text-sm px-4">Save</button>
                    <button onClick={() => setEditCat(null)} className="btn-secondary text-sm">Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {available.length > 0 && (
        <form onSubmit={handleAdd} className="card space-y-4">
          <h2 className="font-semibold text-gray-900">
            {budgets.length === 0 ? "Set your first budget" : "Add another category"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Category</label>
              <select
                value={addCat}
                onChange={(e) => setAddCat(e.target.value)}
                className="input text-sm"
              >
                {available.map((c) => (
                  <option key={c} value={c}>{CATEGORY_EMOJI[c] ?? "📄"} {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Monthly limit ($)</label>
              <input
                type="number"
                value={addLimit}
                onChange={(e) => setAddLimit(e.target.value)}
                placeholder="500"
                min="1"
                step="0.01"
                className="input text-sm"
                required
              />
            </div>
          </div>
          {addError && <p className="text-red-600 text-sm">{addError}</p>}
          <button type="submit" disabled={adding} className="btn-primary w-full">
            {adding ? "Saving…" : "Add Budget"}
          </button>
        </form>
      )}

      {available.length === 0 && budgets.length > 0 && (
        <p className="text-center text-sm text-gray-400">All categories have budgets set ✓</p>
      )}

      {/* Tips */}
      <div className="card bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm">Tips</h3>
        <ul className="text-xs text-blue-800 space-y-1.5">
          <li>💡 Budgets reset each month — spend tracking always shows the current month</li>
          <li>🔴 Progress bar turns red when you exceed the limit</li>
          <li>📊 Budget overview also appears on your Dashboard</li>
        </ul>
      </div>
    </div>
  );
}
