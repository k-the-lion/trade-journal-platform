"use client";

import { useState, useTransition } from "react";
import { deleteAllTrades } from "@/lib/actions";

export function DeleteAllTradesPanel({ tradeCount }: { tradeCount: number }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const canDelete = confirmText === "DELETE" && tradeCount > 0;

  function handleDelete() {
    if (!canDelete) return;
    startTransition(async () => {
      await deleteAllTrades();
      setOpen(false);
      setConfirmText("");
      window.location.href = "/dashboard";
    });
  }

  if (tradeCount === 0) return null;

  return (
    <div className="card p-4 border-danger/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-sm text-danger">Danger zone</h3>
          <p className="text-xs text-muted mt-1">
            Permanently delete all {tradeCount} trades and import history. Trading
            accounts are kept.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger text-sm"
          onClick={() => setOpen(true)}
        >
          Delete all trades permanently
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="card p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold text-lg text-danger">
              Permanently delete all trades?
            </h3>
            <p className="text-sm text-muted">
              This will <strong className="text-foreground">permanently delete</strong>{" "}
              all {tradeCount} trades from the database, including journal notes,
              moods, strategies, tags, screenshots, and import job history. This
              cannot be undone.
            </p>
            <p className="text-sm text-muted">
              Type <strong className="text-foreground">DELETE</strong> to confirm:
            </p>
            <input
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger text-sm"
                onClick={handleDelete}
                disabled={!canDelete || pending}
              >
                {pending ? "Deleting..." : "Delete all permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
