import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Gran = "day" | "week" | "month";

// ── Bucket key helpers ────────────────────────────────────────────────────────

function getKey(date: Date, gran: Gran): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  if (gran === "day") {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (gran === "month") {
    return `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  // week → ISO week-start (Sunday)
  const dow       = date.getDay();
  const weekStart = new Date(y, m, d - dow);
  return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
}

function getLabel(key: string, gran: Gran): string {
  const parts = key.split("-").map(Number);
  if (gran === "day") {
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (gran === "month") {
    const dt = new Date(parts[0], parts[1] - 1, 1);
    return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  // week
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateBuckets(since: Date, until: Date, gran: Gran) {
  const buckets: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  const cursor = new Date(since);
  while (cursor <= until) {
    const key = getKey(cursor, gran);
    if (!seen.has(key)) {
      seen.add(key);
      buckets.push({ key, label: getLabel(key, gran) });
    }
    if (gran === "day")   cursor.setDate(cursor.getDate() + 1);
    else if (gran === "week")  cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function aggregate(
  receipts: { total: string | null; createdAt: Date }[],
  gran: Gran
): Record<string, { amount: number; count: number }> {
  const map: Record<string, { amount: number; count: number }> = {};
  for (const r of receipts) {
    const v = parseFloat(r.total ?? "");
    if (isNaN(v) || v <= 0) continue;
    const key = getKey(r.createdAt, gran);
    map[key] ??= { amount: 0, count: 0 };
    map[key].amount += v;
    map[key].count++;
  }
  return map;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "1M";
  const cat    = searchParams.get("cat")    ?? "";

  const now   = new Date();
  let since:  Date;
  let prevSince: Date;
  let gran: Gran;

  switch (period) {
    case "1W":  since = new Date(+now - 7   * 86400000); gran = "day";   break;
    case "1M":  since = new Date(+now - 30  * 86400000); gran = "day";   break;
    case "3M":  since = new Date(+now - 90  * 86400000); gran = "week";  break;
    case "6M":  since = new Date(+now - 180 * 86400000); gran = "week";  break;
    case "1Y":  since = new Date(+now - 365 * 86400000); gran = "month"; break;
    default:    since = new Date(0);                      gran = "month"; break; // ALL
  }
  // previous window of same length (for delta calculation)
  const windowMs = +now - +since;
  prevSince      = new Date(+since - windowMs);

  const where = {
    ...(cat ? { category: cat } : {}),
  };

  // Fetch current + previous period in parallel
  const [current, previous] = await Promise.all([
    db.receipt.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.receipt.findMany({
      where: { ...where, createdAt: { gte: prevSince, lt: since } },
      select: { total: true },
    }),
  ]);

  const bucketMap = aggregate(current, gran);
  const filled    = generateBuckets(since, now, gran).map(({ key, label }) => ({
    date:   label,
    amount: Math.round((bucketMap[key]?.amount ?? 0) * 100) / 100,
    count:  bucketMap[key]?.count ?? 0,
  }));

  const total       = filled.reduce((s, d) => s + d.amount, 0);
  const prevTotal   = previous.reduce((s, r) => s + Math.max(0, parseFloat(r.total ?? "") || 0), 0);
  const delta       = total - prevTotal;
  const deltaPercent = prevTotal > 0 ? (delta / prevTotal) * 100 : null;
  const receiptCount = filled.reduce((s, d) => s + d.count, 0);
  const bestDay      = filled.reduce(
    (best, d) => (d.amount > best.amount ? d : best),
    { date: "", amount: 0, count: 0 }
  );
  const daysInPeriod = Math.max(1, windowMs / 86400000);
  const periodsInWindow = gran === "day" ? daysInPeriod : gran === "week" ? daysInPeriod / 7 : daysInPeriod / 30;

  return NextResponse.json({
    data: filled,
    total:         Math.round(total * 100) / 100,
    prevTotal:     Math.round(prevTotal * 100) / 100,
    delta:         Math.round(delta * 100) / 100,
    deltaPercent:  deltaPercent !== null ? Math.round(deltaPercent * 10) / 10 : null,
    avgPerPeriod:  Math.round((total / Math.max(1, periodsInWindow)) * 100) / 100,
    receiptCount,
    bestDay,
    gran,
    period,
  });
}
