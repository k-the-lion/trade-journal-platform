import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import {
  getTradovateOAuthAuthorizeUrl,
  getTradovateOAuthRedirectUri,
  isTradovateOAuthConfigured,
} from "@/lib/brokers/tradovate/oauth-config";
import { setTradovateOAuthState } from "@/lib/brokers/tradovate/oauth-session";
import type { TradovateEnvironment } from "@/lib/brokers/tradovate/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.redirect(new URL("/login?next=/import", request.url));
  }

  if (!isTradovateOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/import?tradovate_error=oauth_not_configured", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const environment: TradovateEnvironment =
    searchParams.get("environment") === "demo" ? "demo" : "live";

  const clientId = process.env.TRADOVATE_CLIENT_ID!.trim();
  const state = randomBytes(24).toString("hex");
  await setTradovateOAuthState(state, environment);

  const redirectUri = getTradovateOAuthRedirectUri(new URL(request.url).origin);
  const authorizeUrl = getTradovateOAuthAuthorizeUrl(
    environment,
    clientId,
    redirectUri,
    state
  );

  return NextResponse.redirect(authorizeUrl);
}
