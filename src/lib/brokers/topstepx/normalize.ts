import type { NormalizedTradeRow } from "@/lib/imports/adapter";
import type { TopstepXTrade } from "./types";
import { pickContractSymbol } from "./symbol";

function directionFromSide(side: number): "long" | "short" {
  // Closing sell (1) closes a long; closing buy (0) closes a short.
  if (side === 1) return "long";
  if (side === 0) return "short";
  return "long";
}

export function normalizeTopstepXTrade(
  trade: TopstepXTrade,
  symbol: string
): NormalizedTradeRow | null {
  if (trade.profitAndLoss === null || trade.profitAndLoss === undefined) {
    return null;
  }

  const fees = Number(trade.fees) || 0;
  const gross = Number(trade.profitAndLoss);
  const netPnl = Math.round((gross - fees) * 100) / 100;

  return {
    traded_at: new Date(trade.creationTimestamp).toISOString(),
    symbol: symbol.toUpperCase(),
    direction: directionFromSide(trade.side),
    entry_price: null,
    exit_price: Number(trade.price),
    quantity: Math.abs(Number(trade.size)) || 1,
    pnl: netPnl,
    import_notes: fees > 0 ? `Fees: $${fees.toFixed(2)}` : null,
    external_id: `topstepx-${trade.id}`,
  };
}

export function normalizeTopstepXTrades(
  trades: TopstepXTrade[],
  contractSymbols: Map<string, string>
): NormalizedTradeRow[] {
  const rows: NormalizedTradeRow[] = [];

  for (const trade of trades) {
    const symbol =
      contractSymbols.get(trade.contractId) ??
      pickContractSymbol(trade.contractId);
    const row = normalizeTopstepXTrade(trade, symbol);
    if (row) rows.push(row);
  }

  return rows.sort(
    (a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime()
  );
}
