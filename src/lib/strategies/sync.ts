import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type ServerClient = SupabaseClient<Database>;

export async function resolveStrategyFields(
  supabase: ServerClient,
  userId: string,
  strategyId: string | null | undefined
): Promise<{ strategy_id: string | null; setup_tag: string | null }> {
  if (!strategyId) {
    return { strategy_id: null, setup_tag: null };
  }

  const { data } = await supabase
    .from("trading_strategies")
    .select("id, name")
    .eq("id", strategyId)
    .eq("user_id", userId)
    .single();

  if (!data) throw new Error("Strategy not found");

  const row = data as { id: string; name: string };
  return { strategy_id: row.id, setup_tag: row.name };
}
