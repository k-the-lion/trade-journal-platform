"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Picks up Supabase email links that return tokens in the URL hash. */
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    const supabase = createClient();
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data.session) {
        window.history.replaceState(null, "", window.location.pathname);
        router.replace("/dashboard");
      }
    });
  }, [router]);

  return null;
}
