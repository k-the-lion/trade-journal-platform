import { categorizeEvent } from "./categories";
import { readJsonBody } from "./parse-response";
import type { EconomicEvent, EventImpact } from "./types";
import { formatTimeEt, toDateKey } from "./utils";

interface FmpRow {
  date?: string;
  country?: string;
  event?: string;
  currency?: string;
  previous?: string | number | null;
  estimate?: string | number | null;
  actual?: string | number | null;
  impact?: string;
  unit?: string | null;
}

function normalizeImpact(raw: string | undefined): EventImpact {
  const v = raw?.toLowerCase().trim() ?? "";
  if (v === "high" || v === "3") return "high";
  if (v === "medium" || v === "2") return "medium";
  return "low";
}

function asString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function parseFmpDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;
  const d2 = new Date(value);
  return Number.isNaN(d2.getTime()) ? null : d2;
}

export function normalizeFmpEvents(rows: FmpRow[]): EconomicEvent[] {
  const result: EconomicEvent[] = [];

  rows.forEach((row, index) => {
    const name = row.event?.trim();
    if (!name) return;

    const when = parseFmpDate(row.date);
    if (!when) return;

    const impact = normalizeImpact(row.impact);
    const country = (row.country ?? row.currency ?? "??").toUpperCase().slice(0, 3);
    const iso = when.toISOString();
    const dateKey = toDateKey(when);

    result.push({
      id: `fmp-${dateKey}-${country}-${index}-${name.slice(0, 24)}`,
      event: name,
      country,
      impact,
      category: categorizeEvent(name),
      time: iso,
      timeEt: formatTimeEt(iso),
      dateKey,
      actual: asString(row.actual),
      estimate: asString(row.estimate),
      previous: asString(row.previous),
      unit: asString(row.unit),
    });
  });

  return result.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}

async function fetchFmpUrl(url: string): Promise<FmpRow[]> {
  const res = await fetch(url, { next: { revalidate: 900 } });
  const data: unknown = await readJsonBody(res);

  if (!res.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "Error Message" in data &&
      typeof (data as { "Error Message": unknown })["Error Message"] === "string"
        ? (data as { "Error Message": string })["Error Message"]
        : `HTTP ${res.status}`;
    throw new Error(`FMP calendar unavailable (${res.status}): ${detail}`);
  }

  if (!Array.isArray(data)) {
    throw new Error("FMP returned an unexpected calendar response");
  }
  return data as FmpRow[];
}

export async function fetchFmpCalendar(
  from: string,
  to: string,
  apiKey: string
): Promise<EconomicEvent[]> {
  const stableUrl = new URL("https://financialmodelingprep.com/stable/economic-calendar");
  stableUrl.searchParams.set("from", from);
  stableUrl.searchParams.set("to", to);
  stableUrl.searchParams.set("apikey", apiKey);

  try {
    const rows = await fetchFmpUrl(stableUrl.toString());
    if (rows.length > 0) return normalizeFmpEvents(rows);
  } catch (stableErr) {
    const legacyUrl = new URL(
      "https://financialmodelingprep.com/api/v3/economic_calendar"
    );
    legacyUrl.searchParams.set("from", from);
    legacyUrl.searchParams.set("to", to);
    legacyUrl.searchParams.set("apikey", apiKey);

    try {
      const rows = await fetchFmpUrl(legacyUrl.toString());
      return normalizeFmpEvents(rows);
    } catch {
      throw stableErr;
    }
  }

  const legacyUrl = new URL(
    "https://financialmodelingprep.com/api/v3/economic_calendar"
  );
  legacyUrl.searchParams.set("from", from);
  legacyUrl.searchParams.set("to", to);
  legacyUrl.searchParams.set("apikey", apiKey);

  const rows = await fetchFmpUrl(legacyUrl.toString());
  return normalizeFmpEvents(rows);
}
