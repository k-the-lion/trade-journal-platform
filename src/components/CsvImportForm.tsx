"use client";

import { useState } from "react";
import { importCsvTrades } from "@/lib/actions";
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
  { value: "generic", label: "Generic CSV / spreadsheet" },
];

const EXPORT_GUIDES: Record<ImportPreset, string> = {
  auto: "Upload your broker export — we'll detect TopStep X or Tradovate automatically.",
  topstepx:
    "TopStep X → bottom Trades tab → Export → pick date range → download CSV. Don't edit the file.",
  tradovate_position:
    "Tradovate → Accounts → gear icon → Position History → date range → Download Report. Best for P&L.",
  tradovate_orders:
    "Tradovate → Reports → Orders tab (NOT Performance) → Download CSV. Orders lack round-trip P&L.",
  generic: "Any CSV with date, symbol, and P&L columns. Map columns below if needed.",
};

export function CsvImportForm({ orgOptions = [] }: { orgOptions?: { id: string; name: string }[] }) {
  const [csvText, setCsvText] = useState("");
  const [preset, setPreset] = useState<ImportPreset>("auto");
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState("");

  const showColumnMapper = preset === "generic" || preset === "auto";

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      setCsvText(text);
      setResult(null);

      const { headers: cols } = parseCsvRows(text);
      setHeaders(cols);
      setMapping(buildMappingFromHeaders(cols));

      const detected = detectImportFormat(text);
      setDetectedLabel(detected.label);
    };
    reader.readAsText(file);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await importCsvTrades(csvText, mapping, orgId || null, preset);
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

  const activeGuide = EXPORT_GUIDES[preset === "auto" && detectedLabel ? "auto" : preset];

  return (
    <form onSubmit={handleImport} className="card p-6 space-y-5 max-w-2xl">
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
        {detectedLabel && preset === "auto" && (
          <p className="text-xs text-primary mt-1">Detected: {detectedLabel}</p>
        )}
      </div>

      <div>
        <label className="label">Upload CSV file</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm text-muted w-full"
        />
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
          className={`text-sm rounded-md p-3 border ${
            result.imported > 0
              ? "border-success/30 bg-success/10"
              : "border-danger/30 bg-danger/10"
          }`}
        >
          <p>Imported: {result.imported} | Skipped: {result.skipped}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-muted">
              {result.errors.slice(0, 8).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={!csvText || loading}>
        {loading ? "Importing..." : "Import trades"}
      </button>
    </form>
  );
}
