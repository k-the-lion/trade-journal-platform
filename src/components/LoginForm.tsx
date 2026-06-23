"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AUTH_ERROR_MESSAGES, resolveAuthErrorMessage } from "@/lib/auth/errors";
import { getAuthCallbackUrl } from "@/lib/auth/site-url";

const RESEND_ERRORS = new Set(["otp_expired", "access_denied", "email_not_confirmed"]);

function LoginFormInner() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error") ?? searchParams.get("error_code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    resolveAuthErrorMessage(urlError)
  );
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const showResend = urlError ? RESEND_ERRORS.has(urlError) : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const code = error.message.toLowerCase().includes("email not confirmed")
        ? "email_not_confirmed"
        : error.message;
      setError(resolveAuthErrorMessage(code) ?? error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError("Enter your email above, then click resend confirmation.");
      return;
    }
    setResending(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    setResending(false);
    if (error) {
      setError(error.message);
    } else {
      setInfo("New confirmation email sent. Check your inbox and open the link within an hour.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4 w-full max-w-md">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {error && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md p-3">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-success bg-success/10 border border-success/30 rounded-md p-3">
          {info}
        </p>
      )}
      {showResend && (
        <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-2">
          <p className="text-xs text-muted">
            Confirmation link expired or invalid? Enter your email and request a fresh one.
          </p>
          <button
            type="button"
            className="btn btn-secondary text-sm w-full"
            disabled={resending}
            onClick={handleResend}
          >
            {resending ? "Sending…" : "Resend confirmation email"}
          </button>
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-sm text-muted text-center">
        No account? <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
      </p>
      {urlError && AUTH_ERROR_MESSAGES[urlError] && (
        <p className="text-xs text-muted text-center">
          You can also sign in with your password if you already confirmed your email.
        </p>
      )}
    </form>
  );
}

export function LoginForm() {
  return <LoginFormInner />;
}
