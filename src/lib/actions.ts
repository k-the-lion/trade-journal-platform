"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import type { AccountType, DailyJournalEntry, TradeInput, TradingStrategy, TradingTagPreset } from "@/lib/types/database";
import { permanentlyDeleteTradesForUser } from "@/lib/trades/delete";
import { BUCKET, tradeScreenshotPath } from "@/lib/supabase/storage";
import { isAllowedChartLink, normalizeChartLink } from "@/lib/screenshots";
import { resolveStrategyFields } from "@/lib/strategies/sync";
import { STRATEGY_TEMPLATES } from "@/lib/constants/strategies";
import { persistImportedTrades } from "@/lib/imports/persist";
import { getImportAdapter } from "@/lib/imports/adapter";
import {
  parseCsvTrades,
  type CsvColumnMapping,
  detectImportFormat,
  presetToAdapterKey,
  type ImportPreset,
} from "@/lib/imports";
import type { ImportSource, TradeSource } from "@/lib/types/database";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createTradingAccount(data: {
  name: string;
  broker?: string | null;
  account_type?: AccountType | null;
  is_default?: boolean;
}) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  if (data.is_default) {
    await supabase
      .from("trading_accounts")
      .update({ is_default: false })
      .eq("user_id", profile.id);
  }

  const { data: account, error } = await supabase
    .from("trading_accounts")
    .insert({
      user_id: profile.id,
      name: data.name.trim(),
      broker: data.broker?.trim() || null,
      account_type: data.account_type ?? null,
      is_default: data.is_default ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/import");
  revalidatePath("/reports");
  revalidatePath("/trades");
  revalidatePath("/settings");
  return account;
}

export async function updateTradingAccount(
  id: string,
  data: {
    name?: string;
    broker?: string | null;
    account_type?: AccountType | null;
    is_default?: boolean;
  }
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error("Account name is required");
    updates.name = trimmed;
  }
  if (data.broker !== undefined) {
    updates.broker = data.broker?.trim() || null;
  }
  if (data.account_type !== undefined) {
    updates.account_type = data.account_type;
  }
  if (data.is_default !== undefined) {
    updates.is_default = data.is_default;
  }

  if (data.is_default) {
    await supabase
      .from("trading_accounts")
      .update({ is_default: false })
      .eq("user_id", profile.id);
  }

  const { data: account, error } = await supabase
    .from("trading_accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", profile.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/import");
  revalidatePath("/reports");
  revalidatePath("/trades");
  revalidatePath("/settings");

  return account;
}

export async function upsertDailyJournalEntry(data: {
  journal_date: string;
  mood?: string | null;
  day_summary?: string | null;
  went_well?: string | null;
  to_improve?: string | null;
  lessons_learned?: string | null;
  tomorrow_focus?: string | null;
  discipline_rating?: number | null;
}) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.journal_date)) {
    throw new Error("Invalid journal date");
  }

  const trim = (value: string | null | undefined) => value?.trim() || null;

  const payload = {
    user_id: profile.id,
    journal_date: data.journal_date,
    mood: trim(data.mood),
    day_summary: trim(data.day_summary),
    went_well: trim(data.went_well),
    to_improve: trim(data.to_improve),
    lessons_learned: trim(data.lessons_learned),
    tomorrow_focus: trim(data.tomorrow_focus),
    discipline_rating:
      data.discipline_rating != null && data.discipline_rating >= 1 && data.discipline_rating <= 5
        ? data.discipline_rating
        : null,
  };

  const { data: entry, error } = await supabase
    .from("daily_journal_entries")
    .upsert(payload, { onConflict: "user_id,journal_date" })
    .select()
    .single();

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.message.includes("daily_journal_entries")
    ) {
      return {
        ok: false as const,
        error:
          "Daily journal database table is missing. Run migration 014 in the Supabase SQL editor (see supabase/migrations/014_daily_journal_entries.sql), then try again.",
      };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/journal");
  revalidatePath("/dashboard");

  return { ok: true as const, entry: entry as DailyJournalEntry };
}

export async function createStrategy(data: {
  name: string;
  description?: string | null;
  rules: string;
}) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: strategy, error } = await supabase
    .from("trading_strategies")
    .insert({
      user_id: profile.id,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      rules: data.rules.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return strategy as TradingStrategy;
}

export async function updateStrategy(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    rules?: string;
    is_active?: boolean;
  }
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: strategy, error } = await supabase
    .from("trading_strategies")
    .update(data)
    .eq("id", id)
    .eq("user_id", profile.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.name) {
    await supabase
      .from("trades")
      .update({ setup_tag: data.name.trim() })
      .eq("user_id", profile.id)
      .eq("strategy_id", id);
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return strategy as TradingStrategy;
}

export async function deleteStrategy(id: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("trading_strategies")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function seedStrategyTemplates() {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("trading_strategies")
    .select("name")
    .eq("user_id", profile.id);

  const names = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
  const toInsert = STRATEGY_TEMPLATES.filter(
    (t) => !names.has(t.name.toLowerCase())
  ).map((t, i) => ({
    user_id: profile.id,
    name: t.name,
    description: t.description,
    rules: t.rules,
    sort_order: i,
  }));

  if (toInsert.length) {
    const { error } = await supabase.from("trading_strategies").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { added: toInsert.length };
}

export async function createTagPreset(name: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name is required");

  const { data: existing } = await supabase
    .from("trading_tag_presets")
    .select("sort_order")
    .eq("user_id", profile.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("trading_tag_presets")
    .insert({ user_id: profile.id, name: trimmed, sort_order })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/strategies");
  revalidatePath("/dashboard");
  return data as TradingTagPreset;
}

export async function deleteTagPreset(id: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("trading_tag_presets")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/strategies");
  revalidatePath("/dashboard");
}

export async function updateTradeJournal(
  tradeId: string,
  data: {
    notes?: string | null;
    emotional_state?: string | null;
    mood_before?: string | null;
    mood_after?: string | null;
    setup_tag?: string | null;
    strategy_id?: string | null;
    rule_followed?: boolean | null;
    tags?: string[];
  }
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { tags, strategy_id, ...rest } = data;
  let tradeData = { ...rest };

  if (strategy_id !== undefined) {
    const fields = await resolveStrategyFields(supabase, profile.id, strategy_id);
    tradeData = { ...tradeData, ...fields };
  }

  const { error } = await supabase
    .from("trades")
    .update(tradeData)
    .eq("id", tradeId)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);

  if (tags !== undefined) {
    await supabase.from("trade_tags").delete().eq("trade_id", tradeId);
    if (tags.length) {
      await supabase.from("trade_tags").insert(
        tags.map((tag) => ({ trade_id: tradeId, tag }))
      );
    }
  }

  revalidatePath("/dashboard");
  revalidatePath(`/trades/${tradeId}`);
}

export async function uploadTradeScreenshot(tradeId: string, formData: FormData) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided");
  }

  const { data: trade } = await supabase
    .from("trades")
    .select("id")
    .eq("id", tradeId)
    .eq("user_id", profile.id)
    .single();

  if (!trade) throw new Error("Trade not found");

  const path = tradeScreenshotPath(profile.id, tradeId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { count } = await supabase
    .from("trade_screenshots")
    .select("*", { count: "exact", head: true })
    .eq("trade_id", tradeId);

  const { data: inserted, error: dbError } = await supabase
    .from("trade_screenshots")
    .insert({
      trade_id: tradeId,
      storage_path: path,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (dbError) throw new Error(dbError.message);

  let signed_url: string | undefined;
  if (inserted.storage_path) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(inserted.storage_path, 3600);
    signed_url = signed?.signedUrl;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/trades/${tradeId}`);
  return { ...inserted, signed_url };
}

export async function addTradeScreenshotLink(tradeId: string, rawUrl: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const link_url = normalizeChartLink(rawUrl);
  if (!isAllowedChartLink(link_url)) {
    throw new Error("Only TradingView chart links are supported (tradingview.com/x/...)");
  }

  const { data: trade } = await supabase
    .from("trades")
    .select("id")
    .eq("id", tradeId)
    .eq("user_id", profile.id)
    .single();

  if (!trade) throw new Error("Trade not found");

  const { count } = await supabase
    .from("trade_screenshots")
    .select("*", { count: "exact", head: true })
    .eq("trade_id", tradeId);

  const { data: inserted, error } = await supabase
    .from("trade_screenshots")
    .insert({
      trade_id: tradeId,
      storage_path: null,
      link_url,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath(`/trades/${tradeId}`);
  return inserted;
}

export async function deleteTradeScreenshot(screenshotId: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: shot } = await supabase
    .from("trade_screenshots")
    .select("id, storage_path, trade_id")
    .eq("id", screenshotId)
    .single();

  if (!shot) throw new Error("Screenshot not found");

  const { data: trade } = await supabase
    .from("trades")
    .select("user_id")
    .eq("id", shot.trade_id)
    .eq("user_id", profile.id)
    .single();

  if (!trade) throw new Error("Screenshot not found");

  if (shot.storage_path) {
    await supabase.storage.from(BUCKET).remove([shot.storage_path]);
  }
  await supabase.from("trade_screenshots").delete().eq("id", screenshotId);

  revalidatePath("/dashboard");
  revalidatePath(`/trades/${shot.trade_id}`);
}

export async function createTrade(input: TradeInput) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { tags, strategy_id, ...rest } = input;

  const strategyFields = strategy_id
    ? await resolveStrategyFields(supabase, profile.id, strategy_id)
    : { strategy_id: null, setup_tag: rest.setup_tag ?? null };

  const { data: trade, error } = await supabase
    .from("trades")
    .insert({
      ...rest,
      ...strategyFields,
      user_id: profile.id,
      source: "manual",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (tags?.length) {
    await supabase.from("trade_tags").insert(
      tags.map((tag) => ({ trade_id: trade.id, tag }))
    );
  }

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return trade;
}

export async function updateTrade(id: string, input: Partial<TradeInput>) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { tags, strategy_id, ...rest } = input;

  let tradeData: Record<string, unknown> = { ...rest };
  if (strategy_id !== undefined) {
    tradeData = {
      ...tradeData,
      ...(await resolveStrategyFields(supabase, profile.id, strategy_id)),
    };
  }

  const { error } = await supabase
    .from("trades")
    .update(tradeData)
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);

  if (tags !== undefined) {
    await supabase.from("trade_tags").delete().eq("trade_id", id);
    if (tags.length) {
      await supabase.from("trade_tags").insert(
        tags.map((tag) => ({ trade_id: id, tag }))
      );
    }
  }

  revalidatePath("/trades");
  revalidatePath(`/trades/${id}`);
  revalidatePath("/reports");
}

export async function deleteTrade(id: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: trade } = await supabase
    .from("trades")
    .select("id")
    .eq("id", id)
    .eq("user_id", profile.id)
    .single();

  if (!trade) throw new Error("Trade not found");

  await permanentlyDeleteTradesForUser(supabase, profile.id, [id]);

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function deleteAllTrades() {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const deleted = await permanentlyDeleteTradesForUser(supabase, profile.id);

  await supabase.from("import_jobs").delete().eq("user_id", profile.id);

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  revalidatePath("/import");
  revalidatePath("/reports");
  revalidatePath("/settings");
  revalidatePath("/tools");

  return { deleted };
}

export async function createOrganization(name: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name, slug: `${slug}-${Date.now().toString(36)}`, owner_id: profile.id })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("org_members").insert({
    org_id: org.id,
    user_id: profile.id,
    role: "coach",
  });

  await supabase.from("coaching_playbooks").insert({
    org_id: org.id,
    name: `${name} Playbook`,
    tone: "supportive",
    custom_rules:
      "Never give buy/sell signals. Focus on process, risk management, and emotional discipline.",
    is_active: true,
  });

  await supabase
    .from("profiles")
    .update({ platform_role: "coach" })
    .eq("id", profile.id);

  revalidatePath("/coach");
  return org;
}

export async function inviteStudent(orgId: string, email: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("org_invites")
    .insert({
      org_id: orgId,
      email: email.toLowerCase().trim(),
      role: "student",
      invited_by: profile.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/coach/org/${orgId}`);
  return data;
}

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: invite, error } = await supabase
    .from("org_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (error || !invite) throw new Error("Invalid or expired invite");
  if (invite.email.toLowerCase() !== profile.email.toLowerCase()) {
    throw new Error("This invite was sent to a different email address");
  }
  if (new Date(invite.expires_at) < new Date()) {
    throw new Error("Invite has expired");
  }

  await supabase.from("org_members").insert({
    org_id: invite.org_id,
    user_id: profile.id,
    role: invite.role,
  });

  await supabase
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  await supabase
    .from("profiles")
    .update({ platform_role: "student" })
    .eq("id", profile.id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updatePlaybook(
  playbookId: string,
  data: {
    tone?: string;
    topics_to_emphasize?: string[];
    topics_to_avoid?: string[];
    custom_rules?: string;
    review_checklist?: string;
  }
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("coaching_playbooks")
    .update(data)
    .eq("id", playbookId);

  if (error) throw new Error(error.message);
  revalidatePath("/coach/playbook");
}

export async function bulkAssignStrategy(tradeIds: string[], strategyId: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");
  if (!tradeIds.length) throw new Error("No trades selected");
  if (!strategyId.trim()) throw new Error("Choose a strategy");

  const fields = await resolveStrategyFields(supabase, profile.id, strategyId);

  const { error } = await supabase
    .from("trades")
    .update(fields)
    .eq("user_id", profile.id)
    .in("id", tradeIds);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/trades");
  revalidatePath("/reports");

  return { updated: tradeIds.length };
}

export async function bulkAssignStrategyByImportJob(
  importJobId: string,
  strategyId: string
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");
  if (!strategyId.trim()) throw new Error("Choose a strategy");

  const { data: trades, error: fetchError } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", profile.id)
    .eq("import_job_id", importJobId);

  if (fetchError) throw new Error(fetchError.message);
  const ids = (trades ?? []).map((t) => t.id);
  if (!ids.length) throw new Error("No trades found for this import");

  return bulkAssignStrategy(ids, strategyId);
}

export async function importCsvTrades(
  csvText: string,
  mapping: CsvColumnMapping,
  orgId?: string | null,
  preset: ImportPreset = "auto",
  accountId?: string | null,
  defaultStrategyId?: string | null
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const detected = preset === "auto" ? detectImportFormat(csvText) : null;
  const effectivePreset = preset === "auto" ? detected!.preset : preset;
  const adapterKey = presetToAdapterKey(effectivePreset);

  const adapter = getImportAdapter(adapterKey) ?? getImportAdapter("csv")!;
  const parseOptions: Record<string, unknown> = { mapping };

  if (effectivePreset === "tradovate_orders") {
    parseOptions.mode = "orders";
  } else if (effectivePreset === "tradovate_position") {
    parseOptions.mode = "position";
  } else if (effectivePreset === "tradingview_orders") {
    parseOptions.mode = "orders";
  } else if (effectivePreset === "tradingview_balance") {
    parseOptions.mode = "balance";
  } else if (effectivePreset === "tradingview_journal") {
    parseOptions.mode = "journal";
  }

  const result =
    adapterKey === "csv"
      ? parseCsvTrades(csvText, mapping)
      : adapter.parse(csvText, parseOptions);

  const tradeSource: TradeSource = adapter.source;
  const jobSource: ImportSource =
    tradeSource === "tradovate"
      ? "tradovate"
      : tradeSource === "tradingview"
        ? "tradingview"
        : "csv";

  const defaultStrategyFields = defaultStrategyId
    ? await resolveStrategyFields(supabase, profile.id, defaultStrategyId)
    : null;

  const persistResult = await persistImportedTrades({
    supabase,
    userId: profile.id,
    rows: result.rows,
    parseErrors: result.errors,
    parseSkipped: result.skipped,
    tradeSource,
    jobSource,
    orgId,
    accountId,
    strategyFields: defaultStrategyFields ?? { strategy_id: null, setup_tag: null },
  });

  revalidatePath("/trades");
  revalidatePath("/import");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {
    imported: persistResult.imported,
    skipped: persistResult.skipped,
    duplicatesSkipped: persistResult.duplicatesSkipped,
    errors: persistResult.errors,
    jobId: persistResult.jobId,
  };
}

export async function startNewChatSession() {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  await supabase.rpc("cleanup_empty_chat_sessions", { p_user_id: profile.id });
  const session = await createChatSession("New Session");
  redirect(`/chat?session=${session.id}`);
}

export async function openChatSession() {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  await supabase.rpc("cleanup_empty_chat_sessions", { p_user_id: profile.id });

  const { data: emptyId, error: findError } = await supabase.rpc(
    "find_empty_chat_session",
    { p_user_id: profile.id }
  );

  if (findError) throw new Error(findError.message);
  if (emptyId) {
    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", emptyId)
      .eq("user_id", profile.id)
      .single();
    if (existing) return existing;
  }

  return createChatSession("New Session");
}

export async function deleteChatSession(sessionId: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!session) throw new Error("Session not found");

  const { error: messagesError } = await supabase
    .from("chat_messages")
    .delete()
    .eq("session_id", sessionId);

  if (messagesError) throw new Error(messagesError.message);

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

export async function cleanupUnusedChatSessions(keepSessionId?: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return;

  await supabase.rpc("cleanup_empty_chat_sessions", {
    p_user_id: profile.id,
    p_keep_session_id: keepSessionId ?? null,
  });
}

export async function createChatSession(title?: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", profile.id)
    .eq("role", "student")
    .limit(1);

  const orgId = memberships?.[0]?.org_id ?? null;

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: profile.id,
      org_id: orgId,
      title: title ?? "Coaching Session",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfileName(fullName: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const name = fullName.trim();
  if (!name) throw new Error("Name is required");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);

  await supabase.auth.updateUser({ data: { full_name: name } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function updateAccountEmail(newEmail: string) {
  const supabase = await createClient();
  const email = newEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid email address");

  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new Error(error.message);

  return {
    ok: true as const,
    message: "Confirmation sent — check your inbox (old and new address) to finish the change.",
  };
}

export async function updateAccountPassword(newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  return { ok: true as const };
}

export async function createUserCoachPlaybook(data: {
  name: string;
  tone?: string;
  topics_to_emphasize?: string[];
  topics_to_avoid?: string[];
  custom_rules?: string;
  review_checklist?: string;
  is_default?: boolean;
}) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const name = data.name.trim();
  if (!name) throw new Error("Playbook name is required");

  if (data.is_default) {
    await supabase
      .from("user_coach_playbooks")
      .update({ is_default: false })
      .eq("user_id", profile.id);
  }

  const { data: row, error } = await supabase
    .from("user_coach_playbooks")
    .insert({
      user_id: profile.id,
      name,
      tone: data.tone ?? "supportive",
      topics_to_emphasize: data.topics_to_emphasize ?? ["risk management", "rule adherence"],
      topics_to_avoid: data.topics_to_avoid ?? ["specific trade calls"],
      custom_rules: data.custom_rules ?? "",
      review_checklist: data.review_checklist ?? "",
      is_default: data.is_default ?? false,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("user_coach_playbooks")) {
      throw new Error(
        "Playbooks table is missing. Run migration 015 in Supabase (see supabase/migrations/015_user_coach_playbooks.sql)."
      );
    }
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/chat");
  return row;
}

export async function updateUserCoachPlaybook(
  id: string,
  data: {
    name?: string;
    tone?: string;
    topics_to_emphasize?: string[];
    topics_to_avoid?: string[];
    custom_rules?: string;
    review_checklist?: string;
    is_default?: boolean;
  }
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  if (data.is_default) {
    await supabase
      .from("user_coach_playbooks")
      .update({ is_default: false })
      .eq("user_id", profile.id);
  }

  const { error } = await supabase
    .from("user_coach_playbooks")
    .update(data)
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/chat");
}

export async function deleteUserCoachPlaybook(id: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_coach_playbooks")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/chat");
}

export async function updateChatSessionPlaybook(sessionId: string, playbookKey: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const key = playbookKey.trim();
  if (!key) throw new Error("Invalid playbook");

  if (key !== "auto" && key !== "default" && key !== "org") {
    const { data: owned } = await supabase
      .from("user_coach_playbooks")
      .select("id")
      .eq("id", key)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!owned) throw new Error("Playbook not found");
  }

  const { error } = await supabase
    .from("chat_sessions")
    .update({ playbook_key: key, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

export async function upsertTradingGoals(
  accountId: string,
  data: {
    monthly_profit_target?: number | null;
    min_win_rate_pct?: number | null;
    max_daily_loss?: number | null;
    monthly_trade_target?: number | null;
  }
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { data: account } = await supabase
    .from("trading_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!account) throw new Error("Account not found");

  const payload = {
    user_id: profile.id,
    account_id: accountId,
    monthly_profit_target: data.monthly_profit_target ?? null,
    min_win_rate_pct: data.min_win_rate_pct ?? null,
    max_daily_loss: data.max_daily_loss ?? null,
    monthly_trade_target: data.monthly_trade_target ?? null,
  };

  const { data: row, error } = await supabase
    .from("user_trading_goals")
    .upsert(payload, { onConflict: "account_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/tools");
  return row;
}

export async function createTradingRule(name: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Rule name is required");

  const { data: existing } = await supabase
    .from("user_trading_rules")
    .select("sort_order")
    .eq("user_id", profile.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("user_trading_rules")
    .insert({ user_id: profile.id, name: trimmed, sort_order })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/tools");
  return data;
}

export async function deleteTradingRule(id: string) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_trading_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/tools");
}
