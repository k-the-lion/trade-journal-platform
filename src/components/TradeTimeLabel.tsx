import {
  formatHoldDuration,
  formatTradeDate,
  formatTradeTime,
} from "@/lib/trades/datetime";
import type { Trade } from "@/lib/types/database";

export function TradeTimeLabel({
  trade,
}: {
  trade: Pick<Trade, "traded_at" | "entry_at">;
}) {
  const exitAt = trade.traded_at;
  const entryAt = trade.entry_at;
  const duration = entryAt ? formatHoldDuration(entryAt, exitAt) : null;

  return (
    <div className="text-xs mt-0.5 space-y-0.5">
      <p className="text-foreground/85 font-medium">{formatTradeDate(exitAt)}</p>
      {entryAt ? (
        <p className="text-muted tabular-nums">
          <span>{formatTradeTime(entryAt)}</span>
          <span className="opacity-60"> → </span>
          <span>{formatTradeTime(exitAt)}</span>
          {duration && <span className="opacity-60"> · {duration}</span>}
        </p>
      ) : (
        <p className="text-muted tabular-nums">{formatTradeTime(exitAt)}</p>
      )}
    </div>
  );
}
