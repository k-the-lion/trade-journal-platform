"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  authErrorCodeFromUrl,
  isAuthCallbackError,
} from "@/lib/auth/errors";

/** Handles legacy hash-token email links (#access_token=...) that skip the route handler. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    async function run() {
      const url = new URL(window.location.href);

      if (isAuthCallbackError(url)) {
        const code = authErrorCodeFromUrl(url);
        router.replace(`/login?error=${encodeURIComponent(code)}`);
        return;
      }

      if (url.searchParams.get("code")) {
        return;
      }

      const hash = url.hash.replace(/^#/, "");
      if (!hash) {
        router.replace("/login?error=missing_code");
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace("/login?error=otp_expired");
        return;
      }

      setMessage("Success! Redirecting…");
      router.replace("/dashboard");
    }

    void run();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <p className="text-muted text-sm">{message}</p>
    </main>
  );
}
