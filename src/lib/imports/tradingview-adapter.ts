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

export type TradingViewMode = "auto" | "balance" | "orders" | "list_of_trades";

function parseBalanceOrJournalRows(
  headers: string[],
  rows: Record<string, string>[],
  errors: string[]
): ImportAdapterResult {
  const result: NormalizedTradeRow[] = [];
  let skipped = 0;

  const col = {
    time: findColumn(headers, [
      "Closing Time",
      "Close Time",
      "Exit Time",
      "Time",
      "Date and time",
      "Date",
      "Timestamp",
    ]),
    symbol: findColumn(headers, ["Symbol", "Ticker", "Instrument", "Contract"]),
    side: findColumn(headers, ["Side", "Direction", "B/S", "Buy/Sell"]),
    entry: findColumn(headers, [
      "Entry Price",
      "Avg Entry",
      "Open Price",
      "Entry",
      "Price",
    ]),
    exit: findColumn(headers, [
      "Exit Price",
      "Fill Price",
      "Close Price",
      "Avg Exit",
      "Exit",
    ]),
    pnl: findColumn(headers, [
      "Net P&L",
      "P&L",
      "PnL",
      "Profit",
      "PL",
      "Realized P&L",
    ]),
    qty: findColumn(headers, ["Qty", "Quantity", "Size", "Contracts"]),
    commission: findColumn(headers, ["Commission", "Commissions", "Fee", "Fees"]),
    id: findColumn(headers, [
      "Order ID",
      "Order Id",
      "orderId",
      "Trade #",
      "Trade ID",
      "Id",
      "ID",
    ]),
  };

  if (!col.symbol || !col.pnl) {
    return {
      rows: [],
      errors: [
        ...errors,
        "TradingView export needs Symbol and P&L columns. Use Balance History (recommended) or enable all columns before export.",
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
      errors.push(`Row ${index + 2}: invalid P&L "${pnlRaw}"`);
      return;
    }

    const traded_at = parseDate(col.time ? row[col.time] : undefined);
    if (!traded_at) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid or missing time`);
      return;
    }

    const entry = col.entry ? parseNumber(row[col.entry]) : null;
    const exit = col.exit ? parseNumber(row[col.exit]) : null;
    const qty = col.qty ? parseNumber(row[col.qty]) ?? 1 : 1;
    const direction = col.side
      ? parseDirection(row[col.side])
      : inferDirectionFromPrices(entry, exit, pnl);

    const orderId = col.id ? row[col.id]?.trim() : null;
    const external_id =
      orderId ||
      `tv-${traded_at.slice(0, 19)}-${normalizeSymbol(symbolRaw)}-${pnl}`;

    result.push({
      traded_at,
      symbol: normalizeSymbol(symbolRaw),
      direction,
      entry_price: entry,
      exit_price: exit,
      quantity: Math.abs(qty),
      pnl,
      setup_tag: "TradingView",
      notes: "Imported from TradingView",
      external_id,
    });
  });

  return { rows: result, errors, skipped };
}

/** TradingView "List of Trades" / paired Entry+Exit rows */
function parseListOfTrades(
  headers: string[],
  rows: Record<string, string>[],
  errors: string[]
): ImportAdapterResult {
  const col = {
    tradeNum: findColumn(headers, ["Trade #", "Trade#", "Trade Number"]),
    type: findColumn(headers, ["Type"]),
    time: findColumn(headers, ["Date and time", "Date/Time", "Time", "Date"]),
    price: findColumn(headers, ["Price", "Fill Price"]),
    qty: findColumn(headers, ["Qty", "Quantity"]),
    pnl: findColumn(headers, ["Net P&L", "P&L", "PnL"]),
    id: findColumn(headers, ["Trade #", "Order ID"]),
  };

  if (!col.tradeNum || !col.type) {
    return {
      rows: [],
      errors: [...errors, "Not a List of Trades format (missing Trade # / Type columns)."],
      skipped: rows.length,
    };
  }

  const byTrade = new Map<
    string,
    { entry?: Record<string, string>; exit?: Record<string, string> }
  >();

  for (const row of rows) {
    const num = row[col.tradeNum!]?.trim();
    const type = row[col.type!]?.toLowerCase() ?? "";
    if (!num) continue;

    const bucket = byTrade.get(num) ?? {};
    if (type.includes("entry")) bucket.entry = row;
    else if (type.includes("exit")) bucket.exit = row;
    byTrade.set(num, bucket);
  }

  const result: NormalizedTradeRow[] = [];
  let skipped = 0;

  byTrade.forEach((pair, tradeNum) => {
    const exitRow = pair.exit;
    const entryRow = pair.entry;
    if (!exitRow) {
      skipped++;
      return;
    }

    const pnlRaw = col.pnl ? exitRow[col.pnl] : undefined;
    const pnl = pnlRaw ? parseNumber(pnlRaw) : 0;
    if (pnl === null) {
      skipped++;
      return;
    }

    const timeRaw = col.time ? exitRow[col.time] : undefined;
    const traded_at = parseDate(timeRaw);
    if (!traded_at) {
      skipped++;
      return;
    }

    const type = col.type ? exitRow[col.type]?.toLowerCase() ?? "" : "";
    const direction = type.includes("short") ? "short" : "long";
    const entryPrice =
      entryRow && col.price ? parseNumber(entryRow[col.price]) : null;
    const exitPrice = col.price ? parseNumber(exitRow[col.price]) : null;
    const qty =
      col.qty && exitRow[col.qty]
        ? parseNumber(exitRow[col.qty]) ?? 1
        : 1;

    result.push({
      traded_at,
      symbol: "UNKNOWN",
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity: Math.abs(qty),
      pnl,
      setup_tag: "TradingView",
      notes: "Imported from TradingView List of Trades",
      external_id: `tv-trade-${tradeNum}`,
    });
  });

  if (result.length === 0) {
    errors.push(
      "No completed trades found in List of Trades format. Use Balance History export instead."
    );
  }

  return { rows: result, errors, skipped };
}

function parseOrderHistory(
  headers: string[],
  rows: Record<string, string>[],
  errors: string[]
): ImportAdapterResult {
  const col = {
    time: findColumn(headers, [
      "Closing Time",
      "Close Time",
      "Time",
      "Date",
      "Timestamp",
      "Fill Time",
    ]),
    symbol: findColumn(headers, ["Symbol", "Ticker", "Contract"]),
    side: findColumn(headers, ["Side", "B/S", "Buy/Sell", "Direction"]),
    price: findColumn(headers, ["Fill Price", "Avg Fill Price", "Price"]),
    qty: findColumn(headers, ["Qty", "Quantity"]),
    pnl: findColumn(headers, ["P&L", "PnL", "Profit", "Net P&L", "PL"]),
    status: findColumn(headers, ["Status"]),
    id: findColumn(headers, ["Order ID", "Order Id", "orderId", "Id"]),
    commission: findColumn(headers, ["Commission", "Fee"]),
  };

  if (!col.symbol || !col.side) {
    return {
      rows: [],
      errors: [
        ...errors,
        "TradingView Order History must include Symbol and Side. Enable all columns (⋯ menu) before exporting.",
      ],
      skipped: rows.length,
    };
  }

  // If P&L column exists on rows, treat like balance
  if (col.pnl && rows.some((r) => r[col.pnl!]?.trim())) {
    return parseBalanceOrJournalRows(headers, rows, errors);
  }

  const filled: Array<{
    time: string;
    symbol: string;
    direction: "long" | "short";
    price: number | null;
    qty: number;
    id: string | null;
  }> = [];

  rows.forEach((row, index) => {
    if (col.status) {
      const status = row[col.status]?.toLowerCase() ?? "";
      if (
        status &&
        !status.includes("fill") &&
        status !== "filled" &&
        status !== "complete" &&
        status !== "executed"
      ) {
        return;
      }
    }

    const symbolRaw = row[col.symbol!];
    if (!symbolRaw?.trim()) return;

    const traded_at = parseDate(col.time ? row[col.time] : undefined);
    if (!traded_at) return;

    filled.push({
      time: traded_at,
      symbol: normalizeSymbol(symbolRaw),
      direction: parseDirection(row[col.side!]),
      price: col.price ? parseNumber(row[col.price]) : null,
      qty: col.qty ? parseNumber(row[col.qty]) ?? 1 : 1,
      id: col.id ? row[col.id]?.trim() || null : null,
    });
  });

  filled.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  const openBySymbol = new Map<
    string,
    Array<(typeof filled)[0]>
  >();
  const result: NormalizedTradeRow[] = [];
  let skipped = 0;

  for (const fill of filled) {
    const stack = openBySymbol.get(fill.symbol) ?? [];
    const last = stack[stack.length - 1];

    if (last && last.direction !== fill.direction) {
      const entry = last.direction === "long" ? last : fill;
      const exit = last.direction === "long" ? fill : last;
      const entryPrice = entry.price;
      const exitPrice = exit.price;
      let pnl = 0;
      if (entryPrice !== null && exitPrice !== null) {
        const mult = entry.direction === "long" ? 1 : -1;
        pnl = (exitPrice - entryPrice) * mult * entry.qty;
      }

      const external_id =
        fill.id && last.id
          ? `tv-pair-${last.id}-${fill.id}`
          : `tv-pair-${entry.time}-${fill.symbol}-${exit.time}`;

      result.push({
        traded_at: exit.time,
        symbol: fill.symbol,
        direction: entry.direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: entry.qty,
        pnl,
        setup_tag: "TradingView",
        notes: "Paired from TradingView Order History fills",
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

  if (result.length === 0) {
    errors.push(
      "Could not pair Order History into trades. Try exporting Balance History instead (pre-matched P&L)."
    );
  }

  return { rows: result, errors, skipped };
}

function detectMode(headers: string[]): TradingViewMode {
  if (
    findColumn(headers, ["Trade #", "Trade#"]) &&
    findColumn(headers, ["Type"]) &&
    findColumn(headers, ["Net P&L", "P&L", "PnL"])
  ) {
    return "list_of_trades";
  }

  if (
    findColumn(headers, ["P&L", "PnL", "Net P&L", "Profit"]) &&
    (findColumn(headers, ["Closing Time", "Exit Time", "Close Time"]) ||
      findColumn(headers, ["Symbol"]))
  ) {
    return "balance";
  }

  if (
    findColumn(headers, ["Order ID", "Order Id", "orderId"]) &&
    findColumn(headers, ["Side", "B/S"])
  ) {
    return "orders";
  }

  return "balance";
}

export function parseTradingViewCsv(
  csvText: string,
  mode: TradingViewMode = "auto"
): ImportAdapterResult {
  const { headers, rows, errors } = parseCsvRows(csvText);
  const effective = mode === "auto" ? detectMode(headers) : mode;

  switch (effective) {
    case "list_of_trades":
      return parseListOfTrades(headers, rows, errors);
    case "orders":
      return parseOrderHistory(headers, rows, errors);
    default:
      return parseBalanceOrJournalRows(headers, rows, errors);
  }
}

export const tradingviewImportAdapter: ImportAdapter = {
  source: "tradingview",
  name: "TradingView CSV",
  supportedFields: [
    "Symbol",
    "Side",
    "Qty",
    "Price",
    "Fill Price",
    "P&L",
    "Net P&L",
    "Commission",
    "Order ID",
    "Closing Time",
    "Time",
    "Status",
    "Trade #",
    "Type",
  ],
  parse(input, options) {
    const text = typeof input === "string" ? input : "";
    const mode = (options?.mode as TradingViewMode) ?? "auto";
    return parseTradingViewCsv(text, mode);
  },
};
