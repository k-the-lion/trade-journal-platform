"use client";

import { useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import {
  EquityCurveChart,
  BreakdownChart,
  BreakdownTable,
} from "@/components/Charts";
import { PnlCalendar } from "@/components/PnlCalendar";
import {
  computeTradeStats,
  computeEquityCurve,
  computeDailyPnl,
  breakdownBySymbol,
  breakdownByStrategy,
  breakdownByTags,
  breakdownByAccount,
  breakdownByDayOfWeek,
  breakdownByAccountType,
  breakdownByDirection,
  breakdownBySource,
  breakdownByRuleFollowed,
  formatCurrency,
  formatPct,
} from "@/lib/reports/stats";
import {
  filterTradesForReports,
  hasActiveReportFilters,
  UNASSIGNED_ACCOUNT,
  UNASSIGNED_STRATEGY,
  UNTAGGED,
  type ReportTradeFilters,
} from "@/lib/reports/filter-trades";
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

export function ReportsView({
  trades,
  accounts,
  strategies,
  tagPresets,
}: {
  trades: Trade[];
  accounts: TradingAccount[];
  strategies: TradingStrategy[];
  tagPresets: TradingTagPreset[];
}) {
  const [filters, setFilters] = useState<ReportTradeFilters>({
    accountIds: [],
    strategyIds: [],
    tagNames: [],
  });

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    tagPresets.forEach((preset) => set.add(preset.name));
    trades.forEach((trade) => trade.trade_tags?.forEach((row) => set.add(row.tag)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [trades, tagPresets]);

  const filteredTrades = useMemo(
    () => filterTradesForReports(trades, filters),
    [trades, filters]
  );

  const stats = useMemo(() => computeTradeStats(filteredTrades), [filteredTrades]);
  const equity = useMemo(() => computeEquityCurve(filteredTrades), [filteredTrades]);
  const dailyPnl = useMemo(() => computeDailyPnl(filteredTrades), [filteredTrades]);

  const filtersActive = hasActiveReportFilters(filters);

  function clearFilters() {
    setFilters({ accountIds: [], strategyIds: [], tagNames: [] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted text-sm mt-1">Performance analytics from your logged trades</p>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-sm">Filters</h2>
            <p className="text-xs text-muted mt-0.5">
              {filtersActive
                ? `Showing ${filteredTrades.length} of ${trades.length} trades`
                : "All trades included — narrow by account, strategy, or tag"}
            </p>
          </div>
          {filtersActive && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={clearFilters}
            >
              Clear all filters
            </button>
          )}
        </div>

        <div>
          <p className="text-xs text-muted mb-2">Account</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chipClass(filters.accountIds.includes(UNASSIGNED_ACCOUNT))}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  accountIds: toggleInList(prev.accountIds, UNASSIGNED_ACCOUNT),
                }))
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
                  setFilters((prev) => ({
                    ...prev,
                    accountIds: toggleInList(prev.accountIds, account.id),
                  }))
                }
              >
                {account.name}
              </button>
            ))}
            {accounts.length === 0 && (
              <span className="text-xs text-muted">No accounts yet</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-2">Strategy</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chipClass(filters.strategyIds.includes(UNASSIGNED_STRATEGY))}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  strategyIds: toggleInList(prev.strategyIds, UNASSIGNED_STRATEGY),
                }))
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
                  setFilters((prev) => ({
                    ...prev,
                    strategyIds: toggleInList(prev.strategyIds, strategy.id),
                  }))
                }
              >
                {strategy.name}
              </button>
            ))}
            {strategies.length === 0 && (
              <span className="text-xs text-muted">No strategies yet</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-2">Tag</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chipClass(filters.tagNames.includes(UNTAGGED))}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  tagNames: toggleInList(prev.tagNames, UNTAGGED),
                }))
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
                  setFilters((prev) => ({
                    ...prev,
                    tagNames: toggleInList(prev.tagNames, tag),
                  }))
                }
              >
                {tag}
              </button>
            ))}
            {tagOptions.length === 0 && (
              <span className="text-xs text-muted">No tags used yet</span>
            )}
          </div>
        </div>
      </div>

      {filteredTrades.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">
          No trades match the current filters.{" "}
          {filtersActive && (
            <button type="button" className="text-primary hover:underline" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total P&L"
              value={formatCurrency(stats.totalPnl)}
              positive={stats.totalPnl >= 0 ? true : false}
            />
            <StatCard
              label="Win rate"
              value={formatPct(stats.winRate)}
              sub={`${stats.totalTrades} trades`}
            />
            <StatCard label="Expectancy" value={formatCurrency(stats.expectancy)} sub="per trade" />
            <StatCard label="Max drawdown" value={formatCurrency(stats.maxDrawdown)} positive={false} />
            <StatCard label="Avg win" value={formatCurrency(stats.avgWin)} positive={true} />
            <StatCard label="Avg loss" value={formatCurrency(stats.avgLoss)} positive={false} />
            <StatCard label="Profit factor" value={String(stats.profitFactor)} />
            <StatCard
              label="Current streak"
              value={`${stats.currentStreak} ${stats.currentStreakType}`}
              sub={`Best day: ${formatCurrency(stats.bestDay)}`}
            />
          </div>

          <EquityCurveChart data={equity} />

          <PnlCalendar dailyPnl={dailyPnl} />

          <div>
            <h2 className="text-lg font-medium mb-4">P&L breakdowns</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BreakdownChart
                data={breakdownByStrategy(filteredTrades)}
                title="P&L by Strategy"
                labelWidth={110}
              />
              <BreakdownChart
                data={breakdownByAccount(filteredTrades)}
                title="P&L by Account"
                labelWidth={110}
              />
              <BreakdownChart
                data={breakdownByTags(filteredTrades)}
                title="P&L by Tag"
                labelWidth={110}
              />
              <BreakdownChart data={breakdownBySymbol(filteredTrades)} title="P&L by Symbol" />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Performance tables</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BreakdownTable data={breakdownByDayOfWeek(filteredTrades)} title="By Day of Week" />
              <BreakdownTable data={breakdownByAccountType(filteredTrades)} title="By Account Type" />
              <BreakdownTable data={breakdownByDirection(filteredTrades)} title="By Direction" />
              <BreakdownTable data={breakdownBySource(filteredTrades)} title="By Import Source" />
              <BreakdownTable
                data={breakdownByRuleFollowed(filteredTrades)}
                title="By Rule Discipline"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
