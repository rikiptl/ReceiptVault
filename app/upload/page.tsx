"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";
import Link from "next/link";

type FileStatus = "pending" | "enhancing" | "uploading" | "extracting" | "done" | "duplicate" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
  receiptId?: string;
  duplicate?: { id: string; merchant: string; date: string; total: string };
}

const STATUS_LABEL: Record<FileStatus, string> = {
  pending:     "Waiting…",
  enhancing:   "Enhancing image…",
  uploading:   "Uploading…",
  extracting:  "Extracting data…",
  done:        "Done ✓",
  duplicate:   "Duplicate detected",
  error:       "Failed",
};

const STATUS_COLOR: Record<FileStatus, string> = {
  pending:    "text-gray-400",
  enhancing:  "text-purple-500",
  uploading:  "text-blue-500",
  extracting: "text-yellow-600",
  done:       "text-green-600",
  duplicate:  "text-orange-500",
  error:      "text-red-500",
};

// ── Scanner-quality image enhancement ────────────────────────────────────────
// Uses per-channel auto-levels (2nd–98th percentile stretch) + contrast boost.
// A LUT (lookup table) approach is used so pixel processing is O(1) per pixel.
async function enhanceReceiptImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file; // PDFs pass through unchanged

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Scale down to max 2400px on the longest side (better OCR than smaller,
      // lower storage than a raw phone photo)
      const MAX_PX = 2400;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (Math.max(w, h) > MAX_PX) {
        const scale = MAX_PX / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const px = imageData.data; // flat RGBA array

      // Build per-channel histograms
      const rH = new Uint32Array(256);
      const gH = new Uint32Array(256);
      const bH = new Uint32Array(256);
      for (let i = 0; i < px.length; i += 4) {
        rH[px[i]]++;
        gH[px[i + 1]]++;
        bH[px[i + 2]]++;
      }

      // Return the value at which `fraction` of pixels fall below
      const percentile = (hist: Uint32Array, fraction: number) => {
        const target = (w * h) * fraction;
        let acc = 0;
        for (let v = 0; v < 256; v++) {
          acc += hist[v];
          if (acc >= target) return v;
        }
        return 255;
      };

      // Clip at 2nd / 98th percentile to ignore extreme outliers
      const rLo = percentile(rH, 0.02), rHi = percentile(rH, 0.98);
      const gLo = percentile(gH, 0.02), gHi = percentile(gH, 0.98);
      const bLo = percentile(bH, 0.02), bHi = percentile(bH, 0.98);

      // Parameters — tune here if needed
      const CONTRAST   = 1.3;  // contrast multiplier after leveling
      const BRIGHTNESS = 12;   // additive brightness lift (0–255 scale)

      // Build lookup tables (LUT): one entry per possible 0–255 input value
      const makeLUT = (lo: number, hi: number): Uint8Array => {
        const range = hi - lo || 1;
        const lut = new Uint8Array(256);
        for (let v = 0; v < 256; v++) {
          const leveled   = ((v - lo) / range) * 255;           // stretch to full range
          const contrasted = (leveled - 128) * CONTRAST + 128 + BRIGHTNESS;
          lut[v] = Math.max(0, Math.min(255, Math.round(contrasted)));
        }
        return lut;
      };

      const rLUT = makeLUT(rLo, rHi);
      const gLUT = makeLUT(gLo, gHi);
      const bLUT = makeLUT(bLo, bHi);

      // Apply LUTs — O(1) per pixel (just array lookup)
      for (let i = 0; i < px.length; i += 4) {
        px[i]     = rLUT[px[i]];
        px[i + 1] = gLUT[px[i + 1]];
        px[i + 2] = bLUT[px[i + 2]];
        // px[i + 3] = alpha — unchanged
      }

      ctx.putImageData(imageData, 0, 0);

      // Save as JPEG (quality 0.92 — good balance of size vs. quality for OCR)
      const outName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], outName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}
// ─────────────────────────────────────────────────────────────────────────────

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

      // ── Step 1: Enhance (images only) ──────────────────────────────────────
      update(i, { status: "enhancing" });
      let fileToUpload: File;
      try {
        fileToUpload = await enhanceReceiptImage(current[i].file);
      } catch {
        fileToUpload = current[i].file; // fall back to original on any error
      }

      // ── Step 2: Upload ──────────────────────────────────────────────────────
      update(i, { status: "uploading" });

      try {
        const formData = new FormData();
        formData.append("file", fileToUpload);

        const res  = await fetch("/api/upload", { method: "POST", body: formData });
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

        // ── Step 3: Wait for OCR ──────────────────────────────────────────────
        update(i, { status: "extracting", receiptId: data.id });
        current[i].receiptId = data.id;

        let attempts = 0;
        while (attempts < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          const check   = await fetch(`/api/receipts/${data.id}`);
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
  const hasImages  = entries.some((e) => e.file.type.startsWith("image/"));

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
            <div>
              <h2 className="font-semibold text-gray-900">
                {entries.length} file{entries.length !== 1 ? "s" : ""} queued
              </h2>
              {hasImages && !running && !done && (
                <p className="text-xs text-purple-600 mt-0.5">
                  ✨ Images will be auto-enhanced before uploading
                </p>
              )}
            </div>
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
                  {entry.status === "done"       ? "✅" :
                   entry.status === "error"      ? "❌" :
                   entry.status === "duplicate"  ? "⚠️" :
                   entry.status === "enhancing"  ? "✨" :
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

                {/* Size + actions */}
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
                {doneCount  > 0 && <span className="text-green-600 font-medium">{doneCount} uploaded · </span>}
                {dupCount   > 0 && <span className="text-orange-500 font-medium">{dupCount} duplicate{dupCount !== 1 ? "s" : ""} · </span>}
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
          <li>✨ Images are <strong>auto-enhanced</strong> (brightness + contrast) before upload — text is always crisp</li>
          <li>📱 On mobile, tap <strong>Take Photo</strong> to snap a receipt instantly</li>
          <li>📁 Drop a whole folder of receipts to batch-process them</li>
          <li>⚠️ Duplicates are detected by merchant + amount + date</li>
          <li>🔄 If OCR misses something, re-run it from the receipt detail page</li>
        </ul>
      </div>
    </div>
  );
}
