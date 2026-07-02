import type { ImportAdapter, ImportAdapterResult, NormalizedTradeRow } from "./adapter";
import {
  findColumn,
  findPnlColumn,
  inferDirectionFromPrices,
  normalizeSymbol,
  parseCsvRows,
  parseDate,
  parseDirection,
  parseNumber,
} from "./csv-utils";

export type TradingViewMode =
  | "auto"
  | "balance"
  | "orders"
  | "journal"
  | "list_of_trades";

export type TradingViewExportKind =
  | "balance_history"
  | "balance_ledger"
  | "order_history"
  | "trading_journal"
  | "activity_log"
  | "positions"
  | "working_orders"
  | "unknown";

const CLOSE_ACTION_RE =
  /Close (long|short) position for symbol (\S+) at price ([\d.]+) for (\d+) units\. Position AVG Price was ([\d.]+)/i;

const FILLED_STATUSES = new Set([
  "filled",
  "complete",
  "completed",
  "executed",
  "closed",
]);

const WORKING_STATUSES = new Set([
  "working",
  "inactive",
  "placing",
  "cancelled",
  "canceled",
  "rejected",
  "expired",
  "pending",
]);

export function classifyTradingViewExport(
  headers: string[],
  rows: Record<string, string>[]
): { kind: TradingViewExportKind; message?: string } {
  const has = (aliases: string[]) => Boolean(findColumn(headers, aliases));

  // Paper Trading Balance History — ledger rows with Action text (no Symbol column)
  if (
    has(["Action"]) &&
    has(["Realized PnL (value)", "Realized PnL", "Realized PNL"])
  ) {
    return { kind: "balance_ledger" };
  }

  // Paper Trading Trading journal tab — activity log, not structured trades
  if (has(["Text"]) && has(["Time"]) && !has(["Symbol", "Ticker"])) {
    return {
      kind: "activity_log",
      message:
        "TradingView Trading journal is an activity log, not trade data. Export Order History from the Paper Trading panel instead.",
    };
  }

  if (
    has(["Unrealized P&L", "Unrealized PnL", "Unrealized PL"]) ||
    (has(["Take Profit", "Stop Loss"]) && has(["Avg Fill Price", "Average Fill Price"]))
  ) {
    return {
      kind: "positions",
      message:
        "This looks like TradingView Positions (open positions). Export Balance History or Order History instead — completed trades with P&L.",
    };
  }

  if (
    has(["Trade #", "Trade#", "Trade Number"]) &&
    has(["Type"]) &&
    rows.some((row) => {
      const typeCol = findColumn(headers, ["Type"])!;
      const type = row[typeCol]?.toLowerCase() ?? "";
      return type.includes("entry") || type.includes("exit");
    })
  ) {
    return { kind: "trading_journal" };
  }

  const pnlCol = findPnlColumn(headers);
  const statusCol = findColumn(headers, ["Status"]);
  const closingCol = findColumn(headers, [
    "Closing Time",
    "Closing time",
    "Close Time",
    "Fill Time",
  ]);
  const symbolCol = findColumn(headers, ["Symbol", "Ticker"]);
  const sideCol = findColumn(headers, ["Side", "B/S", "Buy/Sell"]);
  const fillPriceCol = findColumn(headers, [
    "Fill price",
    "Fill Price",
    "Avg Fill Price",
  ]);

  if (symbolCol && sideCol && fillPriceCol && (statusCol || closingCol)) {
    const statusValues = statusCol
      ? rows
          .map((r) => r[statusCol]?.toLowerCase().trim() ?? "")
          .filter(Boolean)
      : [];
    const filledCount = statusValues.filter((s) => FILLED_STATUSES.has(s)).length;
    const workingCount = statusValues.filter((s) => WORKING_STATUSES.has(s)).length;
    const hasClosingTimes = closingCol
      ? rows.filter((r) => r[closingCol]?.trim()).length
      : 0;

    if (
      statusValues.length > 0 &&
      workingCount > filledCount &&
      hasClosingTimes < rows.length / 2
    ) {
      return {
        kind: "working_orders",
        message:
          "This looks like TradingView Orders (pending/working orders). Export Order History or Balance History for completed trades.",
      };
    }

    if (filledCount > 0 || hasClosingTimes >= Math.max(1, rows.length / 2)) {
      return { kind: "order_history" };
    }

    if (!pnlCol && !closingCol) {
      return {
        kind: "working_orders",
        message:
          "This CSV has no filled trades or P&L. Export Balance History (best) or Order History from TradingView.",
      };
    }
  }

  if (pnlCol && rows.some((r) => r[pnlCol]?.trim())) {
    return { kind: "balance_history" };
  }

  if (symbolCol && pnlCol) {
    return { kind: "balance_history" };
  }

  if (symbolCol && sideCol) {
    return { kind: "order_history" };
  }

  return { kind: "unknown" };
}

function unsupportedResult(
  message: string,
  errors: string[],
  skipped: number
): ImportAdapterResult {
  return {
    rows: [],
    errors: [...errors, message],
    skipped,
  };
}

function parseBalanceLedgerRows(
  headers: string[],
  rows: Record<string, string>[],
  errors: string[]
): ImportAdapterResult {
  const col = {
    time: findColumn(headers, ["Time", "Date", "Timestamp"]),
    pnl: findColumn(headers, [
      "Realized PnL (value)",
      "Realized PnL",
      "Realized PNL",
    ]),
    action: findColumn(headers, ["Action"]),
  };

  if (!col.time || !col.pnl || !col.action) {
    return {
      rows: [],
      errors: [
        ...errors,
        "TradingView Balance History export is missing Time, Realized PnL, or Action columns.",
      ],
      skipped: rows.length,
    };
  }

  const result: NormalizedTradeRow[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const action = row[col.action!]?.trim();
    if (!action) {
      skipped++;
      return;
    }

    const match = action.match(CLOSE_ACTION_RE);
    if (!match) {
      skipped++;
      return;
    }

    const [, dirWord, symbolRaw, exitRaw, qtyRaw, entryRaw] = match;
    const traded_at = parseDate(row[col.time!]);
    if (!traded_at) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid or missing time`);
      return;
    }

    const pnl = parseNumber(row[col.pnl!]);
    if (pnl === null) {
      skipped++;
      errors.push(`Row ${index + 2}: invalid P&L`);
      return;
    }

    const direction = dirWord.toLowerCase() === "short" ? "short" : "long";
    const exit_price = parseNumber(exitRaw);
    const entry_price = parseNumber(entryRaw);
    const quantity = parseNumber(qtyRaw) ?? 1;
    const symbol = normalizeSymbol(symbolRaw);

    result.push({
      traded_at,
      symbol,
      direction,
      entry_price,
      exit_price,
      quantity: Math.abs(quantity),
      pnl,
      setup_tag: "TradingView",
      notes: null,
      external_id: `tv-ledger-${traded_at.slice(0, 19)}-${symbol}-${pnl}-${quantity}`,
    });
  });

  if (result.length === 0) {
    errors.push(
      "No closed trades found in Balance History. Rows must contain “Close long/short position…” actions."
    );
  }

  return { rows: result, errors, skipped };
}

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
      "Date/Time",
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
    pnl: findPnlColumn(headers),
    qty: findColumn(headers, ["Qty", "Quantity", "Size", "Contracts"]),
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
        "TradingView Balance History needs Symbol and P&L columns. Use the Balance History tab export.",
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
      notes: null,
      external_id,
    });
  });

  return { rows: result, errors, skipped };
}

/** TradingView Trading journal / List of Trades (Entry + Exit rows) */
function parseListOfTrades(
  headers: string[],
  rows: Record<string, string>[],
  errors: string[]
): ImportAdapterResult {
  const col = {
    tradeNum: findColumn(headers, ["Trade #", "Trade#", "Trade Number"]),
    symbol: findColumn(headers, ["Symbol", "Ticker", "Instrument"]),
    type: findColumn(headers, ["Type"]),
    time: findColumn(headers, [
      "Date and time",
      "Date/Time",
      "Date/Time",
      "Time",
      "Date",
      "Closing Time",
    ]),
    price: findColumn(headers, ["Price", "Fill Price"]),
    qty: findColumn(headers, ["Qty", "Quantity", "Contracts", "Size"]),
    pnl: findPnlColumn(headers),
    id: findColumn(headers, ["Trade #", "Order ID"]),
  };

  if (!col.tradeNum || !col.type) {
    return {
      rows: [],
      errors: [
        ...errors,
        "Not a Trading journal export (missing Trade # / Type columns). Use Balance History instead.",
      ],
      skipped: rows.length,
    };
  }

  const byTrade = new Map<
    string,
    {
      entry?: Record<string, string>;
      exit?: Record<string, string>;
      symbol?: string;
    }
  >();

  for (const row of rows) {
    const num = row[col.tradeNum!]?.trim();
    const type = row[col.type!]?.toLowerCase() ?? "";
    if (!num) continue;

    const bucket = byTrade.get(num) ?? {};
    if (col.symbol) {
      const sym = row[col.symbol]?.trim();
      if (sym) bucket.symbol = sym;
    }
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
    const pnl = pnlRaw !== undefined && pnlRaw !== "" ? parseNumber(pnlRaw) : 0;
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
        : entryRow && col.qty && entryRow[col.qty]
          ? parseNumber(entryRow[col.qty]) ?? 1
          : 1;

    const symbolRaw =
      pair.symbol ||
      (col.symbol ? exitRow[col.symbol!] : undefined) ||
      (entryRow && col.symbol ? entryRow[col.symbol!] : undefined);

    result.push({
      traded_at,
      symbol: symbolRaw ? normalizeSymbol(symbolRaw) : "UNKNOWN",
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity: Math.abs(qty),
      pnl,
      setup_tag: "TradingView",
      notes: null,
      external_id: `tv-trade-${tradeNum}`,
    });
  });

  if (result.length === 0) {
    errors.push(
      "No completed trades found in Trading journal export. Balance History is the easiest import."
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
      "Closing time",
      "Close Time",
      "Time",
      "Date",
      "Timestamp",
      "Fill Time",
      "Placing time",
      "Placing Time",
    ]),
    symbol: findColumn(headers, ["Symbol", "Ticker", "Contract"]),
    side: findColumn(headers, ["Side", "B/S", "Buy/Sell", "Direction"]),
    price: findColumn(headers, [
      "Fill price",
      "Fill Price",
      "Avg Fill Price",
      "Price",
    ]),
    qty: findColumn(headers, ["Qty", "Quantity"]),
    pnl: findPnlColumn(headers),
    status: findColumn(headers, ["Status"]),
    id: findColumn(headers, [
      "Order ID",
      "Order Id",
      "orderId",
      "Id",
      "Level ID",
      "Level Id",
    ]),
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

  rows.forEach((row) => {
    if (col.status) {
      const status = row[col.status]?.toLowerCase().trim() ?? "";
      if (
        status &&
        !FILLED_STATUSES.has(status) &&
        !status.includes("fill")
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

  const openBySymbol = new Map<string, Array<(typeof filled)[0]>>();
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
        entry_at: entry.time,
        symbol: fill.symbol,
        direction: entry.direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: entry.qty,
        pnl,
        setup_tag: "TradingView",
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

  if (result.length === 0) {
    errors.push(
      "Could not pair Order History into trades. Export Balance History instead (each row includes P&L)."
    );
  }

  return { rows: result, errors, skipped };
}

function detectMode(headers: string[], rows: Record<string, string>[]): TradingViewMode {
  const classified = classifyTradingViewExport(headers, rows);

  switch (classified.kind) {
    case "balance_ledger":
    case "balance_history":
      return "balance";
    case "trading_journal":
      return "journal";
    case "order_history":
      return "orders";
    case "positions":
    case "working_orders":
    case "activity_log":
      return "auto";
    default:
      break;
  }

  if (
    findColumn(headers, ["Trade #", "Trade#"]) &&
    findColumn(headers, ["Type"])
  ) {
    return "journal";
  }

  if (
    findColumn(headers, ["P&L", "PnL", "Net P&L", "Profit"]) &&
    findColumn(headers, ["Symbol"])
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
  const classified = classifyTradingViewExport(headers, rows);

  if (
    mode === "auto" &&
    (classified.kind === "positions" ||
      classified.kind === "working_orders" ||
      classified.kind === "activity_log")
  ) {
    return unsupportedResult(classified.message!, errors, rows.length);
  }

  if (mode === "balance" && classified.kind === "working_orders") {
    return unsupportedResult(
      "Balance History preset selected but file looks like working Orders. Export the Balance History tab.",
      errors,
      rows.length
    );
  }

  if (mode === "orders" && classified.kind === "positions") {
    return unsupportedResult(
      "Order History preset selected but file looks like open Positions.",
      errors,
      rows.length
    );
  }

  const effective = mode === "auto" ? detectMode(headers, rows) : mode;

  if (
    effective === "balance" &&
    classified.kind === "balance_ledger"
  ) {
    return parseBalanceLedgerRows(headers, rows, errors);
  }

  switch (effective) {
    case "journal":
    case "list_of_trades":
      return parseListOfTrades(headers, rows, errors);
    case "orders":
      return parseOrderHistory(headers, rows, errors);
    default:
      if (classified.kind === "balance_ledger") {
        return parseBalanceLedgerRows(headers, rows, errors);
      }
      return parseBalanceOrJournalRows(headers, rows, errors);
  }
}

export const tradingviewImportAdapter: ImportAdapter = {
  source: "tradingview",
  name: "TradingView (Order History CSV)",
  supportedFields: [
    "Symbol",
    "Side",
    "Type",
    "Qty",
    "Quantity",
    "Price",
    "Fill Price",
    "Fill price",
    "P&L",
    "Net P&L",
    "Realized PnL (value)",
    "Commission",
    "Order ID",
    "Closing Time",
    "Closing time",
    "Time",
    "Action",
    "Status",
    "Trade #",
    "Date and time",
    "Date/Time",
  ],
  parse(input, options) {
    const text = typeof input === "string" ? input : "";
    const mode = (options?.mode as TradingViewMode) ?? "orders";
    return parseTradingViewCsv(text, mode);
  },
};
