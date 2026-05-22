import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import Highlight from "@/components/Highlight";

const CATEGORY_EMOJI: Record<string, string> = {
  "Groceries":      "🛒",
  "Food & Dining":  "🍔",
  "Transport":      "🚗",
  "Shopping":       "🛍️",
  "Healthcare":     "💊",
  "Utilities":      "⚡",
  "Entertainment":  "🎬",
  "Accommodation":  "🏨",
  "Software/SaaS":  "💻",
  "Other":          "📄",
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

interface Props {
  receipt: Receipt;
  query?: string;
}

export default function ReceiptCard({ receipt: r, query = "" }: Props) {
  const emoji = CATEGORY_EMOJI[r.category ?? ""] ?? "🧾";
  const displayName = r.merchant ?? r.originalName;

  return (
    <Link href={`/receipts/${r.id}`} className="block group">
      <div className="card hover:shadow-md transition-all h-full flex flex-col gap-3 group-active:scale-[0.98]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight">
                <Highlight text={displayName} query={query} />
              </p>
              <p className="text-xs text-gray-400 truncate">
                <Highlight text={r.category ?? "Uncategorized"} query={query} />
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-gray-900 text-sm">
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
              <span className="badge bg-yellow-50 text-yellow-700">⏳</span>
            )}
            {r.verified && (
              <span className="badge bg-green-50 text-green-700">✓</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
