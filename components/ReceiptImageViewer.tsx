"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  src: string;
  alt: string;
  mimeType: string;
}

export default function ReceiptImageViewer({ src, alt, mimeType }: Props) {
  // Default ON: boosts brightness + contrast for dark/shadowed photos.
  // Applies only as a CSS filter — the stored file is never changed.
  const [enhanced, setEnhanced] = useState(true);

  const isImage = mimeType.startsWith("image/");
  const isPdf   = mimeType === "application/pdf";

  const filter = enhanced
    ? "brightness(1.18) contrast(1.25) saturate(0.88)"
    : "none";

  if (!isImage && !isPdf) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-2">📄</p>
        <p>Preview not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toggle button */}
      {isImage && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setEnhanced((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              enhanced
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span>{enhanced ? "✨" : "🌑"}</span>
            {enhanced ? "Enhanced" : "Original"}
          </button>
        </div>
      )}

      {/* Image */}
      {isImage ? (
        <div className="relative w-full rounded-lg overflow-hidden" style={{ minHeight: 400 }}>
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain rounded-lg transition-[filter] duration-300"
            style={{ filter }}
            unoptimized
          />
        </div>
      ) : (
        <iframe
          src={src}
          className="w-full h-[600px] rounded-lg border"
          title="Receipt PDF"
        />
      )}
    </div>
  );
}
