"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { MoodPicker } from "@/components/MoodPicker";
import { StatCard } from "@/components/StatCard";
import { upsertDailyJournalEntry } from "@/lib/actions";
import {
  formatDayHeading,
  isValidDateKey,
  shiftDateKey,
  toDateKey,
} from "@/lib/economic-calendar/utils";
import { moodLabel } from "@/lib/constants/trade-meta";
import { computeTradeStats, formatCurrency } from "@/lib/reports/stats";
import type { DailyJournalEntry, Trade } from "@/lib/types/database";

function entryPreview(entry: DailyJournalEntry): string {
  return (
    entry.day_summary ||
    entry.went_well ||
    entry.to_improve ||
    entry.lessons_learned ||
    entry.tomorrow_focus ||
    (entry.mood ? `Mood: ${moodLabel(entry.mood)}` : "") ||
    "Journal entry"
  );
}

export function DailyJournal({
  journalDate,
  entry,
  recentEntries,
  trades,
}: {
  journalDate: string;
  entry: DailyJournalEntry | null;
  recentEntries: DailyJournalEntry[];
  trades: Trade[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mood, setMood] = useState(entry?.mood ?? "");
  const [daySummary, setDaySummary] = useState(entry?.day_summary ?? "");
  const [wentWell, setWentWell] = useState(entry?.went_well ?? "");
  const [toImprove, setToImprove] = useState(entry?.to_improve ?? "");
  const [lessonsLearned, setLessonsLearned] = useState(entry?.lessons_learned ?? "");
  const [tomorrowFocus, setTomorrowFocus] = useState(entry?.tomorrow_focus ?? "");
  const [disciplineRating, setDisciplineRating] = useState<number | null>(
    entry?.discipline_rating ?? null
  );

  useEffect(() => {
    setMood(entry?.mood ?? "");
    setDaySummary(entry?.day_summary ?? "");
    setWentWell(entry?.went_well ?? "");
    setToImprove(entry?.to_improve ?? "");
    setLessonsLearned(entry?.lessons_learned ?? "");
    setTomorrowFocus(entry?.tomorrow_focus ?? "");
    setDisciplineRating(entry?.discipline_rating ?? null);
    setSaved(false);
    setError(null);
  }, [entry, journalDate]);

  const dayTrades = useMemo(
    () => trades.filter((t) => t.traded_at.slice(0, 10) === journalDate),
    [trades, journalDate]
  );
  const dayStats = useMemo(() => computeTradeStats(dayTrades), [dayTrades]);
  const isToday = journalDate === toDateKey(new Date());

  function navigateToDate(dateKey: string) {
    if (!isValidDateKey(dateKey)) return;
    router.push(`/journal?date=${dateKey}`);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await upsertDailyJournalEntry({
          journal_date: journalDate,
          mood: mood || null,
          day_summary: daySummary,
          went_well: wentWell,
          to_improve: toImprove,
          lessons_learned: lessonsLearned,
          tomorrow_focus: tomorrowFocus,
          discipline_rating: disciplineRating,
        });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm px-3"
            onClick={() => navigateToDate(shiftDateKey(journalDate, -1))}
            aria-label="Previous day"
          >
            ←
          </button>
          <div className="text-center min-w-[200px]">
            <p className="font-medium text-sm">{formatDayHeading(journalDate)}</p>
            {isToday && <p className="text-xs text-primary mt-0.5">Today</p>}
          </div>
          <button
            type="button"
            className="btn btn-secondary text-sm px-3"
            onClick={() => navigateToDate(shiftDateKey(journalDate, 1))}
            aria-label="Next day"
          >
            →
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input text-sm py-1.5 w-auto"
            value={journalDate}
            onChange={(e) => navigateToDate(e.target.value)}
          />
          {!isToday && (
            <button
              type="button"
              className="btn btn-secondary text-xs py-1.5"
              onClick={() => navigateToDate(toDateKey(new Date()))}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {dayTrades.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Day P&L"
            value={formatCurrency(dayStats.totalPnl)}
            positive={
              dayStats.totalPnl > 0 ? true : dayStats.totalPnl < 0 ? false : null
            }
          />
          <StatCard
            label="Trades"
            value={String(dayStats.totalTrades)}
            sub={`${dayStats.winRate}% win rate`}
          />
          <StatCard label="Rule adherence" value={`${dayStats.ruleFollowedPct}%`} />
          <StatCard
            label="Avg win / loss"
            value={`${formatCurrency(dayStats.avgWin)} / ${formatCurrency(dayStats.avgLoss)}`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-5">
            <div>
              <p className="label mb-2">Overall mood</p>
              <MoodPicker
                key={journalDate}
                value={mood || null}
                onChange={setMood}
                name="day_mood"
              />
            </div>

            <div>
              <label className="label" htmlFor="day-summary">
                Day notes
              </label>
              <textarea
                id="day-summary"
                className="input resize-y min-h-[88px]"
                placeholder="How was the session? Market conditions, energy, distractions…"
                value={daySummary}
                onChange={(e) => setDaySummary(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="went-well">
                What went well?
              </label>
              <textarea
                id="went-well"
                className="input resize-y min-h-[72px]"
                placeholder="Patience, rule-following, good entries, risk management…"
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="to-improve">
                What could I improve?
              </label>
              <textarea
                id="to-improve"
                className="input resize-y min-h-[72px]"
                placeholder="Mistakes, impulses, sizing, timing — be specific so you can fix it."
                value={toImprove}
                onChange={(e) => setToImprove(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="lessons">
                Lessons learned
              </label>
              <textarea
                id="lessons"
                className="input resize-y min-h-[72px]"
                placeholder="One takeaway worth remembering from today."
                value={lessonsLearned}
                onChange={(e) => setLessonsLearned(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="tomorrow">
                Tomorrow&apos;s focus
              </label>
              <textarea
                id="tomorrow"
                className="input resize-y min-h-[72px]"
                placeholder="One thing to prioritize in the next session."
                value={tomorrowFocus}
                onChange={(e) => setTomorrowFocus(e.target.value)}
              />
            </div>

            <div>
              <p className="label mb-2">Process / discipline (1–5)</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setDisciplineRating(disciplineRating === n ? null : n)
                    }
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                      disciplineRating === n
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted hover:border-primary/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="text-xs text-muted self-center ml-1">
                  1 = poor · 5 = excellent
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md p-3">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={handleSave}
              >
                {pending ? "Saving…" : "Save journal"}
              </button>
              {saved && (
                <span className="text-sm text-success">Saved</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {dayTrades.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="font-medium text-sm">Trades this day</h3>
              <ul className="space-y-2 max-h-[280px] overflow-y-auto">
                {dayTrades.map((trade) => (
                  <li key={trade.id}>
                    <Link
                      href={`/trades/${trade.id}`}
                      className="block rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm hover:border-primary/40 transition-colors"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{trade.symbol}</span>
                        <span
                          className={
                            Number(trade.pnl) >= 0 ? "text-success" : "text-danger"
                          }
                        >
                          {formatCurrency(Number(trade.pnl))}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5 capitalize">
                        {trade.direction}
                        {trade.setup_tag ? ` · ${trade.setup_tag}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recentEntries.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="font-medium text-sm">Recent entries</h3>
              <ul className="space-y-2">
                {recentEntries.map((recent) => (
                  <li key={recent.journal_date}>
                    <button
                      type="button"
                      onClick={() => navigateToDate(recent.journal_date)}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                        recent.journal_date === journalDate
                          ? "border-primary bg-primary/10"
                          : "border-border/60 hover:border-primary/40"
                      }`}
                    >
                      <p className="font-medium text-xs text-muted">
                        {formatDayHeading(recent.journal_date)}
                      </p>
                      <p className="text-sm mt-1 line-clamp-2">{entryPreview(recent)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
