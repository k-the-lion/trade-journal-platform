import { cookies } from "next/headers";
import { encryptJson, decryptJson } from "@/lib/crypto/credentials";
import type { TradovateEnvironment } from "./types";
import {
  TRADOVATE_OAUTH_SESSION_COOKIE,
  TRADOVATE_OAUTH_STATE_COOKIE,
} from "./oauth-config";

export type TradovateOAuthPendingSession = {
  refreshToken: string;
  accessToken: string;
  environment: TradovateEnvironment;
  username: string;
  displayName: string;
};

const SESSION_MAX_AGE = 60 * 15;

export async function setTradovateOAuthState(state: string, environment: TradovateEnvironment) {
  const jar = await cookies();
  jar.set(TRADOVATE_OAUTH_STATE_COOKIE, `${state}:${environment}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function consumeTradovateOAuthState(
  state: string
): Promise<TradovateEnvironment | null> {
  const jar = await cookies();
  const raw = jar.get(TRADOVATE_OAUTH_STATE_COOKIE)?.value;
  jar.delete(TRADOVATE_OAUTH_STATE_COOKIE);

  if (!raw) return null;
  const [savedState, environment] = raw.split(":");
  if (savedState !== state) return null;
  return environment === "demo" ? "demo" : "live";
}

export async function setTradovateOAuthPendingSession(session: TradovateOAuthPendingSession) {
  const jar = await cookies();
  jar.set(TRADOVATE_OAUTH_SESSION_COOKIE, encryptJson(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getTradovateOAuthPendingSession(): Promise<TradovateOAuthPendingSession | null> {
  const jar = await cookies();
  const raw = jar.get(TRADOVATE_OAUTH_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decryptJson<TradovateOAuthPendingSession>(raw);
  } catch {
    return null;
  }
}

export async function clearTradovateOAuthPendingSession() {
  const jar = await cookies();
  jar.delete(TRADOVATE_OAUTH_SESSION_COOKIE);
}
