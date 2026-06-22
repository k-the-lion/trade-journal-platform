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
  notes?: string | null;
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
): TradeInput & { source: TradeSource; external_id?: string | null } {
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
    notes: row.notes ?? null,
    source,
    external_id: externalId ?? row.external_id ?? null,
  };
}

/** Registry for future broker adapters */
const adapters = new Map<string, ImportAdapter>();

export function registerImportAdapter(adapter: ImportAdapter) {
  adapters.set(adapter.source, adapter);
}

export function getImportAdapter(source: string): ImportAdapter | undefined {
  return adapters.get(source);
}

export function listImportAdapters(): ImportAdapter[] {
  return [...adapters.values()];
}

/** Stub for future Tradovate API sync */
export const tradovateAdapterStub: ImportAdapter = {
  source: "tradovate",
  name: "Tradovate (coming soon)",
  supportedFields: ["orderId", "symbol", "fillTime", "pnl"],
  parse() {
    return {
      rows: [],
      errors: ["Tradovate API sync is not yet implemented. Use CSV import for now."],
      skipped: 0,
    };
  },
};

registerImportAdapter(tradovateAdapterStub);
