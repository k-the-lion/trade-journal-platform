import {
  formatHoldDuration,
  formatTradeDate,
  formatTradeTimeWithSeconds,
  formatTradeTimestampDetail,
} from "@/lib/trades/datetime";
import type { Trade } from "@/lib/types/database";

export function TradeTimingDetails({
  trade,
  variant = "compact",
}: {
  trade: Pick<Trade, "traded_at" | "entry_at">;
  variant?: "compact" | "detail";
}) {
  const exitAt = trade.traded_at;
  const entryAt = trade.entry_at;
  const duration = entryAt ? formatHoldDuration(entryAt, exitAt) : null;

  if (variant === "detail") {
    return (
      <div className="rounded-lg border border-border/60 p-4 bg-background/40 space-y-2">
        <p className="text-xs font-medium text-muted">Trade timing</p>
        {entryAt ? (
          <>
            <div>
              <p className="text-xs text-muted mb-0.5">Entry</p>
              <p className="text-sm tabular-nums">{formatTradeTimestampDetail(entryAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-0.5">Exit</p>
              <p className="text-sm tabular-nums">{formatTradeTimestampDetail(exitAt)}</p>
            </div>
            {duration && (
              <div>
                <p className="text-xs text-muted mb-0.5">Time in trade</p>
                <p className="text-sm font-medium tabular-nums">{duration}</p>
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="text-xs text-muted mb-0.5">Exit</p>
            <p className="text-sm tabular-nums">{formatTradeTimestampDetail(exitAt)}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-xs mt-0.5 space-y-0.5">
      <p className="text-foreground/85 font-medium">{formatTradeDate(exitAt)}</p>
      {entryAt ? (
        <p className="text-muted tabular-nums">
          <span>{formatTradeTimeWithSeconds(entryAt)}</span>
          <span className="opacity-60"> → </span>
          <span>{formatTradeTimeWithSeconds(exitAt)}</span>
          {duration && <span className="opacity-60"> · {duration}</span>}
        </p>
      ) : (
        <p className="text-muted tabular-nums">{formatTradeTimeWithSeconds(exitAt)}</p>
      )}
    </div>
  );
}
