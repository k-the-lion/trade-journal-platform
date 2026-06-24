import type { createClient } from "@/lib/supabase/server";
import { decryptJson } from "@/lib/crypto/credentials";
import { fetchTopstepXTrades } from "@/lib/brokers/topstepx/sync";
import { persistImportedTrades, type PersistImportResult } from "@/lib/imports/persist";
import { resolveStrategyFields } from "@/lib/strategies/sync";
import type { BrokerSyncConnection } from "@/lib/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function runTopstepXSyncForConnection(
  supabase: ServerClient,
  connection: BrokerSyncConnection
): Promise<PersistImportResult> {
  const { apiKey } = decryptJson<{ apiKey: string }>(connection.credentials_encrypted);
  const rows = await fetchTopstepXTrades(
    connection.username,
    apiKey,
    Number(connection.external_account_id),
    connection.sync_from,
    connection.last_synced_at
  );

  const strategyFields = connection.strategy_id
    ? await resolveStrategyFields(supabase, connection.user_id, connection.strategy_id)
    : { strategy_id: null, setup_tag: null };

  const result = await persistImportedTrades({
    supabase,
    userId: connection.user_id,
    rows,
    tradeSource: "topstepx",
    jobSource: "topstepx",
    orgId: connection.org_id,
    accountId: connection.trading_account_id,
    strategyFields,
  });

  await supabase
    .from("broker_sync_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "success",
      last_sync_error: null,
      last_sync_imported: result.imported,
    })
    .eq("id", connection.id);

  return result;
}

export async function markTopstepXSyncError(
  supabase: ServerClient,
  connectionId: string,
  message: string
) {
  await supabase
    .from("broker_sync_connections")
    .update({
      last_sync_status: "error",
      last_sync_error: message,
    })
    .eq("id", connectionId);
}
