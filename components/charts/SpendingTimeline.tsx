"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface DataPoint { date: string; amount: number; count: number }
interface SpendingResponse {
  data:          DataPoint[];
  total:         number;
  prevTotal:     number;
  delta:         number;
  deltaPercent:  number | null;
  avgPerPeriod:  number;
  receiptCount:  number;
  bestDay:       { date: string; amount: number };
  gran:          "day" | "week" | "month";
  period:        string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */
const PERIODS = [
  { key: "1W",  label: "1W"  },
  { key: "1M",  label: "1M"  },
  { key: "3M",  label: "3M"  },
  { key: "6M",  label: "6M"  },
  { key: "1Y",  label: "1Y"  },
  { key: "ALL", label: "ALL" },
];

const GRAN_LABEL: Record<string, string> = {
  day: "daily avg", week: "weekly avg", month: "monthly avg",
};

/* ── Custom tooltip (stock-style crosshair) ────────────────────────────────── */
const CrosshairTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number; payload: DataPoint }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2.5 shadow-xl text-sm pointer-events-none">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-bold text-lg leading-none">${d.value.toFixed(2)}</p>
      {d.payload.count > 0 && (
        <p className="text-gray-400 text-xs mt-1">
          {d.payload.count} receipt{d.payload.count !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function SpendingTimeline({
  categories,
}: {
  categories: string[];
}) {
  const [period, setPeriod] = useState("1M");
  const [cat,    setCat]    = useState("");
  const [resp,   setResp]   = useState<SpendingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async (p: string, c: string) => {
    setLoading(true);
    const qs  = new URLSearchParams({ period: p, ...(c ? { cat: c } : {}) });
    const res = await fetch(`/api/analytics/spending?${qs}`);
    if (res.ok) setResp(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(period, cat); }, [period, cat, fetch_]);

  const isUp      = (resp?.delta ?? 0) >= 0;
  const hasDelta  = resp?.deltaPercent !== null;
  const maxAmount = resp ? Math.max(...resp.data.map((d) => d.amount), 0.01) : 1;

  return (
    <div className="card space-y-4">
      {/* ── Header row: total + delta ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Spending {resp ? `— ${resp.period === "ALL" ? "all time" : `last ${resp.period}`}` : ""}
          </p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {loading ? "—" : `$${resp!.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            {!loading && hasDelta && (
              <span className={`flex items-center gap-0.5 text-sm font-semibold mb-1 ${isUp ? "text-red-500" : "text-green-600"}`}>
                {isUp ? "▲" : "▼"}
                {Math.abs(resp!.deltaPercent!).toFixed(1)}%
                <span className="font-normal text-gray-400 ml-1 text-xs">vs prev period</span>
              </span>
            )}
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1 self-start">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category filter ───────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCat("")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              cat === ""
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c === cat ? "" : c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                cat === c
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────────────── */}
      <div className={`transition-opacity duration-300 ${loading ? "opacity-40" : "opacity-100"}`}>
        {resp && resp.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={resp.data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#16a34a" stopOpacity={0.30} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f4f6"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                // Show fewer ticks to avoid crowding
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v === 0 ? "" : `$${v}`
                }
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                domain={[0, Math.ceil(maxAmount * 1.18)]}
                width={44}
              />
              <Tooltip
                content={<CrosshairTooltip />}
                cursor={{
                  stroke: "#16a34a",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              {/* Average reference line */}
              {resp.avgPerPeriod > 0 && (
                <ReferenceLine
                  y={resp.avgPerPeriod}
                  stroke="#d1fae5"
                  strokeDasharray="6 3"
                  label={{
                    value: `avg $${resp.avgPerPeriod.toFixed(0)}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#6b7280",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#16a34a"
                strokeWidth={2}
                fill="url(#spendGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "#16a34a", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          !loading && (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              No spending data for this period
            </div>
          )
        )}
      </div>

      {/* ── Stats bar ────────────────────────────────────────────── */}
      {resp && !loading && (
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">
              {GRAN_LABEL[resp.gran] ?? "avg"}
            </p>
            <p className="font-semibold text-gray-900 text-sm mt-0.5">
              ${resp.avgPerPeriod.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">receipts</p>
            <p className="font-semibold text-gray-900 text-sm mt-0.5">
              {resp.receiptCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">peak {resp.gran}</p>
            <p className="font-semibold text-gray-900 text-sm mt-0.5">
              {resp.bestDay.amount > 0
                ? `$${resp.bestDay.amount.toFixed(2)}`
                : "—"}
              {resp.bestDay.date && resp.bestDay.amount > 0 && (
                <span className="text-gray-400 font-normal ml-1 text-xs">
                  {resp.bestDay.date}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
