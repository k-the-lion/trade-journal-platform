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
    time: findColumn(headers, [
      "Time",
      "ExitedAt",
      "Exit Time",
      "EnteredAt",
      "Entry Time",
      "Date/Time",
      "Date",
    ]),
    symbol: findColumn(headers, [
      "Symbol",
      "ContractName",
      "Contract",
      "Product",
      "Instrument",
    ]),
    size: findColumn(headers, ["Size", "Qty", "Quantity", "Contracts"]),
    entry: findColumn(headers, [
      "Entry Price",
      "EntryPrice",
      "Entry",
      "Avg Entry",
    ]),
    exit: findColumn(headers, [
      "Exit Price",
      "ExitPrice",
      "Exit",
      "Avg Exit",
    ]),
    pnl: findColumn(headers, [
      "P&L",
      "PnL",
      "Net P&L",
      "Total P&L",
      "Profit/Loss",
      "PL",
    ]),
    fees: findColumn(headers, ["Fees", "Commission", "Commissions"]),
    direction: findColumn(headers, [
      "Direction",
      "Type",
      "Side",
      "B/S",
      "Buy/Sell",
    ]),
    id: findColumn(headers, [
      "Id",
      "ID",
      "Trade ID",
      "Order ID",
      "Position ID",
    ]),
    notes: findColumn(headers, ["Notes", "Comment", "Description", "TradeDuration"]),
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

    // TopStep X PnL column is already net of fees in current exports
    const netPnl = grossPnl;

    const timeRaw = col.time ? row[col.time] : undefined;
    // Prefer exit time when both EnteredAt and ExitedAt exist — use ExitedAt column first in findColumn order
    const exitedAtCol = findColumn(headers, ["ExitedAt", "Exit Time"]);
    const traded_at = parseDate(
      exitedAtCol ? row[exitedAtCol] : timeRaw
    );
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
  supportedFields: [
    "Symbol",
    "ContractName",
    "Size",
    "Time",
    "EnteredAt",
    "ExitedAt",
    "Entry Price",
    "EntryPrice",
    "Exit Price",
    "ExitPrice",
    "P&L",
    "Fees",
    "Type",
    "Id",
  ],
  parse(input) {
    const text = typeof input === "string" ? input : "";
    return parseTopstepXTrades(text);
  },
};
