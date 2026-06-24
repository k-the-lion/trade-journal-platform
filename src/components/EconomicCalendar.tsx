"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/economic-calendar/categories";
import type { EconomicEvent, EventCategory, EventImpact } from "@/lib/economic-calendar/types";
import {
  buildMonthGrid,
  formatDayHeading,
  formatMonthLabel,
  gridFetchRange,
  isSameDay,
  toDateKey,
} from "@/lib/economic-calendar/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const IMPACT_META: Record<
  EventImpact,
  { label: string; dot: string; badge: string; description: string }
> = {
  high: {
    label: "High",
    dot: "bg-danger",
    badge: "text-danger border-danger/40 bg-danger/10",
    description: "Red folder — market movers",
  },
  medium: {
    label: "Medium",
    dot: "bg-warning",
    badge: "text-warning border-warning/40 bg-warning/10",
    description: "Orange — watchlist",
  },
  low: {
    label: "Low",
    dot: "bg-muted",
    badge: "text-muted border-border bg-white/5",
    description: "Lower impact",
  },
};

const COUNTRY_OPTIONS = ["US", "EU", "GB", "CA", "AU", "JP", "CN"] as const;

const FILTER_STORAGE_KEY = "tj-calendar-filters";

type StoredFilters = {
  impacts: EventImpact[];
  countries: string[];
};

function loadFilters(): StoredFilters {
  if (typeof window === "undefined") {
    return { impacts: ["high"], countries: ["US"] };
  }
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return { impacts: ["high"], countries: ["US"] };
    const parsed = JSON.parse(raw) as StoredFilters;
    return {
      impacts: parsed.impacts?.length ? parsed.impacts : ["high"],
      countries: parsed.countries?.length ? parsed.countries : ["US"],
    };
  } catch {
    return { impacts: ["high"], countries: ["US"] };
  }
}

function saveFilters(filters: StoredFilters) {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function impactRank(impact: EventImpact): number {
  if (impact === "high") return 3;
  if (impact === "medium") return 2;
  return 1;
}

function EventRow({ event }: { event: EconomicEvent }) {
  const meta = IMPACT_META[event.impact];
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-1.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{event.event}</p>
          <p className="text-xs text-muted mt-0.5">
            {event.timeEt} ET · {event.country} · {CATEGORY_LABELS[event.category]}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.badge}`}
        >
          {meta.label}
        </span>
      </div>
      {(event.estimate || event.previous || event.actual) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted pt-1">
          {event.previous && <span>Prev: {event.previous}{event.unit ? ` ${event.unit}` : ""}</span>}
          {event.estimate && <span>Forecast: {event.estimate}{event.unit ? ` ${event.unit}` : ""}</span>}
          {event.actual && (
            <span className="text-foreground font-medium">
              Actual: {event.actual}{event.unit ? ` ${event.unit}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function EconomicCalendar() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(toDateKey(today));
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverageNote, setCoverageNote] = useState<string | null>(null);
  const [impacts, setImpacts] = useState<EventImpact[]>(["high"]);
  const [countries, setCountries] = useState<string[]>(["US"]);

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  useEffect(() => {
    const saved = loadFilters();
    setImpacts(saved.impacts);
    setCountries(saved.countries);
  }, []);

  useEffect(() => {
    saveFilters({ impacts, countries });
  }, [impacts, countries]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { from, to } = gridFetchRange(grid);
    try {
      const res = await fetch(
        `/api/economic-calendar?from=${from}&to=${to}`
      );
      const raw = await res.text();
      let data: {
        events?: EconomicEvent[];
        error?: string;
        coverageNote?: string | null;
      };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(
          raw.trim().slice(0, 160) || "Failed to load calendar"
        );
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load calendar");
      }
      setEvents(data.events ?? []);
      setCoverageNote(data.coverageNote ?? null);
    } catch (err) {
      setEvents([]);
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [grid]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter(
      (e) =>
        impacts.includes(e.impact) &&
        (countries.length === 0 || countries.includes(e.country))
    );
  }, [events, impacts, countries]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const event of filteredEvents) {
      const bucket = map.get(event.dateKey) ?? [];
      bucket.push(event);
      map.set(event.dateKey, bucket);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          new Date(a.time).getTime() - new Date(b.time).getTime()
      );
    }
    return map;
  }, [filteredEvents]);

  const nextEvent = useMemo(() => {
    const now = Date.now();
    return filteredEvents.find((e) => new Date(e.time).getTime() >= now) ?? null;
  }, [filteredEvents]);

  const selectedEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : [];

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(toDateKey(today));
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function applyPreset(preset: "red" | "us-all" | "global-high") {
    if (preset === "red") {
      setImpacts(["high"]);
      setCountries(["US"]);
    } else if (preset === "us-all") {
      setImpacts(["high", "medium", "low"]);
      setCountries(["US"]);
    } else {
      setImpacts(["high"]);
      setCountries([]);
    }
  }

  return (
    <div className="space-y-5">
      {nextEvent && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-3 border-danger/30 bg-danger/5">
          <div>
            <p className="text-xs uppercase tracking-wide text-danger font-medium">
              Next event
            </p>
            <p className="text-sm font-medium mt-1">
              {nextEvent.event}{" "}
              <span className="text-muted font-normal">
                · {formatDayHeading(nextEvent.dateKey)} · {nextEvent.timeEt} ET
              </span>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={() => setSelectedDay(nextEvent.dateKey)}
          >
            View day
          </button>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary text-sm px-3"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ←
            </button>
            <h2 className="text-lg font-semibold min-w-[180px] text-center">
              {formatMonthLabel(viewYear, viewMonth)}
            </h2>
            <button
              type="button"
              className="btn btn-secondary text-sm px-3"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <button type="button" className="btn btn-secondary text-sm" onClick={goToday}>
            Today
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => applyPreset("red")}
            >
              Red folder (US)
            </button>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => applyPreset("us-all")}
            >
              All US events
            </button>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => applyPreset("global-high")}
            >
              Global high impact
            </button>
          </div>

          <div>
            <p className="label mb-2">Impact</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(IMPACT_META) as EventImpact[]).map((impact) => {
                const active = impacts.includes(impact);
                const meta = IMPACT_META[impact];
                return (
                  <button
                    key={impact}
                    type="button"
                    onClick={() =>
                      setImpacts((prev) => {
                        const next = toggleInList(prev, impact);
                        return next.length ? next : prev;
                      })
                    }
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="label mb-2">Country</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCountries([])}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  countries.length === 0
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                All countries
              </button>
              {COUNTRY_OPTIONS.map((code) => {
                const active = countries.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() =>
                      setCountries((prev) => {
                        const next = toggleInList(prev, code);
                        return next;
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {coverageNote && !error && (
          <div className="rounded-lg border border-border bg-white/5 p-3 text-sm text-muted">
            {coverageNote}
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted pb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 font-medium">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell) => {
            const dayEvents = eventsByDay.get(cell.dateKey) ?? [];
            const isToday = isSameDay(cell.date, today);
            const isSelected = selectedDay === cell.dateKey;
            const topImpact = dayEvents.reduce<EventImpact | null>((best, e) => {
              if (!best || impactRank(e.impact) > impactRank(best)) return e.impact;
              return best;
            }, null);

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => setSelectedDay(cell.dateKey)}
                className={`min-h-[72px] rounded-lg border p-2 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : isToday
                      ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                      : cell.inMonth
                        ? "border-border/50 bg-background/20 hover:border-border hover:bg-background/40"
                        : "border-transparent bg-transparent text-muted/50 hover:bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`text-sm font-medium ${
                      cell.inMonth ? "text-foreground" : "text-muted"
                    } ${isToday ? "text-primary" : ""}`}
                  >
                    {cell.date.getDate()}
                  </span>
                  {dayEvents.length > 0 && topImpact && (
                    <span className="text-[10px] text-muted">{dayEvents.length}</span>
                  )}
                </div>
                {dayEvents.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(["high", "medium", "low"] as EventImpact[]).map((impact) => {
                      const count = dayEvents.filter((e) => e.impact === impact).length;
                      if (!count) return null;
                      return (
                        <span
                          key={impact}
                          className={`w-2 h-2 rounded-full ${IMPACT_META[impact].dot}`}
                          title={`${count} ${IMPACT_META[impact].label.toLowerCase()}`}
                        />
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <p className="text-sm text-muted text-center py-2">Loading events…</p>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-muted pt-1 border-t border-border/50">
          {(Object.keys(IMPACT_META) as EventImpact[]).map((impact) => (
            <span key={impact} className="inline-flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${IMPACT_META[impact].dot}`} />
              {IMPACT_META[impact].description}
            </span>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">
            {selectedDay ? formatDayHeading(selectedDay) : "Select a day"}
          </h3>
          {selectedEvents.length > 0 && (
            <span className="text-xs text-muted">
              {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {selectedDay && selectedEvents.length === 0 && !loading && (
          <p className="text-sm text-muted">
            No events match your filters on this day. Try widening impact or country filters.
          </p>
        )}

        <div className="space-y-3">
          {selectedEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}
