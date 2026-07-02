import type { Trade } from "@/lib/types/database";

type TradeNoteFields = Pick<Trade, "import_notes" | "notes" | "source">;

/** Broker/import metadata shown separately from the user's journal. */
export function displayImportNotes(trade: TradeNoteFields): string | null {
  const fromColumn = trade.import_notes?.trim();
  if (fromColumn) return fromColumn;

  if (trade.source && trade.source !== "manual") {
    const legacy = trade.notes?.trim();
    if (legacy) return legacy;
  }

  return null;
}

/** User journal text — excludes import metadata still stored in notes. */
export function displayJournalNotes(trade: TradeNoteFields): string {
  const journal = trade.notes?.trim() ?? "";
  const importNotes = displayImportNotes(trade);
  if (!journal || !importNotes || journal !== importNotes) {
    return trade.notes ?? "";
  }
  return "";
}
