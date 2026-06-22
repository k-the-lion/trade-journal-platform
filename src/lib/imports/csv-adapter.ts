import Papa from "papaparse";
import type { ImportAdapter, ImportAdapterResult, NormalizedTradeRow } from "./adapter";

export interface CsvColumnMapping {
  traded_at?: string;
  symbol?: string;
  direction?: string;
  entry_price?: string;
  exit_price?: string;
  quantity?: string;
  pnl?: string;
  r_multiple?: string;
  setup_tag?: string;
  notes?: string;
  external_id?: string;
}

const DEFAULT_MAPPING: CsvColumnMapping = {
  traded_at: "Date",
  symbol: "Symbol",
  direction: "Direction",
  entry_price: "Entry",
  exit_price: "Exit",
  quantity: "Quantity",
  pnl: "PnL",
  r_multiple: "R",
  setup_tag: "Setup",
  notes: "Notes",
  external_id: "ID",
};

function parseDirection(raw: string): "long" | "short" {
  const v = raw?.toLowerCase().trim();
  if (v === "short" || v === "s" || v === "sell") return "short";
  return "long";
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = parseFloat(String(raw).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parseCsvTrades(
  csvText: string,
  mapping: CsvColumnMapping = DEFAULT_MAPPING
): ImportAdapterResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];
  const rows: NormalizedTradeRow[] = [];
  let skipped = 0;

  if (parsed.errors.length) {
    errors.push(...parsed.errors.map((e) => `Row ${e.row}: ${e.message}`));
  }

  const m = { ...DEFAULT_MAPPING, ...mapping };

  parsed.data.forEach((row, index) => {
    const dateCol = m.traded_at && row[m.traded_at];
    const symbolCol = m.symbol && row[m.symbol];
    const pnlCol = m.pnl && row[m.pnl];

    if (!dateCol || !symbolCol || pnlCol === undefined) {
      skipped++;
      errors.push(`Row ${index + 2}: missing required date, symbol, or PnL`);
      return;
    }

    const traded_at = parseDate(dateCol);
    if (!traded_at) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid date "${dateCol}"`);
      return;
    }

    const pnl = parseNumber(pnlCol);
    if (pnl === null) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid PnL "${pnlCol}"`);
      return;
    }

    const directionRaw = m.direction ? row[m.direction] : "long";
    const qty = parseNumber(m.quantity ? row[m.quantity] : undefined) ?? 1;

    rows.push({
      traded_at,
      symbol: symbolCol.trim(),
      direction: parseDirection(directionRaw ?? "long"),
      entry_price: m.entry_price ? parseNumber(row[m.entry_price]) : null,
      exit_price: m.exit_price ? parseNumber(row[m.exit_price]) : null,
      quantity: qty,
      pnl,
      r_multiple: m.r_multiple ? parseNumber(row[m.r_multiple]) : null,
      setup_tag: m.setup_tag ? row[m.setup_tag]?.trim() || null : null,
      notes: m.notes ? row[m.notes]?.trim() || null : null,
      external_id: m.external_id ? row[m.external_id]?.trim() || null : null,
    });
  });

  return { rows, errors, skipped };
}

export const csvImportAdapter: ImportAdapter = {
  source: "csv",
  name: "CSV Import",
  supportedFields: Object.values(DEFAULT_MAPPING).filter(Boolean) as string[],
  parse(input, options) {
    const text = typeof input === "string" ? input : "";
    const mapping = (options?.mapping as CsvColumnMapping) ?? DEFAULT_MAPPING;
    return parseCsvTrades(text, mapping);
  },
};
