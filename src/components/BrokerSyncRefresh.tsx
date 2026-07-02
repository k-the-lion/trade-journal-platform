"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncAllBrokerConnections } from "@/lib/actions/broker-sync";

export function BrokerSyncRefresh({
  connectionCount,
}: {
  connectionCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (connectionCount === 0) return null;

  function handleSync() {
    setStatus(null);
    setError(null);

    startTransition(async () => {
      try {
        const results = await syncAllBrokerConnections();
        const imported = results.reduce((sum, r) => sum + r.imported, 0);
        const backfilled = results.reduce((sum, r) => sum + r.backfilled, 0);
        const failed = results.filter((r) => r.error);

        if (failed.length === results.length) {
          setError(failed[0]?.error ?? "Sync failed");
          return;
        }

        const parts: string[] = [];
        if (imported > 0) parts.push(`${imported} new`);
        if (backfilled > 0) parts.push(`${backfilled} updated`);
        if (parts.length === 0) parts.push("Up to date");

        setStatus(parts.join(" · "));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={handleSync}
        disabled={pending}
        className="btn btn-secondary text-sm"
      >
        {pending ? "Syncing…" : "Sync connections"}
      </button>
      {status && <p className="text-xs text-success">{status}</p>}
      {error && <p className="text-xs text-danger max-w-[14rem] text-right">{error}</p>}
    </div>
  );
}
