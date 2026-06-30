"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  bulkAssignStrategyByImportJob,
  createTradingAccount,
  importCsvTrades,
} from "@/lib/actions";
import {
  buildMappingFromHeaders,
  detectImportFormat,
  parseCsvRows,
  type CsvColumnMapping,
  type ImportPreset,
} from "@/lib/imports";

const FIELD_OPTIONS = [
  "traded_at",
  "symbol",
  "direction",
  "entry_price",
  "exit_price",
  "quantity",
  "pnl",
  "r_multiple",
  "setup_tag",
  "notes",
  "external_id",
] as const;

const PRESET_OPTIONS: { value: ImportPreset; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "topstepx", label: "TopStep X (Trades export)" },
  { value: "tradovate_position", label: "Tradovate (Position History)" },
  { value: "tradovate_orders", label: "Tradovate (Orders / Fills)" },
  { value: "tradingview_balance", label: "TradingView (Balance History)" },
  { value: "tradingview_orders", label: "TradingView (Order History)" },
  { value: "tradingview_journal", label: "TradingView (Trading journal)" },
  { value: "generic", label: "Generic CSV / spreadsheet" },
];

const EXPORT_GUIDES: Record<ImportPreset, string> = {
  auto: "Upload your broker export — we'll detect TopStep X, Tradovate, or TradingView automatically.",
  topstepx:
    "TopStep X → bottom Trades tab → Export → pick date range → download CSV. Don't edit the file.",
  tradovate_position:
    "Tradovate → Accounts → gear icon → Position History → date range → Download Report. Best for P&L.",
  tradovate_orders:
    "Tradovate → Reports → Orders tab (NOT Performance) → Download CSV. We pair buy/sell fills into round trips with calculated P&L.",
  tradingview_balance:
    "TradingView → Paper Trading panel → Balance History tab → Export data. Each row is a closed trade with realized P&L.",
  tradingview_orders:
    "TradingView → Order History tab → ⋯ enable all columns → Export data. We pair buy/sell fills into round trips.",
  tradingview_journal:
    "Strategy Tester “List of Trades” export only (Trade # + Type columns). The Paper Trading Trading journal tab is an activity log — use Balance History instead.",
  generic: "Any CSV with date, symbol, and P&L columns. Map columns below if needed.",
};

type AccountOption = { id: string; name: string; is_default?: boolean };

export function CsvImportForm({
  orgOptions = [],
  accountOptions: initialAccountOptions = [],
  strategyOptions = [],
}: {
  orgOptions?: { id: string; name: string }[];
  accountOptions?: AccountOption[];
  strategyOptions?: { id: string; name: string }[];
}) {
  const [accountOptions, setAccountOptions] = useState(initialAccountOptions);
  const defaultAccount =
    accountOptions.find((a) => a.is_default) ?? accountOptions[0];

  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState<ImportPreset>("auto");
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    duplicatesSkipped?: number;
    errors: string[];
    jobId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [accountId, setAccountId] = useState(defaultAccount?.id ?? "");
  const [importStrategy, setImportStrategy] = useState("");
  const [postImportStrategy, setPostImportStrategy] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountBroker, setNewAccountBroker] = useState("");
  const [newAccountType, setNewAccountType] = useState("");

  const showColumnMapper = preset === "generic" || preset === "auto";

  const [showCreateAccount, setShowCreateAccount] = useState(
    initialAccountOptions.length === 0
  );
  const [creatingAccount, setCreatingAccount] = useState(false);

  async function handleCreateAccountClick() {
    if (!newAccountName.trim()) {
      alert("Account name is required");
      return;
    }
    setCreatingAccount(true);
    try {
      const account = await createTradingAccount({
        name: newAccountName.trim(),
        broker: newAccountBroker.trim() || null,
        account_type: (newAccountType || null) as
          | "eval"
          | "funded"
          | "personal"
          | null,
        is_default: accountOptions.length === 0,
      });
      const option = {
        id: account.id,
        name: account.name,
        is_default: account.is_default,
      };
      setAccountOptions((prev) => [...prev, option]);
      setAccountId(account.id);
      setShowCreateAccount(false);
      setNewAccountName("");
      setNewAccountBroker("");
      setNewAccountType("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreatingAccount(false);
    }
  }

  function loadCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please choose a .csv file exported from your broker.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      setCsvText(text);
      setFileName(file.name);
      setResult(null);

      const { headers: cols } = parseCsvRows(text);
      setHeaders(cols);
      setMapping(buildMappingFromHeaders(cols));

      const detected = detectImportFormat(text);
      setDetectedLabel(detected.label);
      setUnsupportedReason(
        detected.unsupported ? detected.unsupportedReason ?? detected.label : null
      );
      if (preset === "auto" && !detected.unsupported) {
        setPreset(detected.preset);
      }
    };
    reader.readAsText(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    loadCsvFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadCsvFile(file);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText) return;
    if (unsupportedReason) {
      alert(unsupportedReason);
      return;
    }
    if (!accountId) {
      alert("Choose or create a trading account before importing.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await importCsvTrades(
        csvText,
        mapping,
        orgId || null,
        preset,
        accountId || null,
        importStrategy || null
      );
      setResult(res);
    } catch (err) {
      setResult({
        imported: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : "Import failed"],
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePostImportStrategy() {
    if (!result?.jobId || !postImportStrategy) return;
    setLoading(true);
    try {
      const { updated } = await bulkAssignStrategyByImportJob(
        result.jobId,
        postImportStrategy
      );
      alert(`Strategy applied to ${updated} trades.`);
      setPostImportStrategy("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign strategy");
    } finally {
      setLoading(false);
    }
  }

  const activeGuide = EXPORT_GUIDES[preset === "auto" && detectedLabel ? "auto" : preset];
  const selectedAccountName = accountOptions.find((a) => a.id === accountId)?.name;

  return (
    <form onSubmit={handleImport} className="card p-6 space-y-5 max-w-2xl">
      <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-sm">Trading account</h2>
            <p className="text-xs text-muted mt-0.5">
              Every import is assigned to an account so you can filter on the dashboard.{" "}
              <Link href="/settings?tab=accounts" className="text-primary hover:underline">
                Manage accounts
              </Link>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-border/60 bg-background/40">
            <input
              className="input"
              placeholder="Account name *"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Broker (optional)"
              value={newAccountBroker}
              onChange={(e) => setNewAccountBroker(e.target.value)}
            />
            <select
              className="input"
              value={newAccountType}
              onChange={(e) => setNewAccountType(e.target.value)}
            >
              <option value="">Type —</option>
              <option value="eval">Eval</option>
              <option value="funded">Funded</option>
              <option value="personal">Personal</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={creatingAccount}
              onClick={handleCreateAccountClick}
            >
              {creatingAccount ? "Creating..." : "Create account"}
            </button>
          </div>
        )}

        {accountOptions.length > 0 ? (
          <select
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            <option value="">Select account…</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.is_default ? " (default)" : ""}
              </option>
            ))}
          </select>
        ) : (
          !showCreateAccount && (
            <p className="text-sm text-muted">
              Create an account above before importing.
            </p>
          )
        )}
      </div>

      <div>
        <label className="label">Broker / file type</label>
        <select
          className="input"
          value={preset}
          onChange={(e) => setPreset(e.target.value as ImportPreset)}
        >
          {PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted mt-2">{activeGuide}</p>
      </div>

      <div>
        <label className="label">Strategy for this import (optional)</label>
        <select
          className="input"
          value={importStrategy}
          onChange={(e) => setImportStrategy(e.target.value)}
        >
          <option value="">Don&apos;t set — assign later on dashboard</option>
          {strategyOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">
          Applies this strategy (and its rules) to every trade in this import.{" "}
          <Link href="/settings?tab=strategies" className="text-primary hover:underline">
            Manage strategies
          </Link>
        </p>
      </div>

      <div>
        <label className="label">CSV file</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="sr-only"
        />
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? "border-primary bg-primary/10"
              : fileName
                ? "border-success/40 bg-success/5"
                : "border-border/80 bg-background/30 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          {fileName ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{fileName}</p>
              <p className="text-xs text-muted">
                {headers.length > 0
                  ? `${headers.length} columns detected`
                  : "File loaded"}
                {detectedLabel ? ` · ${detectedLabel}` : ""}
              </p>
              <button
                type="button"
                className="btn btn-secondary text-sm mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl">
                ↑
              </div>
              <div>
                <p className="text-sm font-medium">Drop your CSV here</p>
                <p className="text-xs text-muted mt-1">
                  or click to browse — exports from TopStep X, Tradovate, TradingView, and more
                </p>
              </div>
              <span className="btn btn-primary text-sm pointer-events-none">
                Choose CSV file
              </span>
            </div>
          )}
        </div>
        {unsupportedReason && (
          <p className="text-xs text-danger mt-2 rounded-md border border-danger/30 bg-danger/10 p-2">
            {unsupportedReason}
          </p>
        )}
        {detectedLabel && preset === "auto" && !unsupportedReason && (
          <p className="text-xs text-primary mt-2">Detected: {detectedLabel}</p>
        )}
      </div>

      {orgOptions.length > 0 && (
        <div>
          <label className="label">Assign to organization</label>
          <select className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Solo (none)</option>
            {orgOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {showColumnMapper && headers.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Column mapping</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELD_OPTIONS.map((field) => (
              <div key={field}>
                <label className="label">{field.replace(/_/g, " ")}</label>
                <select
                  className="input"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                  }
                >
                  <option value="">— skip —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div
          className={`text-sm rounded-md p-3 border space-y-3 ${
            result.imported > 0 || (result.duplicatesSkipped ?? 0) > 0
              ? "border-success/30 bg-success/10"
              : "border-danger/30 bg-danger/10"
          }`}
        >
          <p>
            Imported: {result.imported}
            {(result.duplicatesSkipped ?? 0) > 0 && (
              <> | Duplicates skipped: {result.duplicatesSkipped}</>
            )}
            {result.skipped - (result.duplicatesSkipped ?? 0) > 0 && (
              <> | Rows skipped: {result.skipped - (result.duplicatesSkipped ?? 0)}</>
            )}
            {selectedAccountName && (
              <span className="block text-xs text-muted mt-1">
                Assigned to account: {selectedAccountName}
              </span>
            )}
          </p>
          {result.imported > 0 && (
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label text-xs">Or assign strategy after import</label>
                <select
                  className="input"
                  value={postImportStrategy}
                  onChange={(e) => setPostImportStrategy(e.target.value)}
                >
                  <option value="">Choose strategy…</option>
                  {strategyOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={!postImportStrategy || loading}
                onClick={handlePostImportStrategy}
              >
                Apply to import
              </button>
              <Link href="/dashboard" className="btn btn-primary text-sm">
                View on dashboard
              </Link>
            </div>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-muted">
              {result.errors.slice(0, 8).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!csvText || loading || !accountId || Boolean(unsupportedReason)}
      >
        {loading ? "Importing..." : "Import trades"}
      </button>
    </form>
  );
}
