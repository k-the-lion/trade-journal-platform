"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createTradingAccount } from "@/lib/actions";
import {
  connectTradovateOAuth,
  disconnectBrokerSync,
  loadTradovateOAuthAccounts,
  syncTradovateConnection,
  updateBrokerSyncMode,
  type BrokerSyncMode,
  type TradovateAccountOption,
} from "@/lib/actions/broker-sync";
import type { TradovateEnvironment } from "@/lib/brokers/tradovate/types";
import type { BrokerSyncConnectionPublic } from "@/lib/types/database";

type AccountOption = { id: string; name: string; is_default?: boolean };

export function TradovateSyncPanel({
  oauthConfigured,
  oauthRedirectUri,
  connections: initialConnections,
  accountOptions: initialAccountOptions,
  strategyOptions = [],
  orgOptions = [],
}: {
  oauthConfigured: boolean;
  oauthRedirectUri: string;
  connections: BrokerSyncConnectionPublic[];
  accountOptions: AccountOption[];
  strategyOptions?: { id: string; name: string }[];
  orgOptions?: { id: string; name: string }[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [accountOptions, setAccountOptions] = useState(initialAccountOptions);
  const [environment, setEnvironment] = useState<TradovateEnvironment>("live");
  const [tradovateUser, setTradovateUser] = useState<string | null>(null);
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
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreateAccount, setShowCreateAccount] = useState(
    initialAccountOptions.length === 0
  );
  const [newAccountName, setNewAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const loadPendingAccounts = useCallback(async () => {
    const pending = await loadTradovateOAuthAccounts();
    if (!pending) return false;
    setTradovateUser(pending.displayName);
    setTradovateAccounts(pending.accounts);
    setEnvironment(pending.environment);
    if (pending.accounts.length === 1) {
      setExternalAccountId(String(pending.accounts[0]!.id));
    }
    setMessage(`Signed in to Tradovate as ${pending.displayName}. Pick the account to sync.`);
    return true;
  }, []);

  useEffect(() => {
    void loadPendingAccounts();
  }, [loadPendingAccounts]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; ok?: boolean; error?: string } | null;
      if (!data || data.type !== "tradovate-oauth") return;

      setConnectingOAuth(false);
      if (data.ok) {
        void loadPendingAccounts();
      } else {
        setError(data.error || "Tradovate login was cancelled or failed");
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadPendingAccounts]);

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

  function handleConnectTradovate() {
    if (!oauthConfigured) {
      setError("Tradovate OAuth is not configured on this deployment yet.");
      return;
    }

    setConnectingOAuth(true);
    setError(null);
    setMessage(null);
    setTradovateAccounts([]);
    setTradovateUser(null);
    setExternalAccountId("");

    const url = `/api/brokers/tradovate/authorize?environment=${environment}`;
    const popup = window.open(
      url,
      "tradovate-oauth",
      "width=520,height=720,menubar=no,toolbar=no,location=yes,status=no"
    );

    if (!popup) {
      setConnectingOAuth(false);
      window.location.href = url;
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        setConnectingOAuth(false);
        void loadPendingAccounts();
      }
    }, 500);
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
      const connection = await connectTradovateOAuth({
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
      setTradovateAccounts([]);
      setTradovateUser(null);
      setExternalAccountId("");
      setMessage(
        `Connected to ${selected.name}.` +
          (syncMode === "auto"
            ? " Auto-sync is on — run Sync now for an immediate import."
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
          ? "Auto-sync enabled."
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
            Same flow as TradesViz, Kinfo, and other journals: you log in on Tradovate&apos;s site and
            approve read-only access. You do <strong className="text-foreground">not</strong> need an
            API subscription or API tab in your Tradovate settings — that is only for app developers.
          </p>
        </div>

        {!oauthConfigured && (
          <div className="text-sm rounded-md p-3 border border-amber-500/30 bg-amber-500/10 text-amber-100 space-y-2">
            <p>
              Tradovate login is not enabled on this deployment yet. The journal operator must register
              one OAuth app with Tradovate (one-time setup), then add{" "}
              <code className="text-xs">TRADOVATE_CLIENT_ID</code> and{" "}
              <code className="text-xs">TRADOVATE_CLIENT_SECRET</code> in Vercel.
            </p>
            <p className="text-xs text-amber-200/80">
              Redirect URI for Tradovate registration:{" "}
              <span className="text-foreground break-all">{oauthRedirectUri}</span>
            </p>
            <p className="text-xs">
              Contact{" "}
              <a
                href="mailto:apisupport@ninjatrader.com"
                className="text-primary hover:underline"
              >
                apisupport@ninjatrader.com
              </a>{" "}
              to register a third-party OAuth app for this journal.
            </p>
            <p className="text-xs">
              Until then: use <strong className="text-foreground">CSV upload</strong> → Tradovate
              Position History.
            </p>
          </div>
        )}

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
            Choose the environment that matches where you trade before connecting.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={connectingOAuth || !oauthConfigured}
          onClick={handleConnectTradovate}
        >
          {connectingOAuth ? "Waiting for Tradovate…" : "Connect with Tradovate"}
        </button>

        {tradovateUser && tradovateAccounts.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border/60">
            <p className="text-sm text-muted">
              Logged in as <span className="text-foreground">{tradovateUser}</span>
            </p>

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
                    ["auto", "Auto sync"],
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
                : `Save connection${selectedTradovateName ? ` — ${selectedTradovateName}` : ""}`}
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
                    {(c.auto_sync ?? false) ? " · Auto-sync" : " · Manual sync"}
                    {c.last_synced_at
                      ? ` · Last sync ${new Date(c.last_synced_at).toLocaleString()}`
                      : " · Never synced"}
                  </p>
                  {c.last_sync_status === "error" && c.last_sync_error && (
                    <p className="text-xs text-danger mt-1">{c.last_sync_error}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["manual", "Manual"],
                      ["auto", "Auto"],
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
