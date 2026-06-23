/** Production site URL for auth email links (set in Vercel). Falls back to browser origin in client code. */
export function getSiteOrigin(fallback = "http://localhost:3000"): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return fallback;
}

export function getAuthCallbackUrl(fallback?: string): string {
  return `${getSiteOrigin(fallback)}/auth/callback`;
}
