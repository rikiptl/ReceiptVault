"use client";

import { useCallback, useState } from "react";

interface Props {
  onFiles: (files: File[]) => void;
}

export default function UploadZone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return (
    <label
      className={`relative flex flex-col items-center justify-center gap-4
        border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-all
        ${
          dragging
            ? "border-brand-500 bg-brand-50"
            : "border-gray-300 bg-white hover:border-brand-400 hover:bg-gray-50"
        }`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
    >
      <input
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={handleChange}
      />

      <div className="text-center space-y-2">
        <p className="text-5xl">
          {dragging ? "📂" : "📸"}
        </p>
        <p className="text-lg font-semibold text-gray-800">
          {dragging ? "Drop it!" : "Drag & drop a receipt"}
        </p>
        <p className="text-sm text-gray-400">
          or <span className="text-brand-600 font-medium">browse files</span>
        </p>
        <p className="text-xs text-gray-400">
          JPG, PNG, WebP, or PDF · up to 10 MB
        </p>
      </div>
    </label>
  );
}
