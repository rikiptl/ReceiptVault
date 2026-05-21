import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

const CATEGORY_EMOJI: Record<string, string> = {
  "Groceries": "🛒",
  "Food & Dining": "🍔",
  "Transport": "🚗",
  "Shopping": "🛍️",
  "Healthcare": "💊",
  "Utilities": "⚡",
  "Entertainment": "🎬",
  "Accommodation": "🏨",
  "Software/SaaS": "💻",
  "Other": "📄",
};

interface Receipt {
  id: string;
  merchant: string | null;
  originalName: string;
  date: string | null;
  total: string | null;
  currency: string;
  category: string | null;
  verified: boolean;
  ocrDone: boolean;
  createdAt: Date;
}

export default function ReceiptCard({ receipt: r }: { receipt: Receipt }) {
  const emoji = CATEGORY_EMOJI[r.category ?? ""] ?? "🧾";

  return (
    <Link href={`/receipts/${r.id}`} className="block">
      <div className="card hover:shadow-md transition-shadow h-full flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">
                {r.merchant ?? r.originalName}
              </p>
              <p className="text-xs text-gray-400">
                {r.category ?? "Uncategorized"}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-gray-900">
              {r.total ? formatCurrency(r.total, r.currency) : "—"}
            </p>
          </div>
        </div>

        {/* Date + badges */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {r.date ?? formatDate(r.createdAt.toISOString())}
          </p>
          <div className="flex gap-1">
            {!r.ocrDone && (
              <span className="badge bg-yellow-50 text-yellow-700">
                ⏳ processing
              </span>
            )}
            {r.verified && (
              <span className="badge bg-green-50 text-green-700">
                ✓ verified
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
