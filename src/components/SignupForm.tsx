"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/auth/site-url";
import type { AuthError } from "@supabase/supabase-js";

function formatAuthError(error: AuthError): string {
  if (error.message?.trim()) return error.message;
  const extended = error as AuthError & { msg?: string };
  if (extended.msg?.trim()) return extended.msg;
  if (error.code) return `Sign up failed (${error.code}). Check Supabase setup.`;
  return "Sign up failed. Please try again.";
}

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsEmailConfirm(false);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });

      if (error) {
        setError(formatAuthError(error));
        setLoading(false);
        return;
      }

      if (data.user && !data.session) {
        setNeedsEmailConfirm(true);
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4 w-full max-w-md">
      <h1 className="text-xl font-semibold">Create account</h1>
      {error && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md p-3">
          {error}
        </p>
      )}
      {needsEmailConfirm && (
        <div className="text-sm text-success bg-success/10 border border-success/30 rounded-md p-3 space-y-1">
          <p>Check your email to confirm your account.</p>
          <p className="text-muted text-xs">
            Open the link within an hour. If it expires, go to{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            and request a new confirmation email.
          </p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="fullName">Full name</label>
        <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Creating..." : "Sign up"}
      </button>
      <p className="text-sm text-muted text-center">
        Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
