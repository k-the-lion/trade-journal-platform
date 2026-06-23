import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  authErrorCodeFromUrl,
  isAuthCallbackError,
} from "@/lib/auth/errors";
import { getAuthCallbackUrl, getSiteOrigin } from "@/lib/auth/site-url";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const origin = getSiteOrigin(requestUrl.origin);
  const next = searchParams.get("next") ?? "/dashboard";

  if (isAuthCallbackError(requestUrl)) {
    const code = authErrorCodeFromUrl(requestUrl);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(code)}`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const redirectTo = `${origin}${next}`;
  let response = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
          response = NextResponse.redirect(redirectTo);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const mapped =
      error.message.toLowerCase().includes("expired") ||
      error.message.toLowerCase().includes("invalid")
        ? "otp_expired"
        : error.message;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(mapped)}`
    );
  }

  return response;
}
