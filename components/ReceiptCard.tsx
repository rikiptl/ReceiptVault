import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import Highlight from "@/components/Highlight";
import { tagColor } from "@/components/TagInput";

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
  tags: string[];
  isRecurring: boolean;
  warrantyExpiry: Date | null;
  reimbursable: boolean;
}

interface Props {
  receipt: Receipt;
  query?: string;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}

function warrantyBadge(expiry: Date | null) {
  if (!expiry) return null;
  const now  = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const d    = new Date(expiry);
  if (d < now)    return <span className="badge bg-red-50 text-red-700"   title="Warranty expired">🛡️ Expired</span>;
  if (d <= soon)  return <span className="badge bg-yellow-50 text-yellow-700" title="Warranty expiring soon">🛡️ Soon</span>;
  return              <span className="badge bg-green-50 text-green-700"  title="Active warranty">🛡️</span>;
}

export default function ReceiptCard({ receipt: r, query = "", selectable = false, selected = false, onToggle }: Props) {
  const emoji       = CATEGORY_EMOJI[r.category ?? ""] ?? "🧾";
  const displayName = r.merchant ?? r.originalName;
  const visibleTags = r.tags.slice(0, 3);

  const inner = (
    <div className={`card hover:shadow-md transition-all h-full flex flex-col gap-2 group-active:scale-[0.98] relative ${
      selected ? "ring-2 ring-brand-600 bg-brand-50/20" : ""
    }`}>
      {/* Checkbox (select mode) */}
      {selectable && (
        <div
          className="absolute top-2.5 left-2.5 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="w-4 h-4 accent-brand-600 cursor-pointer rounded"
          />
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start justify-between gap-2 ${selectable ? "pl-6" : ""}`}>
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

      {/* Tags row */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${tagColor(tag)}`}
            >
              {tag}
            </span>
          ))}
          {r.tags.length > 3 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] text-gray-400 bg-gray-50 border border-gray-200">
              +{r.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Date + badges */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {r.date ?? formatDate(r.createdAt.toISOString())}
        </p>
        <div className="flex gap-1 items-center flex-wrap justify-end">
          {r.reimbursable && (
            <span className="badge bg-emerald-50 text-emerald-700" title="Reimbursable">💰</span>
          )}
          {r.isRecurring && (
            <span className="badge bg-indigo-50 text-indigo-700" title="Recurring">🔁</span>
          )}
          {warrantyBadge(r.warrantyExpiry)}
          {!r.ocrDone && (
            <span className="badge bg-yellow-50 text-yellow-700">⏳</span>
          )}
          {r.verified && (
            <span className="badge bg-green-50 text-green-700">✓</span>
          )}
        </div>
      </div>
    </div>
  );

  if (selectable) {
    return (
      <div
        onClick={onToggle}
        className="block cursor-pointer group select-none"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link href={`/receipts/${r.id}`} className="block group">
      {inner}
    </Link>
  );
}
