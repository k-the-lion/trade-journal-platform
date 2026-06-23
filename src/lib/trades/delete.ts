import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/supabase/storage";
import type { Database } from "@/lib/types/database";

type ServerClient = SupabaseClient<Database>;

export async function getScreenshotPathsForTrades(
  supabase: ServerClient,
  tradeIds: string[]
): Promise<string[]> {
  if (tradeIds.length === 0) return [];

  const { data: shots } = await supabase
    .from("trade_screenshots")
    .select("storage_path")
    .in("trade_id", tradeIds);

  return ((shots ?? []) as { storage_path: string | null }[])
    .map((s) => s.storage_path)
    .filter((p): p is string => Boolean(p));
}

export async function removeScreenshotFiles(
  supabase: ServerClient,
  paths: string[]
): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;

  const batchSize = 100;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    await supabase.storage.from(BUCKET).remove(batch);
  }
}

export async function permanentlyDeleteTradesForUser(
  supabase: ServerClient,
  userId: string,
  tradeIds?: string[]
): Promise<number> {
  let ids = tradeIds;

  if (!ids) {
    const { data: trades } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", userId);
    ids = ((trades ?? []) as { id: string }[]).map((t) => t.id);
  }

  if (ids.length === 0) return 0;

  const paths = await getScreenshotPathsForTrades(supabase, ids);
  await removeScreenshotFiles(supabase, paths);

  const { error, count } = await supabase
    .from("trades")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .in("id", ids);

  if (error) throw new Error(error.message);
  return count ?? ids.length;
}
