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

type TradovateMode = "position" | "orders" | "auto";

function parseTradovatePositionHistory(
  headers: string[],
  rows: Record<string, string>[],
  errors: string[]
): ImportAdapterResult {
  const result: NormalizedTradeRow[] = [];
  let skipped = 0;

  const col = {
    time: findColumn(headers, [
      "Exit Time",
      "Close Time",
      "Sold Timestamp",
      "Time",
      "Timestamp",
      "Date",
      "Fill Time",
    ]),
    symbol: findColumn(headers, ["Contract", "Product", "Symbol", "Instrument"]),
    entry: findColumn(headers, [
      "Entry Price",
      "Avg Entry",
      "Open Price",
      "Bought Price",
      "Entry",
    ]),
    exit: findColumn(headers, [
      "Exit Price",
      "Avg Exit",
      "Close Price",
      "Sold Price",
      "Exit",
    ]),
    pnl: findColumn(headers, [
      "P&L",
      "PnL",
      "Realized P&L",
      "Net P&L",
      "Profit/Loss",
      "PL",
    ]),
    qty: findColumn(headers, ["Qty", "Quantity", "Size", "filledQty", "Filled Qty"]),
    direction: findColumn(headers, ["B/S", "Side", "Buy/Sell", "Direction"]),
    id: findColumn(headers, ["Position ID", "Trade ID", "Id", "orderId", "Order ID"]),
  };

  if (!col.symbol || !col.pnl) {
    return {
      rows: [],
      errors: [
        ...errors,
        "Tradovate Position History must include Contract/Product and P&L. Export from Account → Position History (not Performance).",
      ],
      skipped: rows.length,
    };
  }

  rows.forEach((row, index) => {
    const symbolRaw = row[col.symbol!];
    const pnlRaw = row[col.pnl!];
    if (!symbolRaw?.trim() || pnlRaw === undefined || pnlRaw === "") {
      skipped++;
      return;
    }

    const pnl = parseNumber(pnlRaw);
    if (pnl === null) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid P&L`);
      return;
    }

    const timeRaw = col.time ? row[col.time] : undefined;
    const dateCol = findColumn(headers, ["Date"]);
    const traded_at = parseDate(
      timeRaw && dateCol && !timeRaw.includes("/") && !timeRaw.includes("-")
        ? `${row[dateCol]} ${timeRaw}`
        : timeRaw
    );
    if (!traded_at) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid date/time`);
      return;
    }

    const entry = col.entry ? parseNumber(row[col.entry]) : null;
    const exit = col.exit ? parseNumber(row[col.exit]) : null;
    const quantity = col.qty ? parseNumber(row[col.qty]) ?? 1 : 1;
    const direction = col.direction
      ? parseDirection(row[col.direction])
      : inferDirectionFromPrices(entry, exit, pnl);

    result.push({
      traded_at,
      symbol: normalizeSymbol(symbolRaw),
      direction,
      entry_price: entry,
      exit_price: exit,
      quantity: Math.abs(quantity),
      pnl,
      setup_tag: "Tradovate",
      notes: "Imported from Tradovate Position History (gross P&L — fees may not be included)",
      external_id: col.id ? row[col.id]?.trim() || null : null,
    });
  });

  return { rows: result, errors, skipped };
}

function parseTradovateOrders(
  headers: string[],
  rows: Record<string, string>[],
  errors: string[]
): ImportAdapterResult {
  const result: NormalizedTradeRow[] = [];
  let skipped = 0;

  const col = {
    time: findColumn(headers, ["Fill Time", "Timestamp", "Date", "Time"]),
    symbol: findColumn(headers, ["Contract", "Product", "Symbol"]),
    side: findColumn(headers, ["B/S", "Side", "Buy/Sell"]),
    price: findColumn(headers, ["avgPrice", "Avg Fill Price", "Avg Price", "Price"]),
    qty: findColumn(headers, ["filledQty", "Filled Qty", "Quantity", "Qty"]),
    id: findColumn(headers, ["orderId", "Order ID", "Order Id"]),
    status: findColumn(headers, ["Status"]),
  };

  if (!col.symbol || !col.side) {
    return {
      rows: [],
      errors: [
        ...errors,
        "Tradovate Orders export missing required columns. For round-trip trades, use Position History instead.",
      ],
      skipped: rows.length,
    };
  }

  rows.forEach((row, index) => {
    if (col.status) {
      const status = row[col.status]?.toLowerCase() ?? "";
      if (status && !status.includes("fill") && status !== "filled" && status !== "complete") {
        skipped++;
        return;
      }
    }

    const symbolRaw = row[col.symbol!];
    if (!symbolRaw?.trim()) {
      skipped++;
      return;
    }

    const price = col.price ? parseNumber(row[col.price]) : null;
    const qty = col.qty ? parseNumber(row[col.qty]) ?? 1 : 1;
    const traded_at = parseDate(col.time ? row[col.time] : undefined);
    if (!traded_at) {
      skipped++;
      return;
    }

    const direction = parseDirection(col.side ? row[col.side] : undefined);
    const external_id = col.id ? row[col.id]?.trim() : null;

    result.push({
      traded_at,
      symbol: normalizeSymbol(symbolRaw),
      direction,
      entry_price: price,
      exit_price: null,
      quantity: Math.abs(qty),
      pnl: 0,
      setup_tag: "Tradovate Order",
      notes:
        "Single order/fill from Tradovate Orders export — P&L is 0. Use Position History for matched trades with P&L.",
      external_id: external_id ? `order-${external_id}` : null,
    });
  });

  if (result.length > 0 && result.every((r) => r.pnl === 0)) {
    errors.push(
      "Imported order fills without P&L. For accurate stats, re-export from Tradovate → Account → Position History."
    );
  }

  return { rows: result, errors, skipped };
}

export function parseTradovateCsv(
  csvText: string,
  mode: TradovateMode = "auto"
): ImportAdapterResult {
  const { headers, rows, errors } = parseCsvRows(csvText);

  const looksLikePosition =
    Boolean(findColumn(headers, ["P&L", "PnL", "Realized P&L"])) &&
    Boolean(
      findColumn(headers, ["Exit Price", "Close Price", "Exit Time", "Sold Timestamp"])
    );

  const effectiveMode =
    mode === "auto" ? (looksLikePosition ? "position" : "orders") : mode;

  if (effectiveMode === "position") {
    return parseTradovatePositionHistory(headers, rows, errors);
  }
  return parseTradovateOrders(headers, rows, errors);
}

export const tradovateImportAdapter: ImportAdapter = {
  source: "tradovate",
  name: "Tradovate CSV",
  supportedFields: [
    "Contract",
    "Product",
    "B/S",
    "Entry Price",
    "Exit Price",
    "P&L",
    "Fill Time",
    "orderId",
  ],
  parse(input, options) {
    const text = typeof input === "string" ? input : "";
    const mode = (options?.mode as TradovateMode) ?? "auto";
    return parseTradovateCsv(text, mode);
  },
};
