"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import type { AccountType, TradeInput } from "@/lib/types/database";
import { permanentlyDeleteTradesForUser } from "@/lib/trades/delete";
import { BUCKET, tradeScreenshotPath } from "@/lib/supabase/storage";
import { normalizedToTradeInput, getImportAdapter } from "@/lib/imports/adapter";
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
  return account;
}

export async function updateTradeJournal(
  tradeId: string,
  data: {
    notes?: string | null;
    emotional_state?: string | null;
    setup_tag?: string | null;
    tags?: string[];
  }
) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { tags, ...tradeData } = data;

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

  const { error: dbError } = await supabase.from("trade_screenshots").insert({
    trade_id: tradeId,
    storage_path: path,
    sort_order: count ?? 0,
  });

  if (dbError) throw new Error(dbError.message);

  revalidatePath("/dashboard");
  revalidatePath(`/trades/${tradeId}`);
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

  await supabase.storage.from(BUCKET).remove([shot.storage_path]);
  await supabase.from("trade_screenshots").delete().eq("id", screenshotId);

  revalidatePath("/dashboard");
  revalidatePath(`/trades/${shot.trade_id}`);
}

export async function createTrade(input: TradeInput) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");

  const { tags, ...tradeData } = input;

  const { data: trade, error } = await supabase
    .from("trades")
    .insert({
      ...tradeData,
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

  const { tags, ...tradeData } = input;

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

export async function importCsvTrades(
  csvText: string,
  mapping: CsvColumnMapping,
  orgId?: string | null,
  preset: ImportPreset = "auto",
  accountId?: string | null
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
  }

  const result =
    adapterKey === "csv"
      ? parseCsvTrades(csvText, mapping)
      : adapter.parse(csvText, parseOptions);

  const tradeSource: TradeSource = adapter.source;
  const jobSource: ImportSource =
    tradeSource === "tradovate" ? "tradovate" : "csv";

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      user_id: profile.id,
      org_id: orgId ?? null,
      source: jobSource,
      status: "processing",
      row_count: result.rows.length,
    })
    .select()
    .single();

  if (jobError) throw new Error(jobError.message);

  let imported = 0;
  const insertErrors: string[] = [...result.errors];

  for (const row of result.rows) {
    const tradeInput = normalizedToTradeInput(row, tradeSource, row.external_id);
    const { error } = await supabase.from("trades").upsert(
      {
        user_id: profile.id,
        org_id: orgId ?? null,
        traded_at: tradeInput.traded_at,
        symbol: tradeInput.symbol,
        direction: tradeInput.direction,
        entry_price: tradeInput.entry_price,
        exit_price: tradeInput.exit_price,
        quantity: tradeInput.quantity,
        pnl: tradeInput.pnl,
        r_multiple: tradeInput.r_multiple,
        setup_tag: tradeInput.setup_tag,
        notes: tradeInput.notes,
        account_id: accountId ?? null,
        source: tradeSource,
        external_id: tradeInput.external_id,
        import_job_id: job.id,
      },
      { onConflict: "user_id,source,external_id", ignoreDuplicates: false }
    );

    if (error) {
      if (!tradeInput.external_id) {
        const { error: insertErr } = await supabase.from("trades").insert({
          user_id: profile.id,
          org_id: orgId ?? null,
          traded_at: tradeInput.traded_at,
          symbol: tradeInput.symbol,
          direction: tradeInput.direction,
          entry_price: tradeInput.entry_price,
          exit_price: tradeInput.exit_price,
          quantity: tradeInput.quantity,
          pnl: tradeInput.pnl,
          r_multiple: tradeInput.r_multiple,
          setup_tag: tradeInput.setup_tag,
          notes: tradeInput.notes,
          account_id: accountId ?? null,
          source: tradeSource,
          import_job_id: job.id,
        });
        if (insertErr) insertErrors.push(insertErr.message);
        else imported++;
      } else {
        insertErrors.push(error.message);
      }
    } else {
      imported++;
    }
  }

  await supabase
    .from("import_jobs")
    .update({
      status: insertErrors.length && imported === 0 ? "failed" : "completed",
      imported_count: imported,
      error_message: insertErrors.length ? insertErrors.slice(0, 5).join("; ") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  revalidatePath("/trades");
  revalidatePath("/import");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {
    imported,
    skipped: result.skipped,
    errors: insertErrors,
    jobId: job.id,
  };
}

export async function startNewChatSession() {
  const session = await createChatSession("New Session");
  redirect(`/chat?session=${session.id}`);
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
