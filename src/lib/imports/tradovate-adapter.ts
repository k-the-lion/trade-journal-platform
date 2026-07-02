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

type OrderFill = {
  time: string;
  symbol: string;
  direction: "long" | "short";
  price: number | null;
  qty: number;
  multiplier: number;
  id: string | null;
};

function isFilledStatus(raw: string | undefined): boolean {
  const status = raw?.toLowerCase().trim() ?? "";
  if (!status) return true;
  return (
    status.includes("fill") ||
    status === "complete" ||
    status === "completed" ||
    status === "executed"
  );
}

function getTradovateFillPrice(
  row: Record<string, string>,
  cols: {
    avgFill?: string;
    avgPrice?: string;
    decimalFill?: string;
  }
): number | null {
  for (const key of [cols.avgFill, cols.avgPrice, cols.decimalFill]) {
    if (!key) continue;
    const value = parseNumber(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function inferContractMultiplier(
  price: number | null,
  qty: number,
  notionalRaw: string | undefined
): number {
  const notional = parseNumber(notionalRaw);
  if (notional === null || price === null || price === 0 || qty <= 0) return 1;
  const derived = notional / (price * qty);
  if (derived > 0 && derived < 1_000_000) return derived;
  return 1;
}

function pairTradovateFills(filled: OrderFill[]): {
  rows: NormalizedTradeRow[];
  skipped: number;
} {
  const openBySymbol = new Map<string, OrderFill[]>();
  const rows: NormalizedTradeRow[] = [];
  let skipped = 0;

  const sorted = [...filled].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  for (const fill of sorted) {
    const stack = openBySymbol.get(fill.symbol) ?? [];
    const last = stack[stack.length - 1];

    if (last && last.direction !== fill.direction) {
      const entry = last.direction === "long" ? last : fill;
      const exit = last.direction === "long" ? fill : last;
      const entryPrice = entry.price;
      const exitPrice = exit.price;
      const qty = Math.min(entry.qty, exit.qty);
      const multiplier = entry.multiplier || exit.multiplier || 1;

      let pnl = 0;
      if (entryPrice !== null && exitPrice !== null) {
        const sign = entry.direction === "long" ? 1 : -1;
        pnl = (exitPrice - entryPrice) * sign * multiplier * qty;
      }

      const external_id =
        fill.id && last.id
          ? `tv-pair-${last.id}-${fill.id}`
          : `tv-pair-${entry.time}-${fill.symbol}-${exit.time}`;

      rows.push({
        traded_at: exit.time,
        entry_at: entry.time,
        symbol: fill.symbol,
        direction: entry.direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: qty,
        pnl: Math.round(pnl * 100) / 100,
        setup_tag: "Tradovate",
        notes: null,
        external_id,
      });
      stack.pop();
    } else {
      stack.push(fill);
    }

    openBySymbol.set(fill.symbol, stack);
  }

  for (const stack of openBySymbol.values()) {
    skipped += stack.length;
  }

  return { rows, skipped };
}

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
      "Fill Time",
      "Time",
      "Timestamp",
      "Date",
    ]),
    symbol: findColumn(headers, ["Contract", "Product", "Symbol", "Instrument"]),
    entry: findColumn(headers, [
      "Entry Price",
      "Avg Entry",
      "Open Price",
      "Bought Price",
      "Entry",
      "Avg Fill Price",
      "avgPrice",
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
    qty: findColumn(headers, ["filledQty", "Filled Qty", "Qty", "Quantity", "Size"]),
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
      notes: null,
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
  const col = {
    time: findColumn(headers, ["Fill Time", "Timestamp", "Date", "Time"]),
    symbol: findColumn(headers, ["Contract", "Product", "Symbol"]),
    side: findColumn(headers, ["B/S", "Side", "Buy/Sell"]),
    avgFill: findColumn(headers, ["Avg Fill Price", "Avg Price"]),
    avgPrice: findColumn(headers, ["avgPrice"]),
    decimalFill: findColumn(headers, ["decimalFillAvg"]),
    qty: findColumn(headers, ["filledQty", "Filled Qty", "Quantity", "Qty"]),
    notional: findColumn(headers, ["Notional Value", "Notional"]),
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

  const filled: OrderFill[] = [];
  let skipped = 0;

  rows.forEach((row) => {
    if (col.status && !isFilledStatus(row[col.status])) {
      skipped++;
      return;
    }

    const symbolRaw = row[col.symbol!];
    if (!symbolRaw?.trim()) {
      skipped++;
      return;
    }

    const price = getTradovateFillPrice(row, col);
    if (price === null) {
      skipped++;
      return;
    }

    const qtyRaw = col.qty ? parseNumber(row[col.qty]) : null;
    if (qtyRaw === null || qtyRaw <= 0) {
      skipped++;
      return;
    }

    const traded_at = parseDate(col.time ? row[col.time] : undefined);
    if (!traded_at) {
      skipped++;
      return;
    }

    const qty = Math.abs(qtyRaw);
    const notionalRaw = col.notional ? row[col.notional] : undefined;

    filled.push({
      time: traded_at,
      symbol: normalizeSymbol(symbolRaw),
      direction: parseDirection(col.side ? row[col.side] : undefined),
      price,
      qty,
      multiplier: inferContractMultiplier(price, qty, notionalRaw),
      id: col.id ? row[col.id]?.trim() || null : null,
    });
  });

  const { rows: paired, skipped: unpaired } = pairTradovateFills(filled);
  skipped += unpaired;

  if (paired.length === 0) {
    errors.push(
      "Could not pair Tradovate order fills into trades. Try Position History (Account → gear → Position History) for rows that already include P&L."
    );
  } else if (unpaired > 0) {
    errors.push(
      `${unpaired} open fill(s) had no matching exit and were skipped. Re-import Position History for the most accurate P&L.`
    );
  }

  return { rows: paired, errors, skipped };
}

export function parseTradovateCsv(
  csvText: string,
  mode: TradovateMode = "orders"
): ImportAdapterResult {
  const { headers, rows, errors } = parseCsvRows(csvText);

  if (mode === "position") {
    return parseTradovatePositionHistory(headers, rows, errors);
  }
  return parseTradovateOrders(headers, rows, errors);
}

export const tradovateImportAdapter: ImportAdapter = {
  source: "tradovate",
  name: "Tradovate (Orders CSV)",
  supportedFields: [
    "Contract",
    "Product",
    "B/S",
    "Avg Fill Price",
    "avgPrice",
    "filledQty",
    "Fill Time",
    "Notional Value",
    "orderId",
  ],
  parse(input, options) {
    const text = typeof input === "string" ? input : "";
    const mode = (options?.mode as TradovateMode) ?? "orders";
    return parseTradovateCsv(text, mode);
  },
};
