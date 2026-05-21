"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";

export default function UploadPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError("");
      setUploading(true);
      setProgress("Uploading file...");

      try {
        const formData = new FormData();
        formData.append("file", files[0]);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Upload failed");
        }

        setProgress("Running OCR & extracting data...");
        const { id } = await res.json();

        // Poll for OCR completion
        let attempts = 0;
        while (attempts < 30) {
          await new Promise((r) => setTimeout(r, 1000));
          const check = await fetch(`/api/receipts/${id}`);
          const receipt = await check.json();
          if (receipt.ocrDone) break;
          attempts++;
        }

        setProgress("Done! Redirecting...");
        router.push(`/receipts/${id}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setUploading(false);
        setProgress("");
      }
    },
    [router]
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Receipt</h1>
        <p className="text-gray-500 mt-1">
          Take a photo or upload an image/PDF — we&apos;ll extract all the details automatically.
        </p>
      </div>

      {uploading ? (
        <div className="card text-center py-16 space-y-4">
          <div className="inline-block w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-medium text-gray-700">{progress}</p>
          <p className="text-sm text-gray-400">
            This usually takes 5–15 seconds
          </p>
        </div>
      ) : (
        <UploadZone onFiles={handleFiles} />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="card bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-2">What we extract</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Merchant name &amp; date</li>
          <li>✓ Total amount &amp; tax</li>
          <li>✓ Currency detection (USD, EUR, GBP, JPY…)</li>
          <li>✓ Line items (when visible)</li>
          <li>✓ Category auto-classification</li>
          <li>✓ Full OCR text (searchable)</li>
        </ul>
      </div>
    </div>
  );
}
