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

function isJournalTableMissing(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST205" ||
    error?.message?.includes("daily_journal_entries") === true
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

  const [entryRes, recentRes, tradesRes] = await Promise.all([
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

  const journalUnavailable =
    isJournalTableMissing(entryRes.error) || isJournalTableMissing(recentRes.error);

  const recentEntries = ((recentRes.data ?? []) as DailyJournalEntry[]).filter(
    entryHasContent
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Daily journal</h1>
        <p className="text-muted text-sm mt-1">
          Reflect on the session — what worked, what to fix, and what to carry into tomorrow.
        </p>
      </div>

      {journalUnavailable && (
        <div className="card p-4 border-warning/40 bg-warning/10 text-sm space-y-2">
          <p className="font-medium text-warning">Database setup required</p>
          <p className="text-muted">
            The daily journal table hasn&apos;t been created in Supabase yet. Open the{" "}
            <a
              href="https://supabase.com/dashboard/project/iikrkjmlokpsqcutulux/sql/new"
              className="text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              SQL editor
            </a>
            , paste the contents of{" "}
            <code className="text-xs">supabase/migrations/014_daily_journal_entries.sql</code>
            , and run it. Then refresh this page.
          </p>
        </div>
      )}

      <DailyJournal
        journalDate={journalDate}
        entry={(entryRes.data as DailyJournalEntry | null) ?? null}
        recentEntries={recentEntries}
        trades={(tradesRes.data ?? []) as Trade[]}
        journalUnavailable={journalUnavailable}
      />
    </div>
  );
}
