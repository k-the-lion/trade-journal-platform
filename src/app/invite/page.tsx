"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { acceptInvite } from "@/lib/actions";

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await acceptInvite(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="card p-6 text-center max-w-md">
        <p className="text-muted">Invalid invite link.</p>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4 max-w-md w-full text-center">
      <h1 className="text-xl font-semibold">Accept invite</h1>
      <p className="text-sm text-muted">Join your coach&apos;s trading group.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button onClick={handleAccept} className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Joining..." : "Accept invite"}
      </button>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-muted">Loading...</div>}>
        <InviteContent />
      </Suspense>
    </main>
  );
}
