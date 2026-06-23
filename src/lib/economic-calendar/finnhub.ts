import { categorizeEvent } from "./categories";
import { getFinnhubApiKey, FINNHUB_KEY_SETUP_HINT } from "./finnhub-key";
import type { EconomicEvent, EventImpact } from "./types";
import { formatTimeEt, toDateKey } from "./utils";

interface FinnhubRow {
  actual?: string | number | null;
  country?: string;
  estimate?: string | number | null;
  event?: string;
  impact?: string;
  prev?: string | number | null;
  previous?: string | number | null;
  time?: string | number;
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

function parseEventTime(raw: string | number | undefined): Date | null {
  if (raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && raw.trim() !== "") {
    const ms = asNum > 1e12 ? asNum : asNum * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (!Number.isNaN(d.getTime())) return d;
  const local = new Date(raw);
  return Number.isNaN(local.getTime()) ? null : local;
}

export function normalizeFinnhubEvents(rows: FinnhubRow[]): EconomicEvent[] {
  const result: EconomicEvent[] = [];

  rows.forEach((row, index) => {
    const name = row.event?.trim();
    if (!name) return;

    const when = parseEventTime(row.time);
    if (!when) return;

    const impact = normalizeImpact(row.impact);
    const country = (row.country ?? "??").toUpperCase();
    const iso = when.toISOString();
    const dateKey = toDateKey(when);

    result.push({
      id: `${dateKey}-${country}-${index}-${name.slice(0, 24)}`,
      event: name,
      country,
      impact,
      category: categorizeEvent(name),
      time: iso,
      timeEt: formatTimeEt(iso),
      dateKey,
      actual: asString(row.actual),
      estimate: asString(row.estimate),
      previous: asString(row.prev ?? row.previous),
      unit: asString(row.unit),
    });
  });

  return result.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
}

export async function fetchFinnhubCalendar(
  from: string,
  to: string
): Promise<EconomicEvent[]> {
  const token = getFinnhubApiKey();
  if (!token) {
    throw new Error(`FINNHUB_API_KEY is not configured. ${FINNHUB_KEY_SETUP_HINT}`);
  }

  const url = new URL("https://finnhub.io/api/v1/calendar/economic");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    next: { revalidate: 900 },
  });

  if (!res.ok) {
    throw new Error(`Economic calendar unavailable (${res.status})`);
  }

  const data = (await res.json()) as { economicCalendar?: FinnhubRow[] };
  return normalizeFinnhubEvents(data.economicCalendar ?? []);
}
