"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { encryptJson } from "@/lib/crypto/credentials";
import {
  topstepxListAccounts,
  topstepxLoginWithFallback,
  TopstepXApiError,
} from "@/lib/brokers/topstepx/client";
import {
  markTopstepXSyncError,
  runTopstepXSyncForConnection,
} from "@/lib/brokers/run-topstepx-sync";
import {
  markTradovateSyncError,
  runTradovateSyncForConnection,
} from "@/lib/brokers/run-tradovate-sync";
import { tradovateListAccounts, TradovateApiError } from "@/lib/brokers/tradovate/client";
import {
  clearTradovateOAuthPendingSession,
  getTradovateOAuthPendingSession,
} from "@/lib/brokers/tradovate/oauth-session";
import type { TradovateEnvironment } from "@/lib/brokers/tradovate/types";
import type { BrokerSyncConnection, BrokerSyncConnectionPublic } from "@/lib/types/database";

export type TopstepXAccountOption = {
  id: number;
  name: string;
};

export type TradovateAccountOption = {
  id: number;
  name: string;
};

export type BrokerSyncMode = "manual" | "auto";

export async function verifyTopstepXCredentials(
  username: string,
  apiKey: string
): Promise<{ accounts: TopstepXAccountOption[] }> {
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const trimmedUser = username.trim();
  const trimmedKey = apiKey.trim();
  if (!trimmedUser || !trimmedKey) {
    throw new Error("Username and API key are required");
  }

  try {
    const token = await topstepxLoginWithFallback(trimmedUser, trimmedKey);
    const accounts = await topstepxListAccounts(token);
    if (!accounts.length) {
      throw new Error("No active TopstepX accounts found for this API key");
    }
    return {
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    };
  } catch (err) {
    if (err instanceof TopstepXApiError) {
      throw new Error(err.message);
    }
    throw err;
  }
}

export async function connectTopstepX(input: {
  username: string;
  apiKey: string;
  externalAccountId: number;
  externalAccountName: string;
  tradingAccountId: string;
  strategyId?: string | null;
  syncFrom?: string | null;
  orgId?: string | null;
  syncMode?: BrokerSyncMode;
}) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const trimmedUser = input.username.trim();
  const trimmedKey = input.apiKey.trim();
  if (!trimmedUser || !trimmedKey) {
    throw new Error("Username and API key are required");
  }
  if (!input.tradingAccountId) {
    throw new Error("Select a journal account for imported trades");
  }

  await verifyTopstepXCredentials(trimmedUser, trimmedKey);

  const credentials_encrypted = encryptJson({ apiKey: trimmedKey });
  const externalId = String(input.externalAccountId);
  const autoSync = input.syncMode === "auto";

  const { data, error } = await supabase
    .from("broker_sync_connections")
    .upsert(
      {
        user_id: profile.id,
        provider: "topstepx",
        label: input.externalAccountName,
        username: trimmedUser,
        credentials_encrypted,
        external_account_id: externalId,
        external_account_name: input.externalAccountName,
        trading_account_id: input.tradingAccountId,
        strategy_id: input.strategyId ?? null,
        org_id: input.orgId ?? null,
        sync_from: input.syncFrom ? new Date(input.syncFrom).toISOString() : null,
        auto_sync: autoSync,
        last_sync_status: "never",
        last_sync_error: null,
        last_sync_imported: 0,
        is_active: true,
      },
      { onConflict: "user_id,provider,external_account_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/import");
  const { credentials_encrypted: _removed, ...publicConnection } = data as BrokerSyncConnection;
  return publicConnection;
}

export async function updateBrokerSyncMode(
  connectionId: string,
  syncMode: BrokerSyncMode
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("broker_sync_connections")
    .update({ auto_sync: syncMode === "auto" })
    .eq("id", connectionId)
    .eq("user_id", profile.id)
    .select(
      "id, user_id, provider, label, username, external_account_id, external_account_name, trading_account_id, strategy_id, org_id, sync_from, auto_sync, last_synced_at, last_sync_status, last_sync_error, last_sync_imported, is_active, created_at, updated_at"
    )
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/import");
  return data as BrokerSyncConnectionPublic;
}

export async function disconnectBrokerSync(connectionId: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("broker_sync_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/import");
}

export async function loadTradovateOAuthAccounts(): Promise<{
  accounts: TradovateAccountOption[];
  username: string;
  displayName: string;
  environment: TradovateEnvironment;
} | null> {
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const session = await getTradovateOAuthPendingSession();
  if (!session) return null;

  try {
    const accounts = await tradovateListAccounts(session.accessToken, session.environment);
    if (!accounts.length) {
      throw new Error("No Tradovate accounts found for this login");
    }
    return {
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      username: session.username,
      displayName: session.displayName,
      environment: session.environment,
    };
  } catch (err) {
    if (err instanceof TradovateApiError) {
      throw new Error(err.message);
    }
    throw err;
  }
}

export async function connectTradovateOAuth(input: {
  externalAccountId: number;
  externalAccountName: string;
  tradingAccountId: string;
  strategyId?: string | null;
  syncFrom?: string | null;
  orgId?: string | null;
  syncMode?: BrokerSyncMode;
}) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  if (!input.tradingAccountId) {
    throw new Error("Select a journal account for imported trades");
  }

  const session = await getTradovateOAuthPendingSession();
  if (!session) {
    throw new Error("Tradovate login expired — click Connect with Tradovate again");
  }

  const credentials_encrypted = encryptJson({
    authType: "oauth",
    refreshToken: session.refreshToken,
    accessToken: session.accessToken,
    environment: session.environment,
  });
  const externalId = String(input.externalAccountId);
  const autoSync = input.syncMode === "auto";

  const { data, error } = await supabase
    .from("broker_sync_connections")
    .upsert(
      {
        user_id: profile.id,
        provider: "tradovate",
        label: input.externalAccountName,
        username: session.username,
        credentials_encrypted,
        external_account_id: externalId,
        external_account_name: input.externalAccountName,
        trading_account_id: input.tradingAccountId,
        strategy_id: input.strategyId ?? null,
        org_id: input.orgId ?? null,
        sync_from: input.syncFrom ? new Date(input.syncFrom).toISOString() : null,
        auto_sync: autoSync,
        last_sync_status: "never",
        last_sync_error: null,
        last_sync_imported: 0,
        is_active: true,
      },
      { onConflict: "user_id,provider,external_account_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);

  await clearTradovateOAuthPendingSession();

  revalidatePath("/import");
  const { credentials_encrypted: _removed, ...publicConnection } = data as BrokerSyncConnection;
  return publicConnection;
}

export async function syncTradovateConnection(connectionId: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: connection, error: connError } = await supabase
    .from("broker_sync_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", profile.id)
    .eq("provider", "tradovate")
    .single();

  if (connError || !connection) {
    throw new Error("Tradovate connection not found");
  }

  try {
    const result = await runTradovateSyncForConnection(
      supabase,
      connection as BrokerSyncConnection,
      { fullHistory: true }
    );

    revalidatePath("/import");
    revalidatePath("/trades");
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await markTradovateSyncError(supabase, connectionId, message);
    revalidatePath("/import");
    throw new Error(message);
  }
}

export async function syncTopstepXConnection(connectionId: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: connection, error: connError } = await supabase
    .from("broker_sync_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", profile.id)
    .eq("provider", "topstepx")
    .single();

  if (connError || !connection) {
    throw new Error("TopstepX connection not found");
  }

  try {
    const result = await runTopstepXSyncForConnection(
      supabase,
      connection as BrokerSyncConnection,
      { fullHistory: true }
    );

    revalidatePath("/import");
    revalidatePath("/trades");
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await markTopstepXSyncError(supabase, connectionId, message);
    revalidatePath("/import");
    throw new Error(message);
  }
}

export type BrokerSyncRefreshResult = {
  connectionId: string;
  label: string;
  provider: string;
  imported: number;
  backfilled: number;
  skipped: number;
  error?: string;
};

export async function syncAllBrokerConnections(): Promise<BrokerSyncRefreshResult[]> {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: connections, error } = await supabase
    .from("broker_sync_connections")
    .select("*")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .in("provider", ["topstepx", "tradovate"]);

  if (error) throw new Error(error.message);

  const results: BrokerSyncRefreshResult[] = [];

  for (const row of connections ?? []) {
    const connection = row as BrokerSyncConnection;
    const label = connection.label || connection.external_account_name || connection.provider;

    try {
      const result =
        connection.provider === "tradovate"
          ? await runTradovateSyncForConnection(supabase, connection, { fullHistory: true })
          : await runTopstepXSyncForConnection(supabase, connection, { fullHistory: true });

      results.push({
        connectionId: connection.id,
        label,
        provider: connection.provider,
        imported: result.imported,
        backfilled: result.backfilled,
        skipped: result.skipped,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      if (connection.provider === "tradovate") {
        await markTradovateSyncError(supabase, connection.id, message);
      } else {
        await markTopstepXSyncError(supabase, connection.id, message);
      }
      results.push({
        connectionId: connection.id,
        label,
        provider: connection.provider,
        imported: 0,
        backfilled: 0,
        skipped: 0,
        error: message,
      });
    }
  }

  revalidatePath("/import");
  revalidatePath("/trades");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return results;
}
