import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/utils";
import EditReceiptForm from "./EditReceiptForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptDetailPage({ params }: PageProps) {
  const { id } = await params;
  const receipt = await db.receipt.findUnique({ where: { id } });
  if (!receipt) notFound();

  const isImage = receipt.mimeType.startsWith("image/");
  const isPdf = receipt.mimeType === "application/pdf";

  const items = Array.isArray(receipt.items)
    ? (receipt.items as { name: string; total: string }[])
    : [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/receipts" className="hover:text-gray-700">
          Receipts
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">
          {receipt.merchant ?? receipt.originalName}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: Receipt image */}
        <div className="space-y-4">
          <div className="card p-4 flex flex-col items-center">
            {isImage ? (
              <div className="relative w-full" style={{ minHeight: 400 }}>
                <Image
                  src={`/api/files/${receipt.filename}`}
                  alt={receipt.originalName}
                  fill
                  className="object-contain rounded-lg"
                  unoptimized
                />
              </div>
            ) : isPdf ? (
              <div className="w-full">
                <iframe
                  src={`/api/files/${receipt.filename}`}
                  className="w-full h-[600px] rounded-lg border"
                  title="Receipt PDF"
                />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">📄</p>
                <p>Preview not available</p>
              </div>
            )}
          </div>

          {/* OCR Text */}
          {receipt.ocrText && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                Raw OCR Text
              </h3>
              <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono bg-gray-50 rounded p-3 max-h-64 overflow-y-auto">
                {receipt.ocrText}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Extracted data + edit form */}
        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex gap-2">
            {receipt.ocrDone ? (
              <span className="badge bg-green-50 text-green-700">
                ✓ OCR Complete
              </span>
            ) : (
              <span className="badge bg-yellow-50 text-yellow-700">
                ⏳ Processing...
              </span>
            )}
            {receipt.verified && (
              <span className="badge bg-blue-50 text-blue-700">
                ✓ Verified
              </span>
            )}
          </div>

          {/* Key data */}
          <div className="card grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Merchant
              </p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {receipt.merchant ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Date
              </p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {receipt.date ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Total
              </p>
              <p className="font-semibold text-gray-900 mt-0.5 text-lg">
                {receipt.total
                  ? formatCurrency(receipt.total, receipt.currency)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Tax
              </p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {receipt.tax
                  ? formatCurrency(receipt.tax, receipt.currency)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Category
              </p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {receipt.category ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Currency
              </p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {receipt.currency}
              </p>
            </div>
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">
                Line Items ({items.length})
              </h3>
              <div className="divide-y divide-gray-100">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.total, receipt.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit form */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">
              Edit / Verify Details
            </h3>
            <EditReceiptForm receipt={receipt} />
          </div>

          {/* Uploaded at */}
          <p className="text-xs text-gray-400 text-right">
            Uploaded {formatDate(receipt.createdAt.toISOString())} ·{" "}
            {(receipt.fileSize / 1024).toFixed(1)} KB
          </p>
        </div>
      </div>
    </div>
  );
}
