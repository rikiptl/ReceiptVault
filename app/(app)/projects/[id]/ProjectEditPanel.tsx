"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESET_COLORS = [
  "#22c55e","#3b82f6","#8b5cf6","#f59e0b",
  "#ef4444","#06b6d4","#ec4899","#6b7280",
];
const PRESET_ICONS = ["📁","💼","✈️","🏠","🎯","🏗️","🎉","💊","🍕","📊","🌍","🎓"];

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
}

export default function ProjectEditPanel({ project }: { project: Project }) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [deleting,setDeleting]= useState(false);
  const [form,    setForm]    = useState({
    name:        project.name,
    description: project.description ?? "",
    color:       project.color,
    icon:        project.icon,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setOpen(false);
      router.refresh();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete project "${project.name}"? Receipts won't be deleted.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      router.push("/projects");
    } catch { setDeleting(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary text-sm shrink-0"
      >
        ✏️ Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">Edit Project</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex gap-3">
              <select
                className="input text-2xl h-11 w-16 text-center"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              >
                {PRESET_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <input
                className="input flex-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Project name"
              />
            </div>

            <textarea
              className="input resize-none text-sm w-full"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
            />

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

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-secondary text-red-600 hover:bg-red-50 px-3"
              >
                {deleting
                  ? <span className="inline-block w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : "🗑️"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
