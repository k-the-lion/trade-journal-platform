import type { ImportAdapter, ImportAdapterResult, NormalizedTradeRow } from "./adapter";
import {
  findColumn,
  inferDirectionFromPrices,
  normalizeSymbol,
  parseCsvRows,
  parseDate,
  parseDirection,
  parseNumber,
} from "./csv-utils";

export function parseTopstepXTrades(csvText: string): ImportAdapterResult {
  const { headers, rows, errors } = parseCsvRows(csvText);
  const result: NormalizedTradeRow[] = [];
  let skipped = 0;

  const col = {
    time: findColumn(headers, ["Time", "Exit Time", "Entry Time", "Date/Time", "Date"]),
    symbol: findColumn(headers, ["Symbol", "Contract", "Product"]),
    size: findColumn(headers, ["Size", "Qty", "Quantity", "Contracts"]),
    entry: findColumn(headers, ["Entry Price", "Entry", "Avg Entry"]),
    exit: findColumn(headers, ["Exit Price", "Exit", "Avg Exit"]),
    pnl: findColumn(headers, ["P&L", "PnL", "Net P&L", "Total P&L", "Profit/Loss", "PL"]),
    fees: findColumn(headers, ["Fees", "Commission", "Commissions"]),
    direction: findColumn(headers, ["Direction", "Side", "B/S", "Buy/Sell"]),
    id: findColumn(headers, ["Trade ID", "Id", "ID", "Order ID", "Position ID"]),
    notes: findColumn(headers, ["Notes", "Comment", "Description"]),
  };

  if (!col.symbol || !col.pnl) {
    return {
      rows: [],
      errors: [
        ...errors,
        "TopStep X file must include Symbol and P&L columns. Export from the Trades tab (not account summary).",
      ],
      skipped: rows.length,
    };
  }

  rows.forEach((row, index) => {
    const symbolRaw = col.symbol ? row[col.symbol] : "";
    const pnlRaw = col.pnl ? row[col.pnl] : "";
    if (!symbolRaw?.trim() || pnlRaw === undefined || pnlRaw === "") {
      skipped++;
      return;
    }

    const grossPnl = parseNumber(pnlRaw);
    if (grossPnl === null) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid P&L "${pnlRaw}"`);
      return;
    }

    const fees = col.fees ? parseNumber(row[col.fees]) ?? 0 : 0;
    const netPnl = grossPnl - Math.abs(fees);

    const timeRaw = col.time ? row[col.time] : undefined;
    const traded_at = parseDate(timeRaw);
    if (!traded_at) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid or missing time`);
      return;
    }

    const entry = col.entry ? parseNumber(row[col.entry]) : null;
    const exit = col.exit ? parseNumber(row[col.exit]) : null;
    const quantity = col.size ? parseNumber(row[col.size]) ?? 1 : 1;

    const direction = col.direction
      ? parseDirection(row[col.direction])
      : inferDirectionFromPrices(entry, exit, netPnl);

    result.push({
      traded_at,
      symbol: normalizeSymbol(symbolRaw),
      direction,
      entry_price: entry,
      exit_price: exit,
      quantity: Math.abs(quantity),
      pnl: netPnl,
      setup_tag: "TopStep X",
      notes: col.notes ? row[col.notes]?.trim() || null : null,
      external_id: col.id ? row[col.id]?.trim() || null : null,
    });
  });

  return { rows: result, errors, skipped };
}

export const topstepxImportAdapter: ImportAdapter = {
  source: "other",
  name: "TopStep X CSV",
  supportedFields: ["Symbol", "Size", "Time", "Entry Price", "Exit Price", "P&L", "Fees"],
  parse(input) {
    const text = typeof input === "string" ? input : "";
    return parseTopstepXTrades(text);
  },
};
