"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface YoYDatum {
  month: string;
  thisYear: number;
  lastYear: number;
}

interface Props {
  data: YoYDatum[];
  thisYear: number;
  lastYear: number;
}

const CustomTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm space-y-1">
      <p className="text-gray-500 text-xs mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-900">${p.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default function YearOverYear({ data, thisYear, lastYear }: Props) {
  const hasLastYear = data.some((d) => d.lastYear > 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-gray-600">{value}</span>
          )}
        />
        <Bar
          dataKey="thisYear"
          name={String(thisYear)}
          fill="#16a34a"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
        />
        {hasLastYear && (
          <Bar
            dataKey="lastYear"
            name={String(lastYear)}
            fill="#bbf7d0"
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
