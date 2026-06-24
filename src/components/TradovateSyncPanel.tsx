"use client";

import Link from "next/link";
import { useState } from "react";
import { createTradingAccount } from "@/lib/actions";
import {
  connectTradovate,
  disconnectBrokerSync,
  syncTradovateConnection,
  updateBrokerSyncMode,
  verifyTradovateCredentials,
  type BrokerSyncMode,
  type TradovateAccountOption,
} from "@/lib/actions/broker-sync";
import type { TradovateEnvironment } from "@/lib/brokers/tradovate/types";
import type { BrokerSyncConnectionPublic } from "@/lib/types/database";

type AccountOption = { id: string; name: string; is_default?: boolean };

export function TradovateSyncPanel({
  connections: initialConnections,
  accountOptions: initialAccountOptions,
  strategyOptions = [],
  orgOptions = [],
}: {
  connections: BrokerSyncConnectionPublic[];
  accountOptions: AccountOption[];
  strategyOptions?: { id: string; name: string }[];
  orgOptions?: { id: string; name: string }[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [accountOptions, setAccountOptions] = useState(initialAccountOptions);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cid, setCid] = useState("");
  const [sec, setSec] = useState("");
  const [appId, setAppId] = useState("TradeJournal");
  const [environment, setEnvironment] = useState<TradovateEnvironment>("live");
  const [tradovateAccounts, setTradovateAccounts] = useState<TradovateAccountOption[]>([]);
  const [externalAccountId, setExternalAccountId] = useState("");
  const [tradingAccountId, setTradingAccountId] = useState(
    initialAccountOptions.find((a) => a.is_default)?.id ??
      initialAccountOptions[0]?.id ??
      ""
  );
  const [strategyId, setStrategyId] = useState("");
  const [syncFrom, setSyncFrom] = useState("");
  const [syncMode, setSyncMode] = useState<BrokerSyncMode>("manual");
  const [orgId, setOrgId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreateAccount, setShowCreateAccount] = useState(
    initialAccountOptions.length === 0
  );
  const [newAccountName, setNewAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const credentialInput = {
    username,
    password,
    cid,
    sec,
    appId,
    environment,
  };

  async function handleCreateAccount() {
    if (!newAccountName.trim()) {
      setError("Account name is required");
      return;
    }
    setCreatingAccount(true);
    setError(null);
    try {
      const account = await createTradingAccount({
        name: newAccountName.trim(),
        broker: "Tradovate",
        account_type: "eval",
        is_default: accountOptions.length === 0,
      });
      const option = {
        id: account.id,
        name: account.name,
        is_default: account.is_default,
      };
      setAccountOptions((prev) => [...prev, option]);
      setTradingAccountId(account.id);
      setShowCreateAccount(false);
      setNewAccountName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreatingAccount(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setError(null);
    setMessage(null);
    setTradovateAccounts([]);
    setExternalAccountId("");
    try {
      const { accounts } = await verifyTradovateCredentials(credentialInput);
      setTradovateAccounts(accounts);
      if (accounts.length === 1) {
        setExternalAccountId(String(accounts[0]!.id));
      }
      setMessage(`Found ${accounts.length} Tradovate account${accounts.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function handleConnect() {
    if (!externalAccountId || !tradingAccountId) {
      setError("Select both a Tradovate account and a journal account");
      return;
    }
    const selected = tradovateAccounts.find((a) => String(a.id) === externalAccountId);
    if (!selected) {
      setError("Select a Tradovate account");
      return;
    }

    setConnecting(true);
    setError(null);
    setMessage(null);
    try {
      const connection = await connectTradovate({
        ...credentialInput,
        externalAccountId: selected.id,
        externalAccountName: selected.name,
        tradingAccountId,
        strategyId: strategyId || null,
        syncFrom: syncFrom || null,
        orgId: orgId || null,
        syncMode,
      });
      setConnections((prev) => {
        const without = prev.filter((c) => c.id !== connection.id);
        return [connection, ...without];
      });
      setPassword("");
      setSec("");
      setMessage(
        `Connected to ${selected.name}.` +
          (syncMode === "auto"
            ? " Auto-sync every 15 minutes is on — run Sync now for an immediate import."
            : " Run Sync now when you want to import trades.")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId);
    setError(null);
    setMessage(null);
    try {
      const result = await syncTradovateConnection(connectionId);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId
            ? {
                ...c,
                last_synced_at: new Date().toISOString(),
                last_sync_status: "success",
                last_sync_error: null,
                last_sync_imported: result.imported,
              }
            : c
        )
      );
      setMessage(
        `Synced ${result.imported} new trade${result.imported === 1 ? "" : "s"}` +
          (result.duplicatesSkipped > 0
            ? ` (${result.duplicatesSkipped} duplicates skipped)`
            : "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId
            ? {
                ...c,
                last_sync_status: "error",
                last_sync_error: err instanceof Error ? err.message : "Sync failed",
              }
            : c
        )
      );
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSyncModeChange(connectionId: string, mode: BrokerSyncMode) {
    setError(null);
    try {
      const updated = await updateBrokerSyncMode(connectionId, mode);
      setConnections((prev) =>
        prev.map((c) => (c.id === connectionId ? { ...c, ...updated } : c))
      );
      setMessage(
        mode === "auto"
          ? "Auto-sync enabled — trades import every 15 minutes."
          : "Manual sync only — use Sync now when you want fresh trades."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sync mode");
    }
  }

  async function handleDisconnect(connectionId: string) {
    if (!confirm("Disconnect this Tradovate account? Your imported trades will stay in the journal.")) {
      return;
    }
    setError(null);
    try {
      await disconnectBrokerSync(connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      setMessage("Disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }

  const selectedTradovateName = tradovateAccounts.find(
    (a) => String(a.id) === externalAccountId
  )?.name;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="font-medium">Connect Tradovate</h2>
          <p className="text-xs text-muted mt-1">
            Requires Tradovate{" "}
            <a
              href="https://tradovate.com/api-access/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              API Access
            </a>{" "}
            ($25/mo) and an API key from Application Settings. Works with Apex, Tradeify, TPT, and
            other Tradovate-based prop firms when API is enabled on the account.
          </p>
        </div>

        <div>
          <label className="label">Environment</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["live", "Live"],
                ["demo", "Demo / Sim"],
              ] as const
            ).map(([env, label]) => (
              <button
                key={env}
                type="button"
                onClick={() => setEnvironment(env)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  environment === env
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1">
            Use Demo for sim/eval accounts; Live for funded brokerage accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Tradovate username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Login username"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Account or API password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">API Client ID (cid)</label>
            <input
              className="input"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              placeholder="Numeric ID from API key"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">API Secret</label>
            <input
              className="input"
              type="password"
              value={sec}
              onChange={(e) => setSec(e.target.value)}
              placeholder="Secret shown once at key creation"
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">API key name (appId)</label>
            <input
              className="input"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="Name you gave the API key"
              autoComplete="off"
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary text-sm"
          disabled={
            verifying ||
            !username.trim() ||
            !password.trim() ||
            !cid.trim() ||
            !sec.trim()
          }
          onClick={handleVerify}
        >
          {verifying ? "Verifying…" : "Verify & load accounts"}
        </button>

        {tradovateAccounts.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border/60">
            <div>
              <label className="label">Tradovate account</label>
              <select
                className="input"
                value={externalAccountId}
                onChange={(e) => setExternalAccountId(e.target.value)}
              >
                <option value="">Select account…</option>
                {tradovateAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-medium text-sm">Journal account</h3>
                  <p className="text-xs text-muted mt-0.5">
                    Where synced trades appear in reports and filters.
                  </p>
                </div>
                {accountOptions.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setShowCreateAccount((v) => !v)}
                  >
                    {showCreateAccount ? "Cancel" : "+ New account"}
                  </button>
                )}
              </div>

              {showCreateAccount && (
                <div className="flex flex-wrap gap-2">
                  <input
                    className="input flex-1 min-w-[160px]"
                    placeholder="e.g. Apex 50K Eval"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    disabled={creatingAccount}
                    onClick={handleCreateAccount}
                  >
                    {creatingAccount ? "Creating…" : "Create"}
                  </button>
                </div>
              )}

              {accountOptions.length > 0 ? (
                <select
                  className="input"
                  value={tradingAccountId}
                  onChange={(e) => setTradingAccountId(e.target.value)}
                >
                  <option value="">Select journal account…</option>
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.is_default ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                !showCreateAccount && (
                  <p className="text-sm text-muted">Create a journal account to continue.</p>
                )
              )}
            </div>

            <div>
              <label className="label">Strategy (optional)</label>
              <select
                className="input"
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
              >
                <option value="">Don&apos;t set — assign later</option>
                {strategyOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Sync schedule</label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["manual", "Manual only"],
                    ["auto", "Auto every 15 min"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSyncMode(mode)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      syncMode === mode
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Sync trades from (optional)</label>
              <input
                className="input"
                type="date"
                value={syncFrom}
                onChange={(e) => setSyncFrom(e.target.value)}
              />
              <p className="text-xs text-muted mt-1">
                Leave empty to pull up to 12 months of Position History on first sync.
              </p>
            </div>

            {orgOptions.length > 0 && (
              <div>
                <label className="label">Organization (optional)</label>
                <select className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                  <option value="">Solo (none)</option>
                  {orgOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={connecting || !externalAccountId || !tradingAccountId}
              onClick={handleConnect}
            >
              {connecting
                ? "Connecting…"
                : `Connect${selectedTradovateName ? ` ${selectedTradovateName}` : ""}`}
            </button>
          </div>
        )}
      </div>

      {connections.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-medium text-sm">Connected accounts</h2>
          </div>
          <ul className="divide-y divide-border/50">
            {connections.map((c) => (
              <li key={c.id} className="px-4 py-4 space-y-3">
                <div>
                  <p className="font-medium text-sm">
                    {c.external_account_name ?? c.label ?? "Tradovate account"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    User: {c.username}
                    {(c.auto_sync ?? false) ? " · Auto-sync every 15 min" : " · Manual sync"}
                    {c.last_synced_at
                      ? ` · Last sync ${new Date(c.last_synced_at).toLocaleString()}`
                      : " · Never synced"}
                  </p>
                  {c.last_sync_status === "error" && c.last_sync_error && (
                    <p className="text-xs text-danger mt-1">{c.last_sync_error}</p>
                  )}
                  {c.last_sync_status === "success" && c.last_sync_imported > 0 && (
                    <p className="text-xs text-muted mt-1">
                      Last run imported {c.last_sync_imported} trade
                      {c.last_sync_imported === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["manual", "Manual"],
                      ["auto", "Auto 15 min"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSyncModeChange(c.id, mode)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        ((c.auto_sync ?? false) ? "auto" : "manual") === mode
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary text-sm py-1.5 px-3"
                    disabled={syncingId === c.id}
                    onClick={() => handleSync(c.id)}
                  >
                    {syncingId === c.id ? "Syncing…" : "Sync now"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm py-1.5 px-3"
                    onClick={() => handleDisconnect(c.id)}
                  >
                    Disconnect
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && (
        <div className="text-sm rounded-md p-3 border border-success/30 bg-success/10 text-success">
          {message}{" "}
          {message.includes("Synced") && (
            <Link href="/dashboard" className="underline font-medium">
              View dashboard
            </Link>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm rounded-md p-3 border border-danger/30 bg-danger/10 text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
