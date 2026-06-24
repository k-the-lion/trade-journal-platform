import {
  FAIR_ECONOMY_COVERAGE_NOTE,
  fetchFairEconomyCalendar,
} from "./fair-economy";
import { fetchFmpCalendar } from "./fmp";
import { fetchFinnhubCalendar } from "./finnhub";
import { getFmpApiKey, getFinnhubApiKey } from "./api-keys";
import type { EconomicEvent } from "./types";

export interface CalendarFetchResult {
  events: EconomicEvent[];
  coverageNote: string | null;
}

async function tryPaidProviders(
  from: string,
  to: string
): Promise<EconomicEvent[] | null> {
  const fmpKey = getFmpApiKey();
  if (fmpKey) {
    try {
      const events = await fetchFmpCalendar(from, to, fmpKey);
      if (events.length > 0) return events;
    } catch {
      // Ignore restricted/invalid paid keys.
    }
  }

  const finnhubKey = getFinnhubApiKey();
  if (finnhubKey) {
    try {
      const events = await fetchFinnhubCalendar(from, to);
      if (events.length > 0) return events;
    } catch {
      // Ignore Finnhub free-tier 403.
    }
  }

  return null;
}

export async function fetchEconomicCalendar(
  from: string,
  to: string
): Promise<CalendarFetchResult> {
  try {
    const events = await fetchFairEconomyCalendar(from, to);
    return { events, coverageNote: FAIR_ECONOMY_COVERAGE_NOTE };
  } catch {
    const paid = await tryPaidProviders(from, to);
    if (paid) {
      return { events: paid, coverageNote: null };
    }
    throw new Error(
      "Could not load the economic calendar. The free feed is temporarily unavailable — try again shortly."
    );
  }
}
