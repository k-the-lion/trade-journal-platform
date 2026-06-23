export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  profile_setup:
    "Your account exists but the app could not load your profile. Try signing in again.",
  auth: "Email confirmation failed. Try signing in with your password instead.",
  missing_code: "Invalid confirmation link. Sign in with your email and password.",
  otp_expired:
    "That confirmation link has expired. Sign in with your password below, or request a new confirmation email.",
  access_denied:
    "Email confirmation could not be completed. Try signing in with your password, or request a new link.",
  email_not_confirmed:
    "Please confirm your email before signing in. Check your inbox or request a new confirmation email below.",
};

export function resolveAuthErrorMessage(
  codeOrMessage: string | null | undefined
): string | null {
  if (!codeOrMessage) return null;
  const key = codeOrMessage.trim();
  if (AUTH_ERROR_MESSAGES[key]) return AUTH_ERROR_MESSAGES[key];
  try {
    const decoded = decodeURIComponent(key.replace(/\+/g, " "));
    if (AUTH_ERROR_MESSAGES[decoded]) return AUTH_ERROR_MESSAGES[decoded];
    if (decoded.length > 0 && decoded.length < 200) return decoded;
  } catch {
    // ignore
  }
  return "Sign in failed. Please try again.";
}

export function isAuthCallbackError(url: URL): boolean {
  return Boolean(
    url.searchParams.get("error_code") ||
      url.searchParams.get("error_description") ||
      (url.searchParams.get("error") &&
        url.searchParams.get("error") !== "profile_setup")
  );
}

export function authErrorCodeFromUrl(url: URL): string {
  return (
    url.searchParams.get("error_code") ??
    url.searchParams.get("error") ??
    "access_denied"
  );
}
