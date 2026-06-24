import type { TradovateEnvironment } from "./types";
import { TradovateApiError } from "./client";
import {
  getTradovateOAuthRedirectUri,
  getTradovateOAuthTokenUrls,
} from "./oauth-config";

export type TradovateOAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

export type TradovateOAuthUser = {
  userId?: number;
  fullName?: string;
  email?: string;
  name?: string;
};

function getOAuthClientCredentials() {
  const clientId = process.env.TRADOVATE_CLIENT_ID?.trim();
  const clientSecret = process.env.TRADOVATE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new TradovateApiError(
      "Tradovate OAuth is not configured. Set TRADOVATE_CLIENT_ID and TRADOVATE_CLIENT_SECRET."
    );
  }
  return { clientId, clientSecret };
}

async function parseOAuthTokenResponse(
  res: Response,
  text: string
): Promise<TradovateOAuthTokenResponse> {
  let data: TradovateOAuthTokenResponse;
  try {
    data = JSON.parse(text) as TradovateOAuthTokenResponse;
  } catch {
    throw new TradovateApiError(
      `OAuth token exchange failed: ${text.slice(0, 160)}`,
      res.status
    );
  }

  if (!res.ok || data.error) {
    throw new TradovateApiError(
      data.error_description || data.error || `OAuth failed (HTTP ${res.status})`,
      res.status
    );
  }

  return data;
}

async function postOAuthToken(
  environment: TradovateEnvironment,
  body: Record<string, string>
): Promise<TradovateOAuthTokenResponse> {
  const urls = getTradovateOAuthTokenUrls(environment);
  let lastError: Error | null = null;

  for (const url of urls) {
    for (const mode of ["form", "json"] as const) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers:
            mode === "form"
              ? {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Accept: "application/json",
                }
              : {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
          body:
            mode === "form"
              ? new URLSearchParams(body).toString()
              : JSON.stringify(body),
        });

        const text = await res.text();
        return await parseOAuthTokenResponse(res, text);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw lastError ?? new TradovateApiError("OAuth token exchange failed");
}

export async function tradovateExchangeOAuthCode(
  environment: TradovateEnvironment,
  code: string,
  redirectUri = getTradovateOAuthRedirectUri()
): Promise<TradovateOAuthTokenResponse> {
  const { clientId, clientSecret } = getOAuthClientCredentials();
  return postOAuthToken(environment, {
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
}

export async function tradovateRefreshOAuthToken(
  environment: TradovateEnvironment,
  refreshToken: string
): Promise<TradovateOAuthTokenResponse> {
  const { clientId, clientSecret } = getOAuthClientCredentials();
  return postOAuthToken(environment, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
}

export async function tradovateGetOAuthUser(
  environment: TradovateEnvironment,
  accessToken: string
): Promise<TradovateOAuthUser> {
  const base =
    environment === "live"
      ? "https://live.tradovateapi.com/v1"
      : "https://demo.tradovateapi.com/v1";

  const res = await fetch(`${base}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new TradovateApiError(
      `Could not load Tradovate profile (HTTP ${res.status})`,
      res.status
    );
  }

  try {
    return JSON.parse(text) as TradovateOAuthUser;
  } catch {
    throw new TradovateApiError("Invalid Tradovate profile response");
  }
}
