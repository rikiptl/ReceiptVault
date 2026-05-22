const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
};

export function formatCurrency(amount: string | null | undefined, currency = "USD"): string {
  if (!amount) return "—";
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  return `${symbol}${num.toFixed(2)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Split `text` into alternating plain/matched segments for highlighting.
 * Returns an array of { text, match: boolean }.
 */
export function splitHighlight(
  text: string,
  query: string
): { text: string; match: boolean }[] {
  if (!query.trim() || !text) return [{ text, match: false }];
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts
      .filter((p) => p.length > 0)
      .map((p) => ({
        text: p,
        match: p.toLowerCase() === query.toLowerCase(),
      }));
  } catch {
    return [{ text, match: false }];
  }
}
