import { categorizeEvent } from "./categories";
import { readJsonBody } from "./parse-response";
import type { EconomicEvent, EventImpact } from "./types";
import { formatTimeEt, toDateKeyEt } from "./utils";

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

interface FairEconomyRow {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  CAD: "CA",
  AUD: "AU",
  JPY: "JP",
  CNY: "CN",
  NZD: "NZ",
  CHF: "CH",
};

function normalizeImpact(raw: string | undefined): EventImpact {
  const v = raw?.toLowerCase().trim() ?? "";
  if (v === "high" || v === "holiday") return "high";
  if (v === "medium") return "medium";
  return "low";
}

function asString(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

function mapCountry(currencyOrCountry: string | undefined): string {
  const code = (currencyOrCountry ?? "??").toUpperCase();
  return CURRENCY_TO_COUNTRY[code] ?? code.slice(0, 3);
}

export function normalizeFairEconomyEvents(rows: FairEconomyRow[]): EconomicEvent[] {
  const result: EconomicEvent[] = [];

  rows.forEach((row, index) => {
    const name = row.title?.trim();
    if (!name || !row.date?.trim()) return;

    const when = new Date(row.date);
    if (Number.isNaN(when.getTime())) return;

    const iso = when.toISOString();
    const dateKey = toDateKeyEt(when);
    const country = mapCountry(row.country);
    const impact = normalizeImpact(row.impact);

    result.push({
      id: `ff-${dateKey}-${country}-${index}-${name.slice(0, 24)}`,
      event: name,
      country,
      impact,
      category: categorizeEvent(name),
      time: iso,
      timeEt: formatTimeEt(iso),
      dateKey,
      actual: asString(row.actual),
      estimate: asString(row.forecast),
      previous: asString(row.previous),
      unit: null,
    });
  });

  return result.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}

async function fetchFairEconomyFeed(): Promise<FairEconomyRow[]> {
  const res = await fetch(FEED_URL, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Calendar feed unavailable (${res.status})`);
  }
  const data = await readJsonBody<unknown>(res);
  if (!Array.isArray(data)) {
    throw new Error("Calendar feed returned an unexpected format");
  }
  return data as FairEconomyRow[];
}

export function filterEventsByRange(
  events: EconomicEvent[],
  from: string,
  to: string
): EconomicEvent[] {
  return events.filter((e) => e.dateKey >= from && e.dateKey <= to);
}

export async function fetchFairEconomyCalendar(
  from: string,
  to: string
): Promise<EconomicEvent[]> {
  const rows = await fetchFairEconomyFeed();
  const events = normalizeFairEconomyEvents(rows);
  return filterEventsByRange(events, from, to);
}

export const FAIR_ECONOMY_COVERAGE_NOTE =
  "Events cover the current trading week (Forex Factory). Other weeks may appear empty until that week begins.";
