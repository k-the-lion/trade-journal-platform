"use client";

import { useState, useTransition } from "react";
import { createTradingAccount, updateTradingAccount } from "@/lib/actions";
import type { AccountType, TradingAccount } from "@/lib/types/database";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  eval: "Eval",
  funded: "Funded",
  personal: "Personal",
};

export function AccountManager({
  accounts,
  onAccountsChange,
  showCreate = false,
  variant = "embedded",
}: {
  accounts: TradingAccount[];
  onAccountsChange: (accounts: TradingAccount[]) => void;
  showCreate?: boolean;
  variant?: "embedded" | "settings";
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBroker, setNewBroker] = useState("");
  const [newType, setNewType] = useState<AccountType | "">("");
  const [newDefault, setNewDefault] = useState(false);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Account name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createTradingAccount({
          name: newName.trim(),
          broker: newBroker.trim() || null,
          account_type: newType || null,
          is_default: newDefault || accounts.length === 0,
        });
        const row = created as TradingAccount;
        onAccountsChange(
          row.is_default
            ? [row, ...accounts.map((a) => ({ ...a, is_default: false }))]
            : [...accounts, row]
        );
        setNewName("");
        setNewBroker("");
        setNewType("");
        setNewDefault(false);
        setCreating(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create account");
      }
    });
  }

  const wrapperClass =
    variant === "settings"
      ? "space-y-3"
      : "space-y-2 p-3 rounded-lg border border-border/60 bg-background/40";

  return (
    <div className={wrapperClass}>
      {error && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-md p-2">
          {error}
        </p>
      )}

      {showCreate && (
        <div className="space-y-2">
          {!creating && accounts.length > 0 ? (
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setCreating(true)}
            >
              + Add account
            </button>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3 p-3 rounded-lg border border-border/60 bg-background/30">
              <p className="text-sm font-medium">
                {accounts.length === 0 ? "Create your first account" : "New account"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Topstep 50K Eval"
                    required
                  />
                </div>
                <div>
                  <label className="label">Broker (optional)</label>
                  <input
                    className="input"
                    value={newBroker}
                    onChange={(e) => setNewBroker(e.target.value)}
                    placeholder="TopstepX, Tradovate…"
                  />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select
                    className="input"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as AccountType | "")}
                  >
                    <option value="">—</option>
                    <option value="eval">Eval</option>
                    <option value="funded">Funded</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm self-end pb-2">
                  <input
                    type="checkbox"
                    checked={newDefault}
                    onChange={(e) => setNewDefault(e.target.checked)}
                  />
                  Default account
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary text-sm" disabled={pending}>
                  {pending ? "Creating…" : "Create account"}
                </button>
                {accounts.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {accounts.length === 0 && !showCreate && (
        <p className="text-sm text-muted">No trading accounts yet.</p>
      )}

      {accounts.map((account) => (
        <div
          key={account.id}
          className={`flex flex-wrap items-center gap-2 py-2 ${
            variant === "settings" ? "border-b border-border/40 last:border-0" : "py-1.5 border-b border-border/40 last:border-0"
          }`}
        >
          {editingId === account.id ? (
            <form
              onSubmit={handleUpdate}
              className="flex flex-wrap items-end gap-2 w-full"
            >
              <div className="flex-1 min-w-[140px]">
                <label className="label">Name</label>
                <input
                  name="name"
                  className="input text-sm"
                  defaultValue={account.name}
                  required
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="label">Broker</label>
                <input
                  name="broker"
                  className="input text-sm"
                  defaultValue={account.broker ?? ""}
                  placeholder="Optional"
                />
              </div>
              <div className="min-w-[120px]">
                <label className="label">Type</label>
                <select
                  name="account_type"
                  className="input text-sm"
                  defaultValue={account.account_type ?? ""}
                >
                  <option value="">—</option>
                  <option value="eval">Eval</option>
                  <option value="funded">Funded</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <label className="text-xs text-muted flex items-center gap-1.5 shrink-0 pb-2">
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
                  ★ Default
                </span>
              )}
              <button
                type="button"
                className="text-xs text-primary hover:underline ml-auto"
                onClick={() => setEditingId(account.id)}
              >
                Edit
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
