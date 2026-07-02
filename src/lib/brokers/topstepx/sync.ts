import {
  topstepxGetContract,
  topstepxLoginWithFallback,
  topstepxSearchTrades,
} from "./client";
import { normalizeTopstepXTrades } from "./normalize";
import { pickContractSymbol } from "./symbol";
import type { NormalizedTradeRow } from "@/lib/imports/adapter";

const CHUNK_DAYS = 30;
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
): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const chunkEnd = addDays(cursor, chunkDays);
    const to = chunkEnd < end ? chunkEnd : end;
    chunks.push({
      from: cursor.toISOString(),
      to: to.toISOString(),
    });
    cursor = new Date(to);
  }
  return chunks;
}

export async function fetchTopstepXTrades(
  username: string,
  apiKey: string,
  accountId: number,
  syncFrom?: string | null,
  lastSyncedAt?: string | null,
  options?: { fullHistory?: boolean }
): Promise<NormalizedTradeRow[]> {
  const token = await topstepxLoginWithFallback(username, apiKey);

  const end = new Date();
  let start: Date;
  if (options?.fullHistory) {
    start = syncFrom ? new Date(syncFrom) : addDays(end, -DEFAULT_LOOKBACK_DAYS);
  } else if (lastSyncedAt) {
    start = addDays(new Date(lastSyncedAt), -2);
  } else if (syncFrom) {
    start = new Date(syncFrom);
  } else {
    start = addDays(end, -DEFAULT_LOOKBACK_DAYS);
  }

  const chunks = dateChunks(start, end);
  const allTrades = [];

  for (const chunk of chunks) {
    const batch = await topstepxSearchTrades(
      token,
      accountId,
      chunk.from,
      chunk.to
    );
    allTrades.push(...batch);
  }

  const uniqueById = new Map<number, (typeof allTrades)[number]>();
  for (const trade of allTrades) {
    uniqueById.set(trade.id, trade);
  }
  const deduped = [...uniqueById.values()];

  const contractIds = [...new Set(deduped.map((t) => t.contractId))];
  const contractSymbols = new Map<string, string>();

  await Promise.all(
    contractIds.map(async (contractId) => {
      const contract = await topstepxGetContract(token, contractId);
      contractSymbols.set(
        contractId,
        pickContractSymbol(contractId, contract)
      );
    })
  );

  return normalizeTopstepXTrades(deduped, contractSymbols);
}
