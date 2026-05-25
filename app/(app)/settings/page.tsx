"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Webhook {
  id: string; url: string; label: string; secret: string;
  events: string; enabled: boolean; createdAt: string;
}
interface Settings {
  googleDriveEnabled: boolean; googleDriveCredentials: string;
  googleDriveFolderId: string;
  dropboxEnabled: boolean; dropboxToken: string; dropboxFolder: string;
  slackWebhookUrl: string;
  resendApiKey: string; digestFromEmail: string; digestToEmail: string;
}

const ALL_EVENTS = [
  { value: "receipt.created",       label: "receipt.created",       desc: "New receipt uploaded" },
  { value: "receipt.ocr_completed", label: "receipt.ocr_completed", desc: "OCR finished extracting data" },
  { value: "receipt.updated",       label: "receipt.updated",       desc: "Receipt manually edited" },
];

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  /* Webhooks */
  const [hooks, setHooks]       = useState<Webhook[]>([]);
  const [hooksLoading, setHL]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [whUrl, setWhUrl]       = useState("");
  const [whLabel, setWhLabel]   = useState("");
  const [whSecret, setWhSecret] = useState("");
  const [whEvents, setWhEvents] = useState(["receipt.created", "receipt.ocr_completed"]);
  const [whSaving, setWhSaving] = useState(false);
  const [testing, setTesting]   = useState<Record<string, "idle"|"ok"|"fail">>({});

  /* App settings */
  const [cfg, setCfg]         = useState<Partial<Settings>>({});
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved]   = useState(false);

  /* Sync test state */
  const [syncTest, setSyncTest] = useState<Record<string, "idle"|"ok"|"fail"|"running">>({});

  /* Digest state */
  const [digestSending, setDigestSending] = useState(false);
  const [digestResult,  setDigestResult]  = useState<string>("");

  /* ── Load ─────────────────────────────────────────────────────────────── */
  const loadHooks = useCallback(async () => {
    setHL(true);
    const r = await fetch("/api/webhooks");
    if (r.ok) setHooks(await r.json());
    setHL(false);
  }, []);

  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/settings");
    if (r.ok) setCfg(await r.json());
  }, []);

  useEffect(() => { loadHooks(); loadSettings(); }, [loadHooks, loadSettings]);

  /* ── Settings save ────────────────────────────────────────────────────── */
  async function saveSettings() {
    setCfgSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    setCfgSaving(false);
    setCfgSaved(true);
    setTimeout(() => setCfgSaved(false), 3000);
  }

  function patch(key: keyof Settings, value: unknown) {
    setCfg((p) => ({ ...p, [key]: value }));
  }

  /* ── Cloud sync test ──────────────────────────────────────────────────── */
  async function testSync(provider: "google" | "dropbox") {
    setSyncTest((s) => ({ ...s, [provider]: "running" }));
    // Save first so the server reads the latest credentials
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    const r = await fetch(`/api/settings/sync-test?provider=${provider}`, { method: "POST" });
    const data = await r.json() as { ok: boolean };
    setSyncTest((s) => ({ ...s, [provider]: data.ok ? "ok" : "fail" }));
    setTimeout(() => setSyncTest((s) => ({ ...s, [provider]: "idle" })), 5000);
  }

  /* ── Digest ───────────────────────────────────────────────────────────── */
  async function sendDigest(days: number) {
    setDigestSending(true);
    setDigestResult("");
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    const r = await fetch(`/api/digest/send?days=${days}`, { method: "POST" });
    const data = await r.json() as { ok: boolean; results?: Record<string,string>; error?: string };
    if (data.ok) {
      setDigestResult(`✅ Sent! ${Object.entries(data.results ?? {}).map(([k,v]) => `${k}: ${v}`).join(" · ")}`);
    } else {
      setDigestResult(`❌ ${data.error}`);
    }
    setDigestSending(false);
  }

  /* ── Webhook helpers ─────────────────────────────────────────────────── */
  async function createHook(e: React.FormEvent) {
    e.preventDefault();
    if (!whUrl) return;
    setWhSaving(true);
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: whUrl, label: whLabel, secret: whSecret, events: whEvents.join(",") }),
    });
    setWhUrl(""); setWhLabel(""); setWhSecret("");
    setWhEvents(["receipt.created", "receipt.ocr_completed"]);
    setShowForm(false);
    setWhSaving(false);
    loadHooks();
  }

  async function toggleHook(h: Webhook) {
    await fetch(`/api/webhooks/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !h.enabled }),
    });
    loadHooks();
  }

  async function deleteHook(id: string) {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    loadHooks();
  }

  async function testHook(id: string) {
    setTesting((t) => ({ ...t, [id]: "idle" }));
    const r = await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
    const d = await r.json() as { ok: boolean };
    setTesting((t) => ({ ...t, [id]: d.ok ? "ok" : "fail" }));
    setTimeout(() => setTesting((t) => ({ ...t, [id]: "idle" })), 4000);
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">⚙️ Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Webhooks, cloud backup, accountant exports, and digest notifications.
        </p>
      </div>

      {/* ── 1. Cloud Sync ─────────────────────────────────────────────────── */}
      <div className="card space-y-5">
        <div>
          <h2 className="font-semibold text-gray-900">☁️ Cloud Backup</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-upload every receipt image to Google Drive or Dropbox when it&apos;s saved.
          </p>
        </div>

        {/* Google Drive */}
        <div className="space-y-3 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔵</span>
              <p className="font-medium text-gray-900 text-sm">Google Drive</p>
            </div>
            <button
              onClick={() => patch("googleDriveEnabled", !cfg.googleDriveEnabled)}
              className={`shrink-0 w-10 h-5 rounded-full transition-colors ${cfg.googleDriveEnabled ? "bg-brand-500" : "bg-gray-300"}`}
            >
              <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${cfg.googleDriveEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
          {cfg.googleDriveEnabled && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Service Account JSON</label>
                <textarea
                  rows={3}
                  placeholder='{"type":"service_account","client_email":"...","private_key":"..."}'
                  value={cfg.googleDriveCredentials === "***" ? "" : (cfg.googleDriveCredentials ?? "")}
                  onChange={(e) => patch("googleDriveCredentials", e.target.value)}
                  className="input text-xs font-mono w-full"
                />
                {cfg.googleDriveCredentials === "***" && (
                  <p className="text-xs text-green-600 mt-0.5">✓ Credentials saved — paste new JSON to replace</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Folder ID (optional)</label>
                <input
                  type="text"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
                  value={cfg.googleDriveFolderId ?? ""}
                  onChange={(e) => patch("googleDriveFolderId", e.target.value)}
                  className="input text-sm w-full font-mono"
                />
                <p className="text-xs text-gray-400 mt-0.5">Copy from the folder&apos;s URL: /drive/folders/<strong>THIS_PART</strong></p>
              </div>
              <button
                onClick={() => testSync("google")}
                disabled={syncTest.google === "running"}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {syncTest.google === "running" ? "Testing…" :
                 syncTest.google === "ok"      ? "✅ Connected!" :
                 syncTest.google === "fail"    ? "❌ Failed" : "🧪 Test connection"}
              </button>
            </div>
          )}
        </div>

        {/* Dropbox */}
        <div className="space-y-3 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔷</span>
              <p className="font-medium text-gray-900 text-sm">Dropbox</p>
            </div>
            <button
              onClick={() => patch("dropboxEnabled", !cfg.dropboxEnabled)}
              className={`shrink-0 w-10 h-5 rounded-full transition-colors ${cfg.dropboxEnabled ? "bg-brand-500" : "bg-gray-300"}`}
            >
              <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${cfg.dropboxEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
          {cfg.dropboxEnabled && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Access Token</label>
                <input
                  type="password"
                  placeholder="sl.XXXXXXXXXXXXXX"
                  value={cfg.dropboxToken === "***" ? "" : (cfg.dropboxToken ?? "")}
                  onChange={(e) => patch("dropboxToken", e.target.value)}
                  className="input text-sm w-full font-mono"
                />
                {cfg.dropboxToken === "***" && (
                  <p className="text-xs text-green-600 mt-0.5">✓ Token saved</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  Get from <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener" className="underline">Dropbox App Console</a> → Generate access token
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Folder path</label>
                <input
                  type="text"
                  placeholder="/ReceiptVault"
                  value={cfg.dropboxFolder ?? "/ReceiptVault"}
                  onChange={(e) => patch("dropboxFolder", e.target.value)}
                  className="input text-sm w-full font-mono"
                />
              </div>
              <button
                onClick={() => testSync("dropbox")}
                disabled={syncTest.dropbox === "running"}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {syncTest.dropbox === "running" ? "Testing…" :
                 syncTest.dropbox === "ok"      ? "✅ Connected!" :
                 syncTest.dropbox === "fail"    ? "❌ Failed" : "🧪 Test connection"}
              </button>
            </div>
          )}
        </div>

        <button onClick={saveSettings} disabled={cfgSaving} className="btn-primary text-sm w-full">
          {cfgSaving ? "Saving…" : cfgSaved ? "✅ Saved!" : "Save cloud settings"}
        </button>
      </div>

      {/* ── 2. Digest ─────────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">📬 Spending Digest</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Send a weekly summary of your spending to Slack and/or email.
          </p>
        </div>

        {/* Slack */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <span>💬</span> Slack Incoming Webhook URL
          </label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/T.../B.../..."
            value={cfg.slackWebhookUrl ?? ""}
            onChange={(e) => patch("slackWebhookUrl", e.target.value)}
            className="input text-sm w-full"
          />
          <p className="text-xs text-gray-400">
            Create at <a href="https://api.slack.com/apps" target="_blank" rel="noopener" className="underline">api.slack.com/apps</a> → Incoming Webhooks → Add New Webhook
          </p>
        </div>

        {/* Email via Resend */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <span>📧</span> Email Digest (via <a href="https://resend.com" target="_blank" rel="noopener" className="underline">Resend</a> — free up to 3k/month)
          </label>
          <input
            type="password"
            placeholder="re_xxxxxxxxxxxx  (Resend API key)"
            value={cfg.resendApiKey === "***" ? "" : (cfg.resendApiKey ?? "")}
            onChange={(e) => patch("resendApiKey", e.target.value)}
            className="input text-sm w-full font-mono"
          />
          {cfg.resendApiKey === "***" && <p className="text-xs text-green-600">✓ API key saved</p>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">From address</label>
              <input
                type="email"
                placeholder="digest@yourdomain.com"
                value={cfg.digestFromEmail ?? ""}
                onChange={(e) => patch("digestFromEmail", e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">To address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={cfg.digestToEmail ?? ""}
                onChange={(e) => patch("digestToEmail", e.target.value)}
                className="input text-sm w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={saveSettings} disabled={cfgSaving} className="btn-secondary text-sm flex-1">
            {cfgSaving ? "Saving…" : cfgSaved ? "✅ Saved!" : "Save digest settings"}
          </button>
          <button
            onClick={() => sendDigest(7)}
            disabled={digestSending}
            className="btn-primary text-sm flex-1"
          >
            {digestSending ? "Sending…" : "📤 Send 7-day digest now"}
          </button>
          <button
            onClick={() => sendDigest(30)}
            disabled={digestSending}
            className="btn-secondary text-sm"
          >
            30d
          </button>
        </div>
        {digestResult && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{digestResult}</p>
        )}
      </div>

      {/* ── 3. Webhooks ───────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">🔌 Webhooks</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              POST JSON to your URL on every receipt event — wire up Zapier, Make, n8n.
            </p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createHook} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
            <input type="url" required placeholder="https://hooks.zapier.com/..." value={whUrl}
              onChange={(e) => setWhUrl(e.target.value)} className="input text-sm w-full" />
            <input type="text" placeholder="Label (optional)" value={whLabel}
              onChange={(e) => setWhLabel(e.target.value)} className="input text-sm w-full" />
            <input type="text" placeholder="Secret for HMAC signature (optional)" value={whSecret}
              onChange={(e) => setWhSecret(e.target.value)} className="input text-sm w-full font-mono" />
            <div className="space-y-1.5">
              {ALL_EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" className="w-4 h-4 accent-brand-600"
                    checked={whEvents.includes(ev.value)}
                    onChange={() => setWhEvents((p) => p.includes(ev.value) ? p.filter((e) => e !== ev.value) : [...p, ev.value])} />
                  <span className="font-mono text-xs text-gray-700">{ev.label}</span>
                  <span className="text-gray-400 text-xs">— {ev.desc}</span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={whSaving || whEvents.length === 0} className="btn-primary text-sm w-full">
              {whSaving ? "Saving…" : "Save webhook"}
            </button>
          </form>
        )}

        {hooksLoading ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
        ) : hooks.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No webhooks yet.</p>
        ) : (
          <div className="space-y-3">
            {hooks.map((h) => (
              <div key={h.id} className={`rounded-xl border p-4 space-y-2 ${h.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{h.label || "Webhook"}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{h.url}</p>
                  </div>
                  <button onClick={() => toggleHook(h)}
                    className={`shrink-0 w-10 h-5 rounded-full transition-colors ${h.enabled ? "bg-brand-500" : "bg-gray-300"}`}>
                    <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${h.enabled ? "translate-x-5" : ""}`} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {h.events.split(",").map((ev) => (
                    <span key={ev} className="badge bg-brand-50 text-brand-700 font-mono text-xs">{ev.trim()}</span>
                  ))}
                  {h.secret && <span className="badge bg-yellow-50 text-yellow-700 text-xs">🔒 signed</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => testHook(h.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                    {testing[h.id] === "ok" ? "✅ Sent!" : testing[h.id] === "fail" ? "❌ Failed" : "🧪 Test"}
                  </button>
                  <button onClick={() => deleteHook(h.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook payload reference */}
      <div className="card bg-blue-50 border-blue-100 text-xs text-blue-800 space-y-2">
        <p className="font-semibold text-blue-900 text-sm">Webhook payload format</p>
        <pre className="bg-white/70 rounded-lg p-3 font-mono overflow-x-auto border border-blue-100 text-blue-900">{`{
  "event": "receipt.ocr_completed",
  "timestamp": "2026-05-24T15:00:00.000Z",
  "receipt": { "id": "…", "merchant": "Whole Foods",
    "total": "47.32", "category": "Groceries",
    "confidence": 88, "paymentMethod": "Visa", … }
}`}</pre>
      </div>
    </div>
  );
}
