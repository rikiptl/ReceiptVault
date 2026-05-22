"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";
import Link from "next/link";

type FileStatus = "pending" | "uploading" | "extracting" | "done" | "duplicate" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
  receiptId?: string;
  duplicate?: { id: string; merchant: string; date: string; total: string };
}

const STATUS_LABEL: Record<FileStatus, string> = {
  pending:     "Waiting…",
  uploading:   "Uploading…",
  extracting:  "Extracting data…",
  done:        "Done ✓",
  duplicate:   "Duplicate detected",
  error:       "Failed",
};

const STATUS_COLOR: Record<FileStatus, string> = {
  pending:    "text-gray-400",
  uploading:  "text-blue-500",
  extracting: "text-yellow-600",
  done:       "text-green-600",
  duplicate:  "text-orange-500",
  error:      "text-red-500",
};

export default function UploadPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const update = (index: number, patch: Partial<FileEntry>) =>
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const handleFiles = useCallback((files: File[]) => {
    const newEntries: FileEntry[] = files.map((file) => ({ file, status: "pending" }));
    setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const runAll = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setDone(false);

    const current = entries.map((e) => ({ ...e }));

    for (let i = 0; i < current.length; i++) {
      if (current[i].status === "done") continue;

      update(i, { status: "uploading" });

      try {
        const formData = new FormData();
        formData.append("file", current[i].file);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          update(i, { status: "error", error: data.error ?? "Upload failed" });
          continue;
        }

        if (data.duplicate) {
          update(i, { status: "duplicate", receiptId: data.id, duplicate: data.duplicate });
          current[i].status = "duplicate";
          current[i].receiptId = data.id;
          continue;
        }

        update(i, { status: "extracting", receiptId: data.id });
        current[i].receiptId = data.id;

        // Poll until OCR done
        let attempts = 0;
        while (attempts < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          const check = await fetch(`/api/receipts/${data.id}`);
          const receipt = await check.json();
          if (receipt.ocrDone) break;
          attempts++;
        }

        update(i, { status: "done" });
        current[i].status = "done";
      } catch {
        update(i, { status: "error", error: "Network error" });
      }
    }

    setRunning(false);
    setDone(true);
  }, [entries, running]);

  const removeEntry = (i: number) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const clearAll = () => { setEntries([]); setDone(false); };

  const doneCount  = entries.filter((e) => e.status === "done").length;
  const errorCount = entries.filter((e) => e.status === "error").length;
  const dupCount   = entries.filter((e) => e.status === "duplicate").length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Upload Receipts</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Drop multiple files or take a photo — OCR extracts everything automatically.
        </p>
      </div>

      <UploadZone onFiles={handleFiles} disabled={running} />

      {/* File queue */}
      {entries.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {entries.length} file{entries.length !== 1 ? "s" : ""} queued
            </h2>
            {!running && (
              <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600">
                Clear all
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                {/* Icon */}
                <span className="text-xl shrink-0">
                  {entry.status === "done"      ? "✅" :
                   entry.status === "error"     ? "❌" :
                   entry.status === "duplicate" ? "⚠️" :
                   entry.status === "uploading" || entry.status === "extracting"
                     ? "⏳" : "📄"}
                </span>

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{entry.file.name}</p>
                  <p className={`text-xs ${STATUS_COLOR[entry.status]}`}>
                    {entry.error ?? STATUS_LABEL[entry.status]}
                  </p>
                  {entry.status === "duplicate" && entry.duplicate && (
                    <p className="text-xs text-orange-500">
                      Same as{" "}
                      <Link href={`/receipts/${entry.duplicate.id}`} className="underline">
                        {entry.duplicate.merchant} · {entry.duplicate.date} · ${entry.duplicate.total}
                      </Link>
                    </p>
                  )}
                </div>

                {/* Size + remove */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">
                    {(entry.file.size / 1024).toFixed(0)} KB
                  </span>
                  {entry.status === "done" && entry.receiptId && (
                    <Link
                      href={`/receipts/${entry.receiptId}`}
                      className="text-xs text-brand-600 font-medium hover:underline"
                    >
                      View
                    </Link>
                  )}
                  {!running && entry.status !== "done" && (
                    <button
                      onClick={() => removeEntry(i)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {!done ? (
            <button
              onClick={runAll}
              disabled={running || entries.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                `Upload ${entries.filter(e => e.status === "pending").length || entries.length} receipt${entries.length !== 1 ? "s" : ""}`
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-center text-gray-600">
                {doneCount > 0 && <span className="text-green-600 font-medium">{doneCount} uploaded · </span>}
                {dupCount  > 0 && <span className="text-orange-500 font-medium">{dupCount} duplicate{dupCount !== 1 ? "s" : ""} · </span>}
                {errorCount > 0 && <span className="text-red-500 font-medium">{errorCount} failed</span>}
              </div>
              <div className="flex gap-2">
                <Link href="/receipts" className="btn-primary flex-1 text-center">
                  View All Receipts
                </Link>
                <button onClick={clearAll} className="btn-secondary">
                  Upload More
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="card bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm">Tips</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>📱 On mobile, tap <strong>Take Photo</strong> to snap a receipt instantly</li>
          <li>📁 Drop a whole folder of receipts to batch-process them</li>
          <li>⚠️ Duplicates are detected by merchant + amount + date</li>
          <li>🔄 If OCR misses something, re-run it from the receipt detail page</li>
        </ul>
      </div>
    </div>
  );
}
