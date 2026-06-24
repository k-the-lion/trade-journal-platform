export const CALENDAR_KEY_SETUP_HINT =
  "Add FMP_API_KEY in Vercel → Settings → Environment Variables (Production). Get a free key at financialmodelingprep.com, then redeploy.";

/** FMP free tier includes the economic calendar (Finnhub returns 403 on free plans). */
export function getFmpApiKey(): string | undefined {
  const candidates = [
    process.env.FMP_API_KEY,
    process.env.FINANCIAL_MODELING_PREP_API_KEY,
    process.env.FMP_TOKEN,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** Optional paid fallback — not available on Finnhub free tier. */
export function getFinnhubApiKey(): string | undefined {
  const candidates = [
    process.env.FINNHUB_API_KEY,
    process.env.FINNHUB_TOKEN,
    process.env.FINNHUB_API_TOKEN,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function hasCalendarApiKey(): boolean {
  return Boolean(getFmpApiKey() || getFinnhubApiKey());
}
