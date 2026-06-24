import type { Trade } from "@/lib/types/database";

export const UNASSIGNED_ACCOUNT = "__unassigned_account__";
export const UNASSIGNED_STRATEGY = "__unassigned_strategy__";
export const UNTAGGED = "__untagged__";

export interface ReportTradeFilters {
  accountIds: string[];
  strategyIds: string[];
  tagNames: string[];
}

export function filterTradesForReports(
  trades: Trade[],
  filters: ReportTradeFilters
): Trade[] {
  let list = trades;

  if (filters.accountIds.length > 0) {
    list = list.filter((t) => {
      if (!t.account_id) return filters.accountIds.includes(UNASSIGNED_ACCOUNT);
      return filters.accountIds.includes(t.account_id);
    });
  }

  if (filters.strategyIds.length > 0) {
    list = list.filter((t) => {
      if (!t.strategy_id) return filters.strategyIds.includes(UNASSIGNED_STRATEGY);
      return filters.strategyIds.includes(t.strategy_id);
    });
  }

  if (filters.tagNames.length > 0) {
    list = list.filter((t) => {
      const tags = t.trade_tags?.map((row) => row.tag) ?? [];
      if (tags.length === 0) return filters.tagNames.includes(UNTAGGED);
      return filters.tagNames.every((name) => tags.includes(name));
    });
  }

  return list;
}

export function hasActiveReportFilters(filters: ReportTradeFilters): boolean {
  return (
    filters.accountIds.length > 0 ||
    filters.strategyIds.length > 0 ||
    filters.tagNames.length > 0
  );
}
