import Papa from "papaparse";
import type { ImportAdapter, ImportAdapterResult, NormalizedTradeRow } from "./adapter";
import {
  findColumn,
  parseCsvRows,
  parseDate,
  parseDirection,
  parseNumber,
} from "./csv-utils";

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

export const DEFAULT_MAPPING: CsvColumnMapping = {
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

export function buildMappingFromHeaders(
  headers: string[],
  base: CsvColumnMapping = DEFAULT_MAPPING
): CsvColumnMapping {
  const auto: CsvColumnMapping = { ...base };
  const fields = Object.keys(base) as (keyof CsvColumnMapping)[];

  const aliases: Record<keyof CsvColumnMapping, string[]> = {
    traded_at: ["Fill Time", "Timestamp", "Exit Time", "Date", "Time"],
    symbol: ["Symbol", "Contract", "Product", "Instrument"],
    direction: ["Direction", "B/S", "Side", "Buy/Sell"],
    entry_price: [
      "Avg Fill Price",
      "avgPrice",
      "decimalFillAvg",
      "Entry Price",
      "Avg Entry",
      "Open Price",
      "Entry",
    ],
    exit_price: ["Exit Price", "Avg Exit", "Close Price", "Exit"],
    quantity: ["filledQty", "Filled Qty", "Quantity", "Qty", "Size"],
    pnl: ["PnL", "P&L", "Net P&L", "Realized P&L", "Profit/Loss"],
    r_multiple: ["R", "R-Multiple", "R Multiple"],
    setup_tag: ["Setup", "Strategy", "Tag", "Type", "Text"],
    notes: ["Notes", "Comment", "Description", "Product Description"],
    external_id: ["orderId", "Order ID", "Order Id", "ID", "Id", "Trade ID"],
  };

  for (const field of fields) {
    const match = findColumn(headers, aliases[field] ?? []);
    if (match) auto[field] = match;
  }

  return auto;
}

export function parseCsvTrades(
  csvText: string,
  mapping: CsvColumnMapping = DEFAULT_MAPPING
): ImportAdapterResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = parsed.errors.map((e) => `Row ${e.row}: ${e.message}`);
  const rows: NormalizedTradeRow[] = [];
  let skipped = 0;
  const m = { ...DEFAULT_MAPPING, ...mapping };

  parsed.data.forEach((row, index) => {
    const dateCol = m.traded_at && row[m.traded_at];
    const symbolCol = m.symbol && row[m.symbol];
    const pnlCol = m.pnl && row[m.pnl];

    if (!dateCol || !symbolCol || pnlCol === undefined || pnlCol === "") {
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
      symbol: symbolCol.trim().toUpperCase(),
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
  name: "Generic CSV",
  supportedFields: Object.values(DEFAULT_MAPPING).filter(Boolean) as string[],
  parse(input, options) {
    const text = typeof input === "string" ? input : "";
    const mapping = (options?.mapping as CsvColumnMapping) ?? DEFAULT_MAPPING;
    return parseCsvTrades(text, mapping);
  },
};
