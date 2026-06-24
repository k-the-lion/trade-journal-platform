import { getFmpApiKey, getFinnhubApiKey, CALENDAR_KEY_SETUP_HINT } from "./api-keys";
import { fetchFmpCalendar } from "./fmp";
import { fetchFinnhubCalendar } from "./finnhub";
import type { EconomicEvent } from "./types";

export async function fetchEconomicCalendar(
  from: string,
  to: string
): Promise<EconomicEvent[]> {
  const fmpKey = getFmpApiKey();
  if (fmpKey) {
    return fetchFmpCalendar(from, to, fmpKey);
  }

  const finnhubKey = getFinnhubApiKey();
  if (finnhubKey) {
    try {
      return await fetchFinnhubCalendar(from, to);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("403")) {
        throw new Error(
          "Finnhub economic calendar requires a paid plan (403). Use a free FMP_API_KEY from financialmodelingprep.com instead."
        );
      }
      throw err;
    }
  }

  throw new Error(`No calendar API key configured. ${CALENDAR_KEY_SETUP_HINT}`);
}
