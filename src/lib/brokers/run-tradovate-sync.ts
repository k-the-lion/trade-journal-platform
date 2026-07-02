import type { createClient } from "@/lib/supabase/server";
import { decryptJson, encryptJson } from "@/lib/crypto/credentials";
import { fetchTradovateTrades } from "@/lib/brokers/tradovate/sync";
import type { TradovateCredentials } from "@/lib/brokers/tradovate/types";
import { persistImportedTrades, type PersistImportResult } from "@/lib/imports/persist";
import { resolveStrategyFields } from "@/lib/strategies/sync";
import type { BrokerSyncConnection } from "@/lib/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function runTradovateSyncForConnection(
  supabase: ServerClient,
  connection: BrokerSyncConnection,
  options?: { fullHistory?: boolean }
): Promise<PersistImportResult> {
  const creds = decryptJson<TradovateCredentials>(connection.credentials_encrypted);
  const { rows, updatedCreds } = await fetchTradovateTrades(
    connection.username,
    creds,
    Number(connection.external_account_id),
    connection.sync_from,
    connection.last_synced_at,
    options
  );

  const strategyFields = connection.strategy_id
    ? await resolveStrategyFields(supabase, connection.user_id, connection.strategy_id)
    : { strategy_id: null, setup_tag: null };

  const result = await persistImportedTrades({
    supabase,
    userId: connection.user_id,
    rows,
    tradeSource: "tradovate",
    jobSource: "tradovate",
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
      ...(updatedCreds
        ? {
            credentials_encrypted: encryptJson(updatedCreds),
          }
        : {}),
    })
    .eq("id", connection.id);

  return result;
}

export async function markTradovateSyncError(
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
