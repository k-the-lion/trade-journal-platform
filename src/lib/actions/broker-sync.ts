"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { encryptJson, decryptJson } from "@/lib/crypto/credentials";
import {
  topstepxListAccounts,
  topstepxLoginWithFallback,
  TopstepXApiError,
} from "@/lib/brokers/topstepx/client";
import { fetchTopstepXTrades } from "@/lib/brokers/topstepx/sync";
import { persistImportedTrades } from "@/lib/imports/persist";
import { resolveStrategyFields } from "@/lib/strategies/sync";
import type { BrokerSyncConnection, BrokerSyncConnectionPublic } from "@/lib/types/database";

export type TopstepXAccountOption = {
  id: number;
  name: string;
};

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

  const row = connection as BrokerSyncConnection;

  try {
    const { apiKey } = decryptJson<{ apiKey: string }>(row.credentials_encrypted);
    const rows = await fetchTopstepXTrades(
      row.username,
      apiKey,
      Number(row.external_account_id),
      row.sync_from,
      row.last_synced_at
    );

    const strategyFields = row.strategy_id
      ? await resolveStrategyFields(supabase, profile.id, row.strategy_id)
      : { strategy_id: null, setup_tag: null };

    const result = await persistImportedTrades({
      supabase,
      userId: profile.id,
      rows,
      tradeSource: "topstepx",
      jobSource: "topstepx",
      orgId: row.org_id,
      accountId: row.trading_account_id,
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
      .eq("id", connectionId);

    revalidatePath("/import");
    revalidatePath("/trades");
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await supabase
      .from("broker_sync_connections")
      .update({
        last_sync_status: "error",
        last_sync_error: message,
      })
      .eq("id", connectionId);
    revalidatePath("/import");
    throw new Error(message);
  }
}
