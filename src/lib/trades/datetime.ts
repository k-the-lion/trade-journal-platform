import type { Trade } from "@/lib/types/database";

const tradeDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const tradeTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const tradeTimeWithSecondsFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export function formatTradeDate(iso: string): string {
  return tradeDateFormatter.format(new Date(iso));
}

export function formatTradeTime(iso: string): string {
  return tradeTimeFormatter.format(new Date(iso));
}

export function formatTradeTimeWithSeconds(iso: string): string {
  return tradeTimeWithSecondsFormatter.format(new Date(iso));
}

/** Full line for trade detail views: "Thursday, June 24, 2026 · 2:15:40 PM" */
export function formatTradeTimestampDetail(iso: string): string {
  return `${formatTradeDate(iso)} · ${formatTradeTimeWithSeconds(iso)}`;
}

export function formatHoldDuration(entryAt: string, exitAt: string): string | null {
  const ms = new Date(exitAt).getTime() - new Date(entryAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;

  const totalSecs = Math.round(ms / 1000);
  if (totalSecs < 1) return "<1 S";

  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} H`);
  if (mins > 0) parts.push(`${mins} M`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} S`);

  return parts.join(" ");
}

export function formatAvgHoldMinutes(minutes: number): string {
  const formatted = formatHoldDuration(
    new Date(0).toISOString(),
    new Date(Math.round(minutes * 60_000)).toISOString()
  );
  return formatted ?? "<1 S";
}

export function computeHoldStats(trades: Trade[]): {
  avgHoldMinutes: number | null;
  tradesWithHold: number;
} {
  const durations: number[] = [];

  for (const trade of trades) {
    if (!trade.entry_at) continue;
    const mins =
      (new Date(trade.traded_at).getTime() - new Date(trade.entry_at).getTime()) / 60_000;
    if (mins >= 0) durations.push(mins);
  }

  if (!durations.length) {
    return { avgHoldMinutes: null, tradesWithHold: 0 };
  }

  return {
    avgHoldMinutes: durations.reduce((sum, n) => sum + n, 0) / durations.length,
    tradesWithHold: durations.length,
  };
}
