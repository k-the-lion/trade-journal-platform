import type { createClient } from "@/lib/supabase/server";
import { signScreenshotUrls } from "@/lib/supabase/sign-screenshots";
import {
  filterTradesForCoach,
  hasActiveCoachFilters,
  type CoachTradeFilters,
} from "@/lib/ai/coach-filters";
import type {
  DailyJournalEntry,
  Trade,
  TradingAccount,
  TradingStrategy,
} from "@/lib/types/database";

const TRADE_FETCH_LIMIT = 300;
const JOURNAL_FETCH_LIMIT = 60;

export interface CoachData {
  trades: Trade[];
  filteredTrades: Trade[];
  dailyJournals: DailyJournalEntry[];
  accounts: TradingAccount[];
  strategies: TradingStrategy[];
}

export async function loadCoachData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filters: CoachTradeFilters
): Promise<CoachData> {
  const [{ data: accounts }, { data: strategies }, { data: trades }, { data: journals }] =
    await Promise.all([
      supabase
        .from("trading_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("name"),
      supabase
        .from("trading_strategies")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("trades")
        .select(
          "*, trade_tags(*), trade_screenshots(*), trading_accounts(*), trading_strategies(*)"
        )
        .eq("user_id", userId)
        .order("traded_at", { ascending: false })
        .limit(TRADE_FETCH_LIMIT),
      supabase
        .from("daily_journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("journal_date", { ascending: false })
        .limit(JOURNAL_FETCH_LIMIT),
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

  const filteredTrades = filterTradesForCoach(tradesWithUrls, filters);

  let dailyJournals = (journals ?? []) as DailyJournalEntry[];
  if (hasActiveCoachFilters(filters)) {
    if (filteredTrades.length > 0) {
      const tradeDays = new Set(filteredTrades.map((t) => t.traded_at.slice(0, 10)));
      dailyJournals = dailyJournals.filter((j) => tradeDays.has(j.journal_date));
    } else {
      dailyJournals = [];
    }
  }

  return {
    trades: tradesWithUrls,
    filteredTrades,
    dailyJournals,
    accounts: (accounts ?? []) as TradingAccount[],
    strategies: (strategies ?? []) as TradingStrategy[],
  };
}
