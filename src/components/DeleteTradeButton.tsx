"use client";

import { useState, useTransition } from "react";
import { deleteTrade } from "@/lib/actions";

export function DeleteTradeButton({
  tradeId,
  tradeLabel,
  redirectTo,
  onDeleted,
  className = "btn btn-danger text-sm",
}: {
  tradeId: string;
  tradeLabel?: string;
  redirectTo?: string;
  onDeleted?: (tradeId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteTrade(tradeId);
      setOpen(false);
      if (onDeleted) {
        onDeleted(tradeId);
      } else if (redirectTo) {
        window.location.href = redirectTo;
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        Permanently delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="card p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold text-lg">Permanently delete trade?</h3>
            <p className="text-sm text-muted">
              {tradeLabel ? (
                <>
                  <span className="text-foreground">{tradeLabel}</span> will be
                  removed from the database forever, including journal notes,
                  tags, and screenshots. This cannot be undone.
                </>
              ) : (
                <>
                  This trade will be removed from the database forever,
                  including journal notes, tags, and screenshots. This cannot be
                  undone.
                </>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger text-sm"
                onClick={handleDelete}
                disabled={pending}
              >
                {pending ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
