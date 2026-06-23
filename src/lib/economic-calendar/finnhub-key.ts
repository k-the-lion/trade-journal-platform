/** Server-only Finnhub API key (never use NEXT_PUBLIC_ — keeps the key off the client). */
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

export const FINNHUB_KEY_SETUP_HINT =
  "Add FINNHUB_API_KEY in Vercel → Settings → Environment Variables (Production). Use the exact name FINNHUB_API_KEY (not NEXT_PUBLIC_), then redeploy.";
