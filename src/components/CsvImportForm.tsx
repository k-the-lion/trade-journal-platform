"use client";

import { useState } from "react";
import { importCsvTrades } from "@/lib/actions";
import type { CsvColumnMapping } from "@/lib/imports/csv-adapter";

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

const DEFAULTS: CsvColumnMapping = {
  traded_at: "Date",
  symbol: "Symbol",
  direction: "Direction",
  entry_price: "Entry",
  exit_price: "Exit",
  quantity: "Quantity",
  pnl: "PnL",
  r_multiple: "R",
  setup_tag: "Setup",
  notes: "Notes",
  external_id: "ID",
};

export function CsvImportForm({ orgOptions = [] }: { orgOptions?: { id: string; name: string }[] }) {
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<CsvColumnMapping>(DEFAULTS);
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      setCsvText(text);
      const firstLine = text.split("\n")[0];
      const cols = firstLine.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      setHeaders(cols);
      const auto: CsvColumnMapping = { ...DEFAULTS };
      for (const field of FIELD_OPTIONS) {
        const match = cols.find(
          (c) => c.toLowerCase() === (DEFAULTS[field]?.toLowerCase() ?? "")
        );
        if (match) auto[field] = match;
      }
      setMapping(auto);
    };
    reader.readAsText(file);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await importCsvTrades(csvText, mapping, orgId || null);
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

  return (
    <form onSubmit={handleImport} className="card p-6 space-y-5 max-w-2xl">
      <div>
        <label className="label">Upload CSV file</label>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm text-muted" />
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

      {headers.length > 0 && (
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
        <div className={`text-sm rounded-md p-3 border ${result.imported > 0 ? "border-success/30 bg-success/10" : "border-danger/30 bg-danger/10"}`}>
          <p>Imported: {result.imported} | Skipped: {result.skipped}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-muted">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
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
