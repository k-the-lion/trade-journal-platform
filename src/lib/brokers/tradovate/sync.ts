import type { TradovateCredentials, TradovateOAuthCredentials } from "./types";
import { resolveTradovateAccessToken, tradovateFetchPositionHistoryCsv } from "./client";
import { parseTradovateCsv } from "@/lib/imports/tradovate-adapter";
import type { NormalizedTradeRow } from "@/lib/imports/adapter";

const CHUNK_DAYS = 60;
const DEFAULT_LOOKBACK_DAYS = 365;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateChunks(
  start: Date,
  end: Date,
  chunkDays = CHUNK_DAYS
): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const chunkEnd = addDays(cursor, chunkDays);
    const to = chunkEnd < end ? chunkEnd : end;
    chunks.push({ from: new Date(cursor), to: new Date(to) });
    cursor = new Date(to);
  }
  return chunks;
}

function dedupeRows(rows: NormalizedTradeRow[]): NormalizedTradeRow[] {
  const byKey = new Map<string, NormalizedTradeRow>();
  for (const row of rows) {
    const key =
      row.external_id ??
      `${row.traded_at}|${row.symbol}|${row.pnl}|${row.entry_price}|${row.exit_price}`;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

export async function fetchTradovateTrades(
  username: string,
  creds: TradovateCredentials,
  accountId: number,
  syncFrom?: string | null,
  lastSyncedAt?: string | null
): Promise<{ rows: NormalizedTradeRow[]; updatedCreds?: TradovateOAuthCredentials }> {
  const { token, updatedCreds } = await resolveTradovateAccessToken(username, creds);

  const end = new Date();
  let start: Date;
  if (lastSyncedAt) {
    start = addDays(new Date(lastSyncedAt), -2);
  } else if (syncFrom) {
    start = new Date(syncFrom);
  } else {
    start = addDays(end, -DEFAULT_LOOKBACK_DAYS);
  }

  const chunks = dateChunks(start, end);
  const allRows: NormalizedTradeRow[] = [];
  const errors: string[] = [];

  for (const chunk of chunks) {
    const csv = await tradovateFetchPositionHistoryCsv(
      token,
      creds.environment,
      accountId,
      chunk.from,
      chunk.to
    );
    const parsed = parseTradovateCsv(csv, "position");
    allRows.push(...parsed.rows);
    errors.push(...parsed.errors);
  }

  if (!allRows.length && errors.length) {
    throw new Error(errors[0] ?? "No trades found in Tradovate Position History report");
  }

  return { rows: dedupeRows(allRows), updatedCreds };
}
