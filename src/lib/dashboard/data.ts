import { createClient } from "@/lib/supabase/server";
import { signScreenshotUrls } from "@/lib/supabase/sign-screenshots";
import type { Trade, TradingAccount, TradingStrategy, TradingTagPreset } from "@/lib/types/database";

export async function getDashboardData(userId: string) {
  const supabase = await createClient();

  const [{ data: accounts }, { data: strategies }, { data: tagPresets }, { data: trades }] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("name"),
    supabase
      .from("trading_strategies")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("trading_tag_presets")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("trades")
      .select("*, trade_tags(*), trade_screenshots(*), trading_accounts(*), trading_strategies(*)")
      .eq("user_id", userId)
      .order("traded_at", { ascending: false }),
  ]);

  const tradeList = (trades ?? []) as Trade[];
  const screenshots = tradeList.flatMap((t) => t.trade_screenshots ?? []);

  const signedByPath = await signScreenshotUrls(supabase, screenshots);

  const tradesWithUrls = tradeList.map((t) => ({
    ...t,
    trade_screenshots: (t.trade_screenshots ?? []).map((s) => ({
      ...s,
      signed_url: s.storage_path
        ? signedByPath.get(s.storage_path) ?? undefined
        : undefined,
    })),
  }));

  return {
    accounts: (accounts ?? []) as TradingAccount[],
    strategies: (strategies ?? []) as TradingStrategy[],
    tagPresets: (tagPresets ?? []) as TradingTagPreset[],
    trades: tradesWithUrls,
  };
}
