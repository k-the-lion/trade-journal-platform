import { NextResponse } from "next/server";
import { getSiteOrigin } from "@/lib/auth/site-url";
import { getTradovateOAuthRedirectUri } from "@/lib/brokers/tradovate/oauth-config";
import {
  tradovateExchangeOAuthCode,
  tradovateGetOAuthUser,
} from "@/lib/brokers/tradovate/oauth";
import {
  consumeTradovateOAuthState,
  setTradovateOAuthPendingSession,
} from "@/lib/brokers/tradovate/oauth-session";

export const dynamic = "force-dynamic";

function oauthResultHtml(payload: { ok: boolean; error?: string }) {
  const body = JSON.stringify(payload);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Tradovate connection</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0f14; color: #e8edf4; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    p { color: #9aa8b8; }
  </style>
</head>
<body>
  <div>
    <p>${payload.ok ? "Connected. You can close this window." : "Connection failed."}</p>
  </div>
  <script>
    (function () {
      var payload = ${body};
      var targetOrigin = ${JSON.stringify(getSiteOrigin())};
      if (window.opener) {
        window.opener.postMessage({ type: "tradovate-oauth", ...payload }, targetOrigin);
        window.close();
        setTimeout(function () { window.location.href = "/import"; }, 800);
      } else {
        window.location.href = payload.ok
          ? "/import?tradovate=connected"
          : "/import?tradovate_error=" + encodeURIComponent(payload.error || "oauth_failed");
      }
    })();
  </script>
</body>
</html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return new NextResponse(
      oauthResultHtml({ ok: false, error: oauthError }),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code || !state) {
    return new NextResponse(oauthResultHtml({ ok: false, error: "missing_code" }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const environment = await consumeTradovateOAuthState(state);
  if (!environment) {
    return new NextResponse(oauthResultHtml({ ok: false, error: "invalid_state" }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const redirectUri = getTradovateOAuthRedirectUri(new URL(request.url).origin);
    const tokenData = await tradovateExchangeOAuthCode(environment, code, redirectUri);
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken || !refreshToken) {
      throw new Error("Tradovate did not return connection tokens");
    }

    const profile = await tradovateGetOAuthUser(environment, accessToken);
    const username =
      profile.name?.trim() ||
      profile.email?.trim() ||
      (profile.userId ? `user-${profile.userId}` : "tradovate-user");
    const displayName = profile.fullName?.trim() || username;

    await setTradovateOAuthPendingSession({
      refreshToken,
      accessToken,
      environment,
      username,
      displayName,
    });

    return new NextResponse(oauthResultHtml({ ok: true }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return new NextResponse(oauthResultHtml({ ok: false, error: message }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
