import Papa from "papaparse";

export function parseCsvRows(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
} {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  let headers = parsed.meta.fields?.map((h) => h.trim()) ?? [];
  let rows = parsed.data;

  // Skip broker metadata rows above the real header (common in prop firm exports)
  if (headers.length <= 2 || !hasTradeColumns(headers)) {
    const lines = csvText.split(/\r?\n/);
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const slice = lines.slice(i).join("\n");
      const retry = Papa.parse<Record<string, string>>(slice, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      const retryHeaders = retry.meta.fields?.map((h) => h.trim()) ?? [];
      if (hasTradeColumns(retryHeaders) && retry.data.length > 0) {
        headers = retryHeaders;
        rows = retry.data;
        break;
      }
    }
  }

  return {
    headers,
    rows,
    errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`),
  };
}

function hasTradeColumns(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  const hasSymbol = lower.some((h) =>
    ["symbol", "contract", "product", "instrument"].includes(h)
  );
  const hasPnl = lower.some((h) =>
    h.includes("p&l") || h.includes("pnl") || h.includes("profit") || h === "pl"
  );
  const hasTime = lower.some((h) =>
    ["time", "date", "fill time", "timestamp", "exit time", "entry time"].some((t) =>
      h.includes(t)
    )
  );
  return hasSymbol && (hasPnl || hasTime);
}

export function findColumn(
  headers: string[],
  aliases: string[]
): string | undefined {
  const trimmed = headers.map((h) => h.trim());
  for (const alias of aliases) {
    const exact = trimmed.find((h) => h.toLowerCase() === alias.toLowerCase());
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const partial = trimmed.find((h) =>
      h.toLowerCase().includes(alias.toLowerCase())
    );
    if (partial) return partial;
  }
  return undefined;
}

export function parseDirection(raw: string | undefined): "long" | "short" {
  const v = raw?.toLowerCase().trim() ?? "";
  if (["short", "s", "sell", "sold"].includes(v)) return "short";
  if (v === "b" || v === "buy" || v === "bot" || v === "bought") return "long";
  if (v.includes("sell")) return "short";
  if (v.includes("buy")) return "long";
  return "long";
}

export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const cleaned = String(raw)
    .replace(/[$,]/g, "")
    .replace(/\(([^)]+)\)/, "-$1")
    .trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  // Dot-separated dates: 06.18.2026
  const dotMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(.+))?$/);
  if (dotMatch) {
    const [, mm, dd, yyyy, time] = dotMatch;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}${time ? `T${time}` : "T12:00:00"}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().split(" ")[0].toUpperCase();
}

export function inferDirectionFromPrices(
  entry: number | null,
  exit: number | null,
  pnl: number
): "long" | "short" {
  if (entry === null || exit === null) return "long";
  if (pnl === 0) return entry <= exit ? "long" : "short";
  const priceUp = exit > entry;
  const won = pnl > 0;
  if (priceUp && won) return "long";
  if (!priceUp && won) return "short";
  if (priceUp && !won) return "short";
  return "long";
}
