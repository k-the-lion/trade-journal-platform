import type { NormalizedTradeRow } from "@/lib/imports/adapter";
import type { TopstepXTrade } from "./types";
import { pickContractSymbol } from "./symbol";

function directionFromExitSide(side: number): "long" | "short" {
  // Closing sell (1) closes a long; closing buy (0) closes a short.
  if (side === 1) return "long";
  if (side === 0) return "short";
  return "long";
}

function isHalfTurn(trade: TopstepXTrade): boolean {
  return trade.profitAndLoss === null || trade.profitAndLoss === undefined;
}

type OpenFill = {
  trade: TopstepXTrade;
  symbol: string;
};

function roundTripFromExit(
  exit: TopstepXTrade,
  symbol: string,
  entry: OpenFill | undefined
): NormalizedTradeRow {
  const fees = Number(exit.fees) || 0;
  const gross = Number(exit.profitAndLoss);
  const netPnl = Math.round((gross - fees) * 100) / 100;

  return {
    traded_at: new Date(exit.creationTimestamp).toISOString(),
    entry_at: entry
      ? new Date(entry.trade.creationTimestamp).toISOString()
      : null,
    symbol: symbol.toUpperCase(),
    direction: directionFromExitSide(exit.side),
    entry_price: entry ? Number(entry.trade.price) : null,
    exit_price: Number(exit.price),
    quantity: Math.abs(Number(exit.size)) || 1,
    pnl: netPnl,
    import_notes: fees > 0 ? `Fees: $${fees.toFixed(2)}` : null,
    external_id: `topstepx-${exit.id}`,
  };
}

export function normalizeTopstepXTrades(
  trades: TopstepXTrade[],
  contractSymbols: Map<string, string>
): NormalizedTradeRow[] {
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.creationTimestamp).getTime() -
      new Date(b.creationTimestamp).getTime()
  );

  const openByContract = new Map<string, OpenFill[]>();
  const rows: NormalizedTradeRow[] = [];

  for (const trade of sorted) {
    const symbol =
      contractSymbols.get(trade.contractId) ??
      pickContractSymbol(trade.contractId);

    if (isHalfTurn(trade)) {
      const stack = openByContract.get(trade.contractId) ?? [];
      stack.push({ trade, symbol });
      openByContract.set(trade.contractId, stack);
      continue;
    }

    const stack = openByContract.get(trade.contractId) ?? [];
    const entry = stack.shift();
    openByContract.set(trade.contractId, stack);

    rows.push(roundTripFromExit(trade, symbol, entry));
  }

  return rows.sort(
    (a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime()
  );
}
