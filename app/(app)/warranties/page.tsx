import { db } from "@/lib/db";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function daysFromNow(d: Date): number {
  return Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatExpiry(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface WarrantyReceipt {
  id: string;
  merchant: string | null;
  originalName: string;
  total: string | null;
  currency: string;
  category: string | null;
  warrantyExpiry: Date;
}

function WarrantyRow({ r, status }: { r: WarrantyReceipt; status: "expired" | "soon" | "active" }) {
  const days = daysFromNow(r.warrantyExpiry);
  const statusStyles = {
    expired: "border-red-200 bg-red-50",
    soon:    "border-yellow-200 bg-yellow-50",
    active:  "border-green-200 bg-green-50",
  };
  const badgeStyles = {
    expired: "bg-red-100 text-red-700",
    soon:    "bg-yellow-100 text-yellow-700",
    active:  "bg-green-100 text-green-700",
  };
  const expiryLabel = {
    expired: `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`,
    soon:    days === 0 ? "Expires today!" : `Expires in ${days} day${days !== 1 ? "s" : ""}`,
    active:  `Expires in ${days} day${days !== 1 ? "s" : ""}`,
  };

  return (
    <Link
      href={`/receipts/${r.id}`}
      className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-sm ${statusStyles[status]}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">
          {r.merchant ?? r.originalName}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {r.category && (
            <span className="text-xs text-gray-500">{r.category}</span>
          )}
          {r.total && (
            <span className="text-xs text-gray-500">
              {formatCurrency(r.total, r.currency)}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="text-xs font-medium text-gray-700">{formatExpiry(r.warrantyExpiry)}</p>
        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeStyles[status]}`}>
          {expiryLabel[status]}
        </span>
      </div>
    </Link>
  );
}

export default async function WarrantiesPage() {
  const now  = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const all = await db.receipt.findMany({
    where: { warrantyExpiry: { not: null } },
    orderBy: { warrantyExpiry: "asc" },
    select: {
      id: true,
      merchant: true,
      originalName: true,
      total: true,
      currency: true,
      category: true,
      warrantyExpiry: true,
    },
  }) as WarrantyReceipt[];

  const expired    = all.filter((r) => r.warrantyExpiry < now);
  const expiringSoon = all.filter((r) => r.warrantyExpiry >= now && r.warrantyExpiry <= soon);
  const active     = all.filter((r) => r.warrantyExpiry > soon);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🛡️ Warranty Tracker</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          {all.length} receipt{all.length !== 1 ? "s" : ""} with warranty dates
        </p>
      </div>

      {all.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">🛡️</p>
          <p className="text-gray-500 mb-4">No warranty dates set yet</p>
          <p className="text-sm text-gray-400 mb-6">
            Open any receipt and set a warranty expiry date to track it here.
          </p>
          <Link href="/receipts" className="btn-primary">Browse Receipts</Link>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center py-4">
              <p className="text-2xl font-bold text-red-600">{expired.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Expired</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-bold text-yellow-600">{expiringSoon.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Expiring Soon</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-bold text-green-600">{active.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Active</p>
            </div>
          </div>

          {/* Expiring Soon */}
          {expiringSoon.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                ⚠️ Expiring Soon
                <span className="text-xs font-normal text-gray-400">(within 30 days)</span>
              </h2>
              <div className="space-y-2">
                {expiringSoon.map((r) => (
                  <WarrantyRow key={r.id} r={r} status="soon" />
                ))}
              </div>
            </section>
          )}

          {/* Active */}
          {active.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-green-700 mb-3">✅ Active Warranties</h2>
              <div className="space-y-2">
                {active.map((r) => (
                  <WarrantyRow key={r.id} r={r} status="active" />
                ))}
              </div>
            </section>
          )}

          {/* Expired */}
          {expired.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-red-700 mb-3">❌ Expired</h2>
              <div className="space-y-2">
                {[...expired].reverse().map((r) => (
                  <WarrantyRow key={r.id} r={r} status="expired" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
