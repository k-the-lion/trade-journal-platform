"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildMonthGrid,
  formatDayHeading,
  formatMonthLabel,
  gridFetchRange,
  isSameDay,
  toDateKey,
} from "@/lib/economic-calendar/utils";
import type { EconomicEvent, EventImpact } from "@/lib/economic-calendar/types";
import { moodEmoji, moodLabel } from "@/lib/constants/trade-meta";
import { formatCurrency } from "@/lib/reports/stats";
import type { DailyJournalEntry } from "@/lib/types/database";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const OVERLAY_STORAGE_KEY = "tj-pnl-calendar-overlays";

type CalendarOverlays = {
  redEvents: boolean;
  yellowEvents: boolean;
  journal: boolean;
};

const DEFAULT_OVERLAYS: CalendarOverlays = {
  redEvents: false,
  yellowEvents: false,
  journal: false,
};

const IMPACT_DOTS: Record<EventImpact, string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-muted",
};

function loadOverlays(): CalendarOverlays {
  if (typeof window === "undefined") return DEFAULT_OVERLAYS;
  try {
    const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (!raw) return DEFAULT_OVERLAYS;
    const parsed = JSON.parse(raw) as Partial<CalendarOverlays>;
    return {
      redEvents: parsed.redEvents ?? false,
      yellowEvents: parsed.yellowEvents ?? false,
      journal: parsed.journal ?? false,
    };
  } catch {
    return DEFAULT_OVERLAYS;
  }
}

function saveOverlays(overlays: CalendarOverlays) {
  localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlays));
}

function overlayChipClass(active: boolean) {
  return `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${
    active
      ? "border-primary/50 bg-primary/10 text-primary"
      : "border-border text-muted hover:text-foreground"
  }`;
}

function journalHasContent(entry: DailyJournalEntry): boolean {
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

export function PnlCalendar({
  dailyPnl,
  dailyJournals = [],
}: {
  dailyPnl: Record<string, number>;
  dailyJournals?: DailyJournalEntry[];
}) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(toDateKey(today));
  const [overlays, setOverlays] = useState<CalendarOverlays>(DEFAULT_OVERLAYS);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const journalsByDay = useMemo(() => {
    const map = new Map<string, DailyJournalEntry>();
    for (const entry of dailyJournals) {
      if (journalHasContent(entry)) {
        map.set(entry.journal_date, entry);
      }
    }
    return map;
  }, [dailyJournals]);

  useEffect(() => {
    setOverlays(loadOverlays());
  }, []);

  useEffect(() => {
    saveOverlays(overlays);
  }, [overlays]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    const { from, to } = gridFetchRange(grid);
    try {
      const res = await fetch(`/api/economic-calendar?from=${from}&to=${to}`);
      const raw = await res.text();
      let data: { events?: EconomicEvent[]; error?: string };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(raw.trim().slice(0, 160) || "Failed to load events");
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load events");
      }
      setEvents(data.events ?? []);
    } catch (err) {
      setEvents([]);
      setEventsError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  }, [grid]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const redEventsByDay = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const event of events) {
      if (event.impact !== "high" || event.country !== "US") continue;
      const bucket = map.get(event.dateKey) ?? [];
      bucket.push(event);
      map.set(event.dateKey, bucket);
    }
    return map;
  }, [events]);

  const yellowEventsByDay = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const event of events) {
      if (event.impact !== "medium" || event.country !== "US") continue;
      const bucket = map.get(event.dateKey) ?? [];
      bucket.push(event);
      map.set(event.dateKey, bucket);
    }
    return map;
  }, [events]);

  const monthPnl = useMemo(() => {
    let total = 0;
    for (const cell of grid) {
      if (!cell.inMonth) continue;
      total += dailyPnl[cell.dateKey] ?? 0;
    }
    return total;
  }, [grid, dailyPnl]);

  const selectedPnl = selectedDay ? dailyPnl[selectedDay] : undefined;
  const selectedJournal = selectedDay ? journalsByDay.get(selectedDay) : undefined;
  const selectedRedEvents = selectedDay ? redEventsByDay.get(selectedDay) ?? [] : [];
  const selectedYellowEvents = selectedDay
    ? yellowEventsByDay.get(selectedDay) ?? []
    : [];

  const overlaysActive = overlays.redEvents || overlays.yellowEvents || overlays.journal;

  function toggleOverlay(key: keyof CalendarOverlays) {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function clearOverlays() {
    setOverlays(DEFAULT_OVERLAYS);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(toDateKey(today));
  }

  const overlayHint = overlaysActive
    ? [
        overlays.redEvents ? "Red folder" : null,
        overlays.yellowEvents ? "Yellow folder" : null,
        overlays.journal ? "Daily journal" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Toggle overlays to mark red/yellow news days and journal mood";

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-sm">Trading calendar</h2>
          <p className="text-xs text-muted mt-0.5">
            Green = profitable day · Red = losing day · Gray = no trades
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Month P&L</p>
          <p
            className={`text-lg font-semibold ${
              monthPnl >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {formatCurrency(monthPnl)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{overlayHint}</p>
          {overlaysActive && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={clearOverlays}
            >
              Clear overlays
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={overlayChipClass(overlays.redEvents)}
            onClick={() => toggleOverlay("redEvents")}
          >
            <span className={`w-2 h-2 rounded-full ${IMPACT_DOTS.high}`} />
            Red folder (US)
          </button>
          <button
            type="button"
            className={overlayChipClass(overlays.yellowEvents)}
            onClick={() => toggleOverlay("yellowEvents")}
          >
            <span className={`w-2 h-2 rounded-full ${IMPACT_DOTS.medium}`} />
            Yellow folder (US)
          </button>
          <button
            type="button"
            className={overlayChipClass(overlays.journal)}
            onClick={() => toggleOverlay("journal")}
          >
            <span className="text-sm leading-none">📝</span>
            Daily journal
          </button>
        </div>
        {eventsError && (overlays.redEvents || overlays.yellowEvents) && (
          <p className="text-xs text-danger">{eventsError}</p>
        )}
        {eventsLoading && (overlays.redEvents || overlays.yellowEvents) && (
          <p className="text-xs text-muted">Loading economic events…</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm px-3"
            onClick={() => {
              const d = new Date(viewYear, viewMonth - 1, 1);
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth());
            }}
            aria-label="Previous month"
          >
            ←
          </button>
          <h3 className="text-base font-semibold min-w-[160px] text-center">
            {formatMonthLabel(viewYear, viewMonth)}
          </h3>
          <button
            type="button"
            className="btn btn-secondary text-sm px-3"
            onClick={() => {
              const d = new Date(viewYear, viewMonth + 1, 1);
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth());
            }}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <button type="button" className="btn btn-secondary text-sm" onClick={goToday}>
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const pnl = dailyPnl[cell.dateKey];
          const hasTrades = pnl !== undefined;
          const isWin = hasTrades && pnl > 0;
          const isLoss = hasTrades && pnl < 0;
          const isBreakeven = hasTrades && pnl === 0;
          const isToday = isSameDay(cell.date, today);
          const isSelected = selectedDay === cell.dateKey;

          const journalEntry = journalsByDay.get(cell.dateKey);
          const showJournal = overlays.journal && journalEntry;
          const showRed = overlays.redEvents && (redEventsByDay.get(cell.dateKey)?.length ?? 0) > 0;
          const showYellow =
            overlays.yellowEvents && (yellowEventsByDay.get(cell.dateKey)?.length ?? 0) > 0;

          let bg = "bg-background/20 border-border/40";
          if (hasTrades) {
            if (isWin) bg = "bg-success/20 border-success/40";
            else if (isLoss) bg = "bg-danger/20 border-danger/40";
            else bg = "bg-white/5 border-border/60";
          }

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => setSelectedDay(cell.dateKey)}
              className={`relative min-h-[64px] rounded-lg border p-1.5 text-left transition-colors ${bg} ${
                isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
              } ${isToday ? "border-primary/70" : ""} ${
                cell.inMonth ? "" : "opacity-40"
              } hover:brightness-110`}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={`text-xs font-medium ${
                    isToday ? "text-primary" : cell.inMonth ? "text-foreground" : "text-muted"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                {(showRed || showYellow) && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {showRed && (
                      <span
                        className={`w-2 h-2 rounded-full ${IMPACT_DOTS.high}`}
                        title="Red folder event"
                      />
                    )}
                    {showYellow && (
                      <span
                        className={`w-2 h-2 rounded-full ${IMPACT_DOTS.medium}`}
                        title="Yellow folder event"
                      />
                    )}
                  </div>
                )}
              </div>

              {hasTrades && (
                <p
                  className={`text-[10px] font-semibold mt-1 leading-tight ${
                    isWin ? "text-success" : isLoss ? "text-danger" : "text-muted"
                  }`}
                >
                  {isBreakeven ? "BE" : formatCurrency(pnl)}
                </p>
              )}

              {showJournal && (
                <span
                  className="absolute bottom-1 right-1.5 text-base leading-none"
                  title={
                    journalEntry.mood
                      ? `Journal mood: ${moodLabel(journalEntry.mood)}`
                      : "Journal entry"
                  }
                >
                  {journalEntry.mood ? moodEmoji(journalEntry.mood) : "📝"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {overlaysActive && (
        <div className="flex flex-wrap gap-4 text-xs text-muted pt-1 border-t border-border/50">
          {overlays.redEvents && (
            <span className="inline-flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${IMPACT_DOTS.high}`} />
              Red folder — US high impact
            </span>
          )}
          {overlays.yellowEvents && (
            <span className="inline-flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${IMPACT_DOTS.medium}`} />
              Yellow folder — US medium impact
            </span>
          )}
          {overlays.journal && (
            <span className="inline-flex items-center gap-2">
              <span>📝</span>
              Journal mood (or note icon if no mood set)
            </span>
          )}
        </div>
      )}

      {selectedDay && (
        <div className="text-sm text-muted border-t border-border/50 pt-3 space-y-2">
          <p>
            <span className="font-medium text-foreground">{formatDayHeading(selectedDay)}</span>
            {" · "}
            {selectedPnl !== undefined ? (
              <span
                className={
                  selectedPnl > 0
                    ? "text-success font-medium"
                    : selectedPnl < 0
                      ? "text-danger font-medium"
                      : "text-foreground font-medium"
                }
              >
                {formatCurrency(selectedPnl)}
              </span>
            ) : (
              "No trades logged"
            )}
          </p>

          {overlays.journal && selectedJournal && (
            <div className="rounded-lg border border-border/50 bg-background/30 p-3 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide text-muted">Daily journal</p>
                <Link
                  href={`/journal?date=${selectedDay}`}
                  className="text-xs text-primary hover:underline"
                >
                  Open entry
                </Link>
              </div>
              {selectedJournal.mood && (
                <p className="text-sm">
                  <span className="text-lg mr-1">{moodEmoji(selectedJournal.mood)}</span>
                  {moodLabel(selectedJournal.mood)}
                </p>
              )}
              {selectedJournal.day_summary && (
                <p className="text-sm text-foreground/90">{selectedJournal.day_summary}</p>
              )}
            </div>
          )}

          {overlays.journal && !selectedJournal && (
            <p className="text-xs">No journal entry for this day.</p>
          )}

          {overlays.redEvents && selectedRedEvents.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-danger font-medium">
                Red folder ({selectedRedEvents.length})
              </p>
              {selectedRedEvents.map((event) => (
                <p key={event.id} className="text-sm text-foreground">
                  {event.timeEt} ET · {event.event}
                </p>
              ))}
            </div>
          )}

          {overlays.yellowEvents && selectedYellowEvents.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-warning font-medium">
                Yellow folder ({selectedYellowEvents.length})
              </p>
              {selectedYellowEvents.map((event) => (
                <p key={event.id} className="text-sm text-foreground">
                  {event.timeEt} ET · {event.event}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
