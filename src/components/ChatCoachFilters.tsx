"use client";

import { useMemo } from "react";
import { FilterPanel } from "@/components/FilterPanel";
import {
  hasActiveCoachFilters,
  UNASSIGNED_ACCOUNT,
  UNASSIGNED_STRATEGY,
  UNTAGGED,
  type CoachTradeFilters,
} from "@/lib/ai/coach-filters";
import type {
  Trade,
  TradingAccount,
  TradingStrategy,
  TradingTagPreset,
} from "@/lib/types/database";

function chipClass(active: boolean) {
  return `text-xs px-3 py-1.5 rounded-full border transition-colors ${
    active
      ? "border-primary bg-primary/15 text-primary"
      : "border-border text-muted hover:border-primary/40"
  }`;
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ChatCoachFilters({
  filters,
  onChange,
  accounts,
  strategies,
  trades,
  tagPresets,
}: {
  filters: CoachTradeFilters;
  onChange: (filters: CoachTradeFilters) => void;
  accounts: TradingAccount[];
  strategies: TradingStrategy[];
  trades: Trade[];
  tagPresets: TradingTagPreset[];
}) {
  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    tagPresets.forEach((p) => set.add(p.name));
    trades.forEach((t) => t.trade_tags?.forEach((row) => set.add(row.tag)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [trades, tagPresets]);

  const active = hasActiveCoachFilters(filters);

  function clearFilters() {
    onChange({ accountIds: [], strategyIds: [], tagNames: [] });
  }

  const hint = active
    ? "Coach context is limited to matching trades and journal days"
    : "All trades, journals, tags, and screenshots in scope";

  return (
    <FilterPanel nested title="Coach context filters" hint={hint} active={active} onClear={clearFilters}>
      <div>
        <p className="text-xs text-muted mb-2">Account</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(filters.accountIds.includes(UNASSIGNED_ACCOUNT))}
            onClick={() =>
              onChange({
                ...filters,
                accountIds: toggleInList(filters.accountIds, UNASSIGNED_ACCOUNT),
              })
            }
          >
            Unassigned
          </button>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className={chipClass(filters.accountIds.includes(account.id))}
              onClick={() =>
                onChange({
                  ...filters,
                  accountIds: toggleInList(filters.accountIds, account.id),
                })
              }
            >
              {account.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted mb-2">Strategy</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(filters.strategyIds.includes(UNASSIGNED_STRATEGY))}
            onClick={() =>
              onChange({
                ...filters,
                strategyIds: toggleInList(filters.strategyIds, UNASSIGNED_STRATEGY),
              })
            }
          >
            Unassigned
          </button>
          {strategies.map((strategy) => (
            <button
              key={strategy.id}
              type="button"
              className={chipClass(filters.strategyIds.includes(strategy.id))}
              onClick={() =>
                onChange({
                  ...filters,
                  strategyIds: toggleInList(filters.strategyIds, strategy.id),
                })
              }
            >
              {strategy.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted mb-2">Tags</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(filters.tagNames.includes(UNTAGGED))}
            onClick={() =>
              onChange({
                ...filters,
                tagNames: toggleInList(filters.tagNames, UNTAGGED),
              })
            }
          >
            Untagged
          </button>
          {tagOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              className={chipClass(filters.tagNames.includes(tag))}
              onClick={() =>
                onChange({
                  ...filters,
                  tagNames: toggleInList(filters.tagNames, tag),
                })
              }
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </FilterPanel>
  );
}
