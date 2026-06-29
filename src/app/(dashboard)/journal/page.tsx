import { DailyJournal } from "@/components/DailyJournal";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isValidDateKey, toDateKey } from "@/lib/economic-calendar/utils";
import type { DailyJournalEntry, Trade } from "@/lib/types/database";

function entryHasContent(entry: DailyJournalEntry): boolean {
  return !!(
    entry.mood ||
    entry.day_summary ||
    entry.went_well ||
    entry.to_improve ||
    entry.lessons_learned ||
    entry.tomorrow_focus ||
    entry.discipline_rating
  );
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const journalDate = isValidDateKey(date) ? date : toDateKey(new Date());

  const profile = await getProfile();
  const supabase = await createClient();

  const [{ data: entry }, { data: recent }, { data: trades }] = await Promise.all([
    supabase
      .from("daily_journal_entries")
      .select("*")
      .eq("user_id", profile!.id)
      .eq("journal_date", journalDate)
      .maybeSingle(),
    supabase
      .from("daily_journal_entries")
      .select("*")
      .eq("user_id", profile!.id)
      .order("journal_date", { ascending: false })
      .limit(30),
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", profile!.id)
      .order("traded_at", { ascending: false }),
  ]);

  const recentEntries = ((recent ?? []) as DailyJournalEntry[]).filter(entryHasContent);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Daily journal</h1>
        <p className="text-muted text-sm mt-1">
          Reflect on the session — what worked, what to fix, and what to carry into tomorrow.
        </p>
      </div>

      <DailyJournal
        journalDate={journalDate}
        entry={(entry as DailyJournalEntry | null) ?? null}
        recentEntries={recentEntries}
        trades={(trades ?? []) as Trade[]}
      />
    </div>
  );
}
