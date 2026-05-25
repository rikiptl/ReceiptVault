"use client";

import { useEffect, useState } from "react";

interface Webhook {
  id: string;
  url: string;
  label: string;
  secret: string;
  events: string;
  enabled: boolean;
  createdAt: string;
}

const ALL_EVENTS = [
  { value: "receipt.created",       label: "📤 receipt.created",       desc: "Fired when a new receipt is uploaded" },
  { value: "receipt.ocr_completed", label: "🔬 receipt.ocr_completed", desc: "Fired when OCR finishes extracting data" },
  { value: "receipt.updated",       label: "✏️ receipt.updated",        desc: "Fired when a receipt is manually edited" },
];

export default function SettingsPage() {
  const [hooks, setHooks]       = useState<Webhook[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  // New webhook form state
  const [url, setUrl]       = useState("");
  const [label, setLabel]   = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>(["receipt.created", "receipt.ocr_completed"]);
  const [saving, setSaving] = useState(false);

  // Test state per hook
  const [testing, setTesting] = useState<Record<string, "idle"|"ok"|"fail">>({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/webhooks");
    if (res.ok) setHooks(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createHook(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setSaving(true);
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label, secret, events: events.join(",") }),
    });
    setUrl(""); setLabel(""); setSecret("");
    setEvents(["receipt.created", "receipt.ocr_completed"]);
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function toggleEnabled(hook: Webhook) {
    await fetch(`/api/webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !hook.enabled }),
    });
    load();
  }

  async function deleteHook(id: string) {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    load();
  }

  async function testHook(id: string) {
    setTesting((t) => ({ ...t, [id]: "idle" }));
    const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
    const data = await res.json();
    setTesting((t) => ({ ...t, [id]: data.ok ? "ok" : "fail" }));
    setTimeout(() => setTesting((t) => ({ ...t, [id]: "idle" })), 4000);
  }

  function toggleEvent(ev: string) {
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">⚙️ Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Configure webhooks to connect ReceiptVault to Zapier, Make, n8n, or your own systems.
        </p>
      </div>

      {/* Webhooks section */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">🔌 Webhooks</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              POST a JSON event to your URL every time something happens in ReceiptVault.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary text-sm"
          >
            {showForm ? "Cancel" : "+ Add webhook"}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={createHook} className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Endpoint URL *</label>
              <input
                type="url"
                required
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Label (optional)</label>
              <input
                type="text"
                placeholder="e.g. Zapier → Google Sheets"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Secret (optional — used for HMAC-SHA256 signature)
              </label>
              <input
                type="text"
                placeholder="mysecret123"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="input text-sm w-full font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                We&apos;ll send a <code className="bg-gray-100 px-1 rounded">X-ReceiptVault-Signature: sha256=…</code> header you can verify.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">Events to subscribe</label>
              <div className="space-y-2">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="mt-0.5 w-4 h-4 accent-brand-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800 font-mono">{ev.label}</p>
                      <p className="text-xs text-gray-500">{ev.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" disabled={saving || events.length === 0} className="btn-primary text-sm w-full">
              {saving ? "Saving…" : "Save webhook"}
            </button>
          </form>
        )}

        {/* List */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
        ) : hooks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">🔌</p>
            <p className="text-sm">No webhooks yet. Add one to start automating.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hooks.map((h) => (
              <div
                key={h.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  h.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {h.label || "Webhook"}
                    </p>
                    <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{h.url}</p>
                  </div>
                  {/* Enabled toggle */}
                  <button
                    onClick={() => toggleEnabled(h)}
                    title={h.enabled ? "Disable" : "Enable"}
                    className={`shrink-0 w-10 h-5 rounded-full transition-colors ${
                      h.enabled ? "bg-brand-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${
                        h.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-1.5">
                  {h.events.split(",").map((ev) => (
                    <span key={ev} className="badge bg-brand-50 text-brand-700 font-mono text-xs">
                      {ev.trim()}
                    </span>
                  ))}
                  {h.secret && (
                    <span className="badge bg-yellow-50 text-yellow-700 text-xs">🔒 signed</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => testHook(h.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium"
                  >
                    {testing[h.id] === "ok"   ? "✅ Sent!"   :
                     testing[h.id] === "fail" ? "❌ Failed"  : "🧪 Send test"}
                  </button>
                  <button
                    onClick={() => deleteHook(h.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card bg-blue-50 border-blue-100 space-y-3">
        <h3 className="font-semibold text-blue-900 text-sm">How webhooks work</h3>
        <div className="space-y-2 text-xs text-blue-800">
          <p>
            Every time a receipt is created or updated, ReceiptVault sends a <strong>POST</strong> request
            to your URL with a JSON body like this:
          </p>
          <pre className="bg-white/70 rounded-lg p-3 text-xs font-mono overflow-x-auto text-blue-900 border border-blue-100">{`{
  "event": "receipt.ocr_completed",
  "timestamp": "2026-05-24T15:00:00.000Z",
  "receipt": {
    "id": "abc-123",
    "merchant": "Whole Foods",
    "total": "47.32",
    "category": "Groceries",
    "tags": ["business"],
    "confidence": 88,
    "paymentMethod": "Visa",
    ...
  }
}`}</pre>
          <p>
            Use the <strong>secret</strong> to verify requests: check the{" "}
            <code className="bg-white/70 px-1 rounded">X-ReceiptVault-Signature</code> header
            matches <code className="bg-white/70 px-1 rounded">sha256=HMAC(secret, body)</code>.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { logo: "⚡", name: "Zapier", tip: "Use \"Webhooks by Zapier\" → Catch Hook" },
            { logo: "🔧", name: "Make.com", tip: "Add a \"Webhooks\" module as trigger" },
            { logo: "🔀", name: "n8n", tip: "Add a \"Webhook\" node as the start node" },
          ].map((t) => (
            <div key={t.name} className="bg-white/70 rounded-lg p-2.5 border border-blue-100">
              <p className="text-base mb-0.5">{t.logo} <strong>{t.name}</strong></p>
              <p className="text-xs text-blue-700">{t.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
