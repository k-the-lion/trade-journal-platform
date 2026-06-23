import { findColumn, parseCsvRows } from "./csv-utils";

export type ImportPreset =
  | "auto"
  | "topstepx"
  | "tradovate_position"
  | "tradovate_orders"
  | "tradingview_balance"
  | "tradingview_orders"
  | "generic";

export interface DetectedFormat {
  preset: ImportPreset;
  source: "csv" | "tradovate" | "other";
  label: string;
  confidence: "high" | "medium";
}

export function detectImportFormat(csvText: string): DetectedFormat {
  const { headers } = parseCsvRows(csvText);

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

  // Tradovate Position History — matched round trips
  if (
    has(["Contract", "Product"]) &&
    has(["P&L", "PnL", "Realized P&L", "Net P&L"]) &&
    (has(["Entry Time", "Open Time", "Bought Timestamp"]) ||
      has(["Exit Time", "Sold Timestamp", "Close Time"]))
  ) {
    return {
      preset: "tradovate_position",
      source: "tradovate",
      label: "Tradovate (Position History)",
      confidence: "high",
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
      label: "Tradovate (Orders / Fills)",
      confidence: "medium",
    };
  }

  // TradingView Balance History / Trading journal (round trips with P&L)
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
    case "tradovate_position":
    case "tradovate_orders":
      return "tradovate";
    case "tradingview_balance":
    case "tradingview_orders":
      return "tradingview";
    default:
      return "csv";
  }
}
