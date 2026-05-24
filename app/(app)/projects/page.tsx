"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  count: number;
  totalSpend: number;
  lastActivity: string | null;
  createdAt: string;
}

const PRESET_COLORS = [
  "#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#6b7280",
];

const PRESET_ICONS = ["📁", "💼", "✈️", "🏠", "🎯", "🏗️", "🎉", "💊", "🍕", "📊", "🌍", "🎓"];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectsPage() {
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving,   setSaving]     = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", description: "", color: "#22c55e", icon: "📁",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/projects");
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch { setProjects([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ name: "", description: "", color: "#22c55e", icon: "📁" });
      setShowForm(false);
      await load();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? Receipts will not be deleted.`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      await load();
    } catch { /* silent */ }
    finally { setDeleting(null); }
  };

  const totalSpend   = projects.reduce((s, p) => s + p.totalSpend, 0);
  const totalReceipts = projects.reduce((s, p) => s + p.count, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📁 Projects</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Organise receipts into folders — trips, renovations, tax years, clients
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary shrink-0 flex items-center gap-2"
        >
          {showForm ? "✕ Cancel" : "+ New Project"}
        </button>
      </div>

      {/* ── Create form ────────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="card space-y-4 border-2 border-dashed border-gray-300 bg-gray-50"
        >
          <p className="font-semibold text-gray-800">New Project</p>

          {/* Icon + Name */}
          <div className="flex gap-3">
            <div className="relative">
              <select
                className="input text-2xl h-11 w-16 text-center cursor-pointer"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              >
                {PRESET_ICONS.map((ic) => (
                  <option key={ic} value={ic}>{ic}</option>
                ))}
              </select>
            </div>
            <input
              className="input flex-1"
              placeholder="Project name (e.g. Business Trip NYC)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <textarea
            className="input resize-none text-sm"
            rows={2}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Color picker */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.color === c ? "border-gray-900 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Creating…" : "Create Project"}
          </button>
        </form>
      )}

      {/* ── Summary strip ──────────────────────────────────────────── */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center py-3">
            <p className="text-2xl font-black text-gray-900">{projects.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Active projects</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-black text-green-600">{fmtMoney(totalSpend)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{totalReceipts} receipts total</p>
          </div>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-16">
          <span className="inline-block w-6 h-6 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">📁</p>
          <p className="text-gray-600 font-semibold">No projects yet</p>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            Create a project to group related receipts — great for trips, renovations, or tax years.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary inline-block mt-2">
            Create your first project
          </button>
        </div>
      )}

      {/* ── Project list ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="card hover:shadow-md transition-all group relative">
            <div className="flex items-center gap-4">
              {/* Icon with project colour */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: p.color + "20", border: `2px solid ${p.color}40` }}
              >
                {p.icon}
              </div>

              {/* Name + description */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-bold text-gray-900 hover:text-brand-700 transition-colors text-sm sm:text-base"
                >
                  {p.name}
                </Link>
                {p.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  Last activity: {fmtDate(p.lastActivity)}
                </p>
              </div>

              {/* Stats */}
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">{fmtMoney(p.totalSpend)}</p>
                <p className="text-xs text-gray-400">{p.count} receipt{p.count !== 1 ? "s" : ""}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <Link
                  href={`/projects/${p.id}`}
                  className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors text-sm"
                  title="View project"
                >
                  →
                </Link>
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  disabled={deleting === p.id}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete project"
                >
                  {deleting === p.id
                    ? <span className="inline-block w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                    : "🗑️"}
                </button>
              </div>
            </div>

            {/* Colour accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              style={{ backgroundColor: p.color }}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
