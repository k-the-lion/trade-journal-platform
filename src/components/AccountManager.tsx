"use client";

import { useState, useTransition } from "react";
import { updateTradingAccount } from "@/lib/actions";
import type { AccountType, TradingAccount } from "@/lib/types/database";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  eval: "Eval",
  funded: "Funded",
  personal: "Personal",
};

export function AccountManager({
  accounts,
  onAccountsChange,
}: {
  accounts: TradingAccount[];
  onAccountsChange: (accounts: TradingAccount[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const updated = await updateTradingAccount(editingId, {
          name: String(fd.get("name")),
          broker: String(fd.get("broker") || "") || null,
          account_type: (String(fd.get("account_type") || "") || null) as
            | AccountType
            | null,
          is_default: fd.get("is_default") === "on",
        });
        onAccountsChange(
          accounts.map((a) => {
            if (a.id === editingId) return updated as TradingAccount;
            if (updated.is_default && a.is_default) {
              return { ...a, is_default: false };
            }
            return a;
          })
        );
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update account");
      }
    });
  }

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-background/40">
      {error && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-md p-2">
          {error}
        </p>
      )}
      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex flex-wrap items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
        >
          {editingId === account.id ? (
            <form
              onSubmit={handleUpdate}
              className="flex flex-wrap items-end gap-2 w-full"
            >
              <input
                name="name"
                className="input text-sm flex-1 min-w-[140px]"
                defaultValue={account.name}
                placeholder="Account name"
                required
              />
              <input
                name="broker"
                className="input text-sm flex-1 min-w-[120px]"
                defaultValue={account.broker ?? ""}
                placeholder="Broker (optional)"
              />
              <select
                name="account_type"
                className="input text-sm"
                defaultValue={account.account_type ?? ""}
              >
                <option value="">Type —</option>
                <option value="eval">Eval</option>
                <option value="funded">Funded</option>
                <option value="personal">Personal</option>
              </select>
              <label className="text-xs text-muted flex items-center gap-1.5 shrink-0">
                <input
                  type="checkbox"
                  name="is_default"
                  defaultChecked={account.is_default}
                />
                Default
              </label>
              <button
                type="submit"
                className="btn btn-primary text-xs py-1.5 px-3"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <span className="text-sm font-medium">{account.name}</span>
              {account.broker && (
                <span className="text-xs text-muted">{account.broker}</span>
              )}
              {account.account_type && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted">
                  {ACCOUNT_TYPE_LABELS[account.account_type]}
                </span>
              )}
              {account.is_default && (
                <span className="text-xs text-primary" title="Default account">
                  ★
                </span>
              )}
              <button
                type="button"
                className="text-xs text-primary hover:underline ml-auto"
                onClick={() => setEditingId(account.id)}
              >
                Rename
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
