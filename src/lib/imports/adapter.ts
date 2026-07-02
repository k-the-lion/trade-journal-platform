import type { TradeInput, TradeSource } from "@/lib/types/database";

/** Normalized row from any import source before DB insert */
export interface NormalizedTradeRow {
  traded_at: string;
  symbol: string;
  direction: "long" | "short";
  entry_price?: number | null;
  exit_price?: number | null;
  quantity: number;
  pnl: number;
  r_multiple?: number | null;
  setup_tag?: string | null;
  /** @deprecated Use import_notes for broker/import metadata */
  notes?: string | null;
  import_notes?: string | null;
  external_id?: string | null;
}

export interface ImportAdapterResult {
  rows: NormalizedTradeRow[];
  errors: string[];
  skipped: number;
}

/** Base interface for broker/CSV import adapters */
export interface ImportAdapter {
  source: TradeSource;
  /** Human-readable name */
  name: string;
  /** Parse raw input into normalized trade rows */
  parse(input: unknown, options?: Record<string, unknown>): ImportAdapterResult;
  /** Optional column mapping for flexible CSV imports */
  supportedFields?: string[];
}

export function normalizedToTradeInput(
  row: NormalizedTradeRow,
  source: TradeSource,
  externalId?: string | null
): TradeInput & {
  source: TradeSource;
  external_id?: string | null;
  import_notes?: string | null;
} {
  return {
    traded_at: row.traded_at,
    symbol: row.symbol.toUpperCase(),
    direction: row.direction,
    entry_price: row.entry_price ?? null,
    exit_price: row.exit_price ?? null,
    quantity: row.quantity,
    pnl: row.pnl,
    r_multiple: row.r_multiple ?? null,
    setup_tag: row.setup_tag ?? null,
    notes: null,
    import_notes: row.import_notes ?? row.notes ?? null,
    source,
    external_id: externalId ?? row.external_id ?? null,
  };
}

const adapters = new Map<string, ImportAdapter>();

export function registerImportAdapter(key: string, adapter: ImportAdapter) {
  adapters.set(key, adapter);
}

export function getImportAdapter(key: string): ImportAdapter | undefined {
  return adapters.get(key);
}

export function listImportAdapters(): ImportAdapter[] {
  return [...new Set(adapters.values())];
}

/** Serializable adapter metadata for client UI (no parse functions). */
export type ImportAdapterInfo = Pick<ImportAdapter, "source" | "name" | "supportedFields">;

export function listImportAdapterInfo(): ImportAdapterInfo[] {
  return listImportAdapters().map(({ source, name, supportedFields }) => ({
    source,
    name,
    supportedFields,
  }));
}

export function listImportAdapterKeys(): string[] {
  return [...adapters.keys()];
}
