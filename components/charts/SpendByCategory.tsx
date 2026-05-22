"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export const CHART_COLORS = [
  "#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed",
  "#db2777", "#0891b2", "#65a30d", "#ea580c", "#6366f1",
];

interface CategoryDatum {
  name: string;
  total: number;
  count: number;
}

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: CategoryDatum }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{d.name}</p>
      <p className="text-gray-600">${d.total.toFixed(2)}</p>
      <p className="text-gray-400">{d.count} receipt{d.count !== 1 ? "s" : ""}</p>
    </div>
  );
};

export default function SpendByCategory({ data }: { data: CategoryDatum[] }) {
  const totalSpend = data.reduce((s, d) => s + d.total, 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="total"
            nameKey="name"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Table breakdown */}
      <div className="divide-y divide-gray-100">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-3 py-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="flex-1 text-sm text-gray-700 truncate">{d.name}</span>
            <span className="text-xs text-gray-400">{d.count}×</span>
            <span className="text-sm font-semibold text-gray-900 w-16 text-right">
              {fmt(d.total)}
            </span>
            <div className="w-20 bg-gray-100 rounded-full h-1.5 shrink-0">
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${Math.min(100, (d.total / (data[0]?.total || 1)) * 100)}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            </div>
            <span className="text-xs text-gray-400 w-10 text-right">
              {totalSpend > 0 ? `${((d.total / totalSpend) * 100).toFixed(0)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
