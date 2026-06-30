import { createClient, getProfile } from "@/lib/supabase/server";
import { ReportsView } from "@/components/ReportsView";
import type {
  DailyJournalEntry,
  Trade,
  TradingAccount,
  TradingStrategy,
  TradingTagPreset,
} from "@/lib/types/database";

export default async function ReportsPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const [
    { data: trades },
    { data: accounts },
    { data: strategies },
    { data: tagPresets },
    { data: dailyJournals },
  ] = await Promise.all([
      supabase
        .from("trades")
        .select("*, trade_tags(*), trading_accounts(*), trading_strategies(*)")
        .eq("user_id", profile!.id)
        .order("traded_at", { ascending: true }),
      supabase
        .from("trading_accounts")
        .select("*")
        .eq("user_id", profile!.id)
        .order("is_default", { ascending: false })
        .order("name"),
      supabase
        .from("trading_strategies")
        .select("*")
        .eq("user_id", profile!.id)
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("trading_tag_presets")
        .select("*")
        .eq("user_id", profile!.id)
        .order("sort_order")
        .order("name"),
      supabase
        .from("daily_journal_entries")
        .select("*")
        .eq("user_id", profile!.id)
        .order("journal_date", { ascending: false }),
    ]);

  return (
    <ReportsView
      trades={(trades ?? []) as Trade[]}
      accounts={(accounts ?? []) as TradingAccount[]}
      strategies={(strategies ?? []) as TradingStrategy[]}
      tagPresets={(tagPresets ?? []) as TradingTagPreset[]}
      dailyJournals={(dailyJournals ?? []) as DailyJournalEntry[]}
    />
  );
}
