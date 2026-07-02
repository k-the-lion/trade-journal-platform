import { findColumn, parseCsvRows } from "./csv-utils";
import { classifyTradingViewExport } from "./tradingview-adapter";

export type ImportPreset =
  | "auto"
  | "topstepx"
  | "tradovate_orders"
  | "tradingview_balance"
  | "tradingview_orders"
  | "tradingview_journal"
  | "generic";

export interface DetectedFormat {
  preset: ImportPreset;
  source: "csv" | "tradovate" | "other";
  label: string;
  confidence: "high" | "medium";
  unsupported?: boolean;
  unsupportedReason?: string;
}

function looksLikeTradingView(headers: string[]): boolean {
  const has = (aliases: string[]) => Boolean(findColumn(headers, aliases));
  return (
    (has(["Symbol"]) || has(["Ticker"]) || has(["Action"])) &&
    (has(["Side", "B/S", "Buy/Sell"]) ||
      has(["Trade #", "Trade#"]) ||
      has(["P&L", "PnL", "Net P&L", "Realized PnL (value)", "Realized PnL"]) ||
      has(["Text"]))
  );
}

export function detectImportFormat(csvText: string): DetectedFormat {
  const { headers, rows } = parseCsvRows(csvText);

  const has = (aliases: string[]) => Boolean(findColumn(headers, aliases));

  // TopStep X — Trades tab (Symbol, Time) or API export (ContractName, EnteredAt)
  if (
    (has(["Symbol"]) || has(["ContractName"])) &&
    (has(["Entry Price", "Entry"]) || has(["EntryPrice"])) &&
    (has(["Exit Price", "Exit"]) || has(["ExitPrice"])) &&
    has(["P&L", "PnL", "Net P&L", "Total P&L"]) &&
    (has(["Time", "ExitedAt", "EnteredAt", "Exit Time", "Entry Time"]))
  ) {
    return {
      preset: "topstepx",
      source: "csv",
      label: "TopStep X (Trades export)",
      confidence: "high",
    };
  }

  // Tradovate Position History — direct users to Orders export instead
  if (
    has(["Contract", "Product"]) &&
    has(["P&L", "PnL", "Realized P&L", "Net P&L"]) &&
    (has(["Entry Time", "Open Time", "Bought Timestamp"]) ||
      has(["Exit Time", "Sold Timestamp", "Close Time"]))
  ) {
    return {
      preset: "generic",
      source: "tradovate",
      label: "Tradovate (Position History)",
      confidence: "high",
      unsupported: true,
      unsupportedReason:
        "This looks like a Tradovate Position History export. Use the Orders report instead: Tradovate → Reports → Orders tab → Download CSV.",
    };
  }

  // Tradovate Orders / Fills export
  if (
    has(["orderId", "Order ID", "Order Id"]) &&
    has(["B/S", "Side", "Buy/Sell"]) &&
    has(["Contract", "Product"]) &&
    has(["Fill Time", "Timestamp", "Date"])
  ) {
    return {
      preset: "tradovate_orders",
      source: "tradovate",
      label: "Tradovate (Orders)",
      confidence: "medium",
    };
  }

  if (looksLikeTradingView(headers)) {
    const tv = classifyTradingViewExport(headers, rows);

    if (
      tv.kind === "positions" ||
      tv.kind === "working_orders" ||
      tv.kind === "activity_log"
    ) {
      const label =
        tv.kind === "positions"
          ? "TradingView (Positions — not for import)"
          : tv.kind === "activity_log"
            ? "TradingView (Trading journal — activity log)"
            : "TradingView (Orders tab — not for import)";
      return {
        preset: "generic",
        source: "csv",
        label,
        confidence: "high",
        unsupported: true,
        unsupportedReason: tv.message,
      };
    }

    if (tv.kind === "balance_ledger" || tv.kind === "balance_history") {
      return {
        preset: "tradingview_balance",
        source: "csv",
        label: "TradingView (Balance History)",
        confidence: "high",
      };
    }

    if (tv.kind === "trading_journal") {
      return {
        preset: "tradingview_journal",
        source: "csv",
        label: "TradingView (Trading journal)",
        confidence: "high",
      };
    }

    if (tv.kind === "order_history") {
      return {
        preset: "tradingview_orders",
        source: "csv",
        label: "TradingView (Order History)",
        confidence: "high",
      };
    }
  }

  // TradingView Balance History ledger (Paper Trading — Action column)
  if (
    has(["Action"]) &&
    has(["Realized PnL (value)", "Realized PnL", "Realized PNL"])
  ) {
    return {
      preset: "tradingview_balance",
      source: "csv",
      label: "TradingView (Balance History)",
      confidence: "high",
    };
  }

  // TradingView Balance History / round trips with Symbol + P&L columns
  if (
    (has(["Symbol"]) || has(["Ticker"])) &&
    has(["P&L", "PnL", "Net P&L", "Profit"]) &&
    !has(["ContractName"])
  ) {
    return {
      preset: "tradingview_balance",
      source: "csv",
      label: "TradingView (Balance History)",
      confidence: "high",
    };
  }

  // TradingView Trading journal (list of trades)
  if (has(["Trade #", "Trade#"]) && has(["Type"])) {
    return {
      preset: "tradingview_journal",
      source: "csv",
      label: "TradingView (Trading journal)",
      confidence: "medium",
    };
  }

  // TradingView Order History
  if (
    (has(["Symbol"]) || has(["Ticker"])) &&
    has(["Side", "B/S", "Buy/Sell"]) &&
    (has(["Order ID", "Order Id", "orderId"]) || has(["Status"]))
  ) {
    return {
      preset: "tradingview_orders",
      source: "csv",
      label: "TradingView (Order History)",
      confidence: "medium",
    };
  }

  // TradingView Trading journal activity log (Paper Trading tab)
  if (has(["Text"]) && has(["Time"]) && !has(["Symbol", "Ticker"])) {
    return {
      preset: "generic",
      source: "csv",
      label: "TradingView (Trading journal — activity log)",
      confidence: "high",
      unsupported: true,
      unsupportedReason:
        "TradingView Trading journal is an activity log, not trade data. Export Balance History (best) or Order History instead.",
    };
  }

  return {
    preset: "generic",
    source: "csv",
    label: "Generic CSV",
    confidence: "medium",
  };
}

export function presetToAdapterKey(preset: ImportPreset): string {
  switch (preset) {
    case "topstepx":
      return "topstepx";
    case "tradovate_orders":
      return "tradovate";
    case "tradingview_balance":
    case "tradingview_orders":
    case "tradingview_journal":
      return "tradingview";
    default:
      return "csv";
  }
}
