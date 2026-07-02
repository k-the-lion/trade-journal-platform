import type { createClient } from "@/lib/supabase/server";
import type { ImportSource, TradeSource } from "@/lib/types/database";
import { normalizedToTradeInput, type NormalizedTradeRow } from "./adapter";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface PersistImportResult {
  imported: number;
  skipped: number;
  duplicatesSkipped: number;
  errors: string[];
  jobId: string;
}

export async function persistImportedTrades(params: {
  supabase: ServerClient;
  userId: string;
  rows: NormalizedTradeRow[];
  parseErrors?: string[];
  parseSkipped?: number;
  tradeSource: TradeSource;
  jobSource: ImportSource;
  orgId?: string | null;
  accountId?: string | null;
  strategyFields?: { strategy_id: string | null; setup_tag: string | null };
}): Promise<PersistImportResult> {
  const {
    supabase,
    userId,
    rows,
    parseErrors = [],
    parseSkipped = 0,
    tradeSource,
    jobSource,
    orgId,
    accountId,
    strategyFields = { strategy_id: null, setup_tag: null },
  } = params;

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      user_id: userId,
      org_id: orgId ?? null,
      source: jobSource,
      status: "processing",
      row_count: rows.length,
    })
    .select()
    .single();

  if (jobError) throw new Error(jobError.message);

  const { data: existingTrades } = await supabase
    .from("trades")
    .select("external_id")
    .eq("user_id", userId)
    .eq("source", tradeSource)
    .not("external_id", "is", null);

  const existingIds = new Set(
    ((existingTrades ?? []) as { external_id: string }[])
      .map((t) => t.external_id)
      .filter(Boolean)
  );

  let imported = 0;
  let duplicatesSkipped = 0;
  const insertErrors: string[] = [...parseErrors];

  for (const row of rows) {
    const tradeInput = normalizedToTradeInput(row, tradeSource, row.external_id);
    const externalId =
      tradeInput.external_id ??
      `${tradeSource}-${tradeInput.traded_at.slice(0, 19)}-${tradeInput.symbol}-${tradeInput.direction}-${tradeInput.pnl}`;

    if (existingIds.has(externalId)) {
      duplicatesSkipped++;
      continue;
    }

    const { error } = await supabase.from("trades").insert({
      user_id: userId,
      org_id: orgId ?? null,
      traded_at: tradeInput.traded_at,
      symbol: tradeInput.symbol,
      direction: tradeInput.direction,
      entry_price: tradeInput.entry_price,
      exit_price: tradeInput.exit_price,
      quantity: tradeInput.quantity,
      pnl: tradeInput.pnl,
      r_multiple: tradeInput.r_multiple,
      setup_tag: strategyFields.setup_tag,
      strategy_id: strategyFields.strategy_id,
      notes: null,
      import_notes: tradeInput.import_notes ?? null,
      account_id: accountId ?? null,
      source: tradeSource,
      external_id: externalId,
      import_job_id: job.id,
    });

    if (error) {
      if (error.code === "23505") {
        duplicatesSkipped++;
        existingIds.add(externalId);
      } else {
        insertErrors.push(error.message);
      }
    } else {
      imported++;
      existingIds.add(externalId);
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

  return {
    imported,
    skipped: parseSkipped + duplicatesSkipped,
    duplicatesSkipped,
    errors: insertErrors,
    jobId: job.id,
  };
}
