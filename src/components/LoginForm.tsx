"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  profile_setup:
    "Your account exists but the app could not load your profile. Try signing in again.",
  auth: "Email confirmation failed. Try signing in with your password instead.",
  missing_code: "Invalid confirmation link. Sign in with your email and password.",
};

function LoginFormInner() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    urlError ? ERROR_MESSAGES[urlError] ?? decodeURIComponent(urlError) : null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
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
    </form>
  );
}

export function LoginForm() {
  return <LoginFormInner />;
}
