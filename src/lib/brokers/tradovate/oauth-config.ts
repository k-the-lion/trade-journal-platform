import { getSiteOrigin } from "@/lib/auth/site-url";
import type { TradovateEnvironment } from "./types";

export const TRADOVATE_OAUTH_STATE_COOKIE = "tradovate_oauth_state";
export const TRADOVATE_OAUTH_SESSION_COOKIE = "tradovate_oauth_session";

export function isTradovateOAuthConfigured(): boolean {
  const clientId = process.env.TRADOVATE_CLIENT_ID?.trim();
  const clientSecret = process.env.TRADOVATE_CLIENT_SECRET?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return Boolean(clientId && clientSecret && siteUrl);
}

export function getTradovateOAuthRedirectUri(fallbackOrigin?: string): string {
  return `${getSiteOrigin(fallbackOrigin)}/api/brokers/tradovate/callback`;
}

export function getTradovateOAuthAuthorizeUrl(
  environment: TradovateEnvironment,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const authBase =
    environment === "live"
      ? "https://trader.tradovate.com/oauth"
      : "https://trader-d.tradovate.com/oauth";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  return `${authBase}?${params.toString()}`;
}

/** Official OAuth example uses /auth/oauthtoken without /v1. */
export function getTradovateOAuthTokenUrls(environment: TradovateEnvironment): string[] {
  const host =
    environment === "live" ? "https://live.tradovateapi.com" : "https://demo.tradovateapi.com";
  return [`${host}/auth/oauthtoken`, `${host}/v1/auth/oauthtoken`];
}
