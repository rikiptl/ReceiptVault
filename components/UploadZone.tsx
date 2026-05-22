"use client";

import { useCallback, useRef } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFiles, disabled }: Props) {
  const isDragging = useRef(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      isDragging.current = false;
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(f.type)
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
      e.target.value = "";
    },
    [onFiles]
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <label
        className={`relative flex flex-col items-center justify-center gap-3
          border-2 border-dashed rounded-2xl p-8 sm:p-12 cursor-pointer transition-all
          ${disabled
            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
            : "border-gray-300 bg-white hover:border-brand-400 hover:bg-brand-50 active:bg-brand-100"
          }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); }}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
        />
        <p className="text-4xl sm:text-5xl">📁</p>
        <div className="text-center">
          <p className="text-base sm:text-lg font-semibold text-gray-800">
            Drag &amp; drop receipts here
          </p>
          <p className="text-sm text-gray-400 mt-1">
            or <span className="text-brand-600 font-medium">browse files</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            JPG, PNG, WebP, PDF · multiple files OK · up to 10 MB each
          </p>
        </div>
      </label>

      {/* Mobile camera button */}
      <label
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl
          border-2 border-brand-200 bg-brand-50 text-brand-700 font-medium text-sm
          cursor-pointer transition-all hover:bg-brand-100 active:bg-brand-200
          ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
        />
        <span className="text-xl">📸</span>
        Take Photo with Camera
      </label>
    </div>
  );
}
