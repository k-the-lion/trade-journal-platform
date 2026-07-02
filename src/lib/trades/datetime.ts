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

export function formatTradeDate(iso: string): string {
  return tradeDateFormatter.format(new Date(iso));
}

export function formatTradeTime(iso: string): string {
  return tradeTimeFormatter.format(new Date(iso));
}

export function formatHoldDuration(entryAt: string, exitAt: string): string | null {
  const ms = new Date(exitAt).getTime() - new Date(entryAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;

  const totalMins = Math.round(ms / 60_000);
  if (totalMins < 1) return "<1m";
  if (totalMins < 60) return `${totalMins}m`;

  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;

  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

export function formatAvgHoldMinutes(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
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
