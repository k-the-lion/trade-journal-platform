/** Optional paid calendar keys — the app uses a free Forex Factory feed by default. */
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
