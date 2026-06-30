"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  createTradingRule,
  deleteTradingRule,
  upsertTradingGoals,
} from "@/lib/actions";
import { computeGoalsProgress } from "@/lib/goals/compute";
import { DEFAULT_PROP_PLANNER_INPUTS, PROP_PLANNER_STORAGE_KEY } from "@/lib/prop-planner/defaults";
import type { PropPlannerInputs } from "@/lib/prop-planner/types";
import { formatCurrency } from "@/lib/reports/stats";
import type {
  DailyJournalEntry,
  Trade,
  UserTradingGoals,
  UserTradingRule,
} from "@/lib/types/database";
import type { GoalStatus } from "@/lib/goals/compute";

function statusLabel(status: GoalStatus) {
  switch (status) {
    case "on_track":
      return "On track";
    case "respected":
      return "Respected";
    case "at_risk":
      return "At risk";
    default:
      return "—";
  }
}

function statusClass(status: GoalStatus) {
  switch (status) {
    case "on_track":
    case "respected":
      return "bg-success/15 text-success border-success/30";
    case "at_risk":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-white/5 text-muted border-border/60";
  }
}

function progressBarClass(status: GoalStatus) {
  switch (status) {
    case "on_track":
    case "respected":
      return "bg-success";
    case "at_risk":
      return "bg-warning";
    default:
      return "bg-primary";
  }
}

export function GoalsDashboard({
  initialGoals,
  initialRules,
  trades,
  journals,
  goalsUnavailable = false,
}: {
  initialGoals: UserTradingGoals | null;
  initialRules: UserTradingRule[];
  trades: Trade[];
  journals: DailyJournalEntry[];
  goalsUnavailable?: boolean;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [rules, setRules] = useState(initialRules);
  const [editing, setEditing] = useState(!initialGoals);
  const [profitTarget, setProfitTarget] = useState(
    initialGoals?.monthly_profit_target?.toString() ?? ""
  );
  const [winRateTarget, setWinRateTarget] = useState(
    initialGoals?.min_win_rate_pct?.toString() ?? ""
  );
  const [maxDailyLoss, setMaxDailyLoss] = useState(
    initialGoals?.max_daily_loss?.toString() ?? ""
  );
  const [tradeTarget, setTradeTarget] = useState(
    initialGoals?.monthly_trade_target?.toString() ?? ""
  );
  const [newRule, setNewRule] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const progress = useMemo(
    () => computeGoalsProgress(goals, trades, journals),
    [goals, trades, journals]
  );

  function applyFromPropPlanner() {
    try {
      const raw = localStorage.getItem(PROP_PLANNER_STORAGE_KEY);
      const inputs: PropPlannerInputs = raw
        ? { ...DEFAULT_PROP_PLANNER_INPUTS, ...JSON.parse(raw) }
        : DEFAULT_PROP_PLANNER_INPUTS;
      setProfitTarget(String(inputs.evalProfitTarget));
      setWinRateTarget(String(inputs.winRate));
      setMaxDailyLoss(
        String(Math.max(100, Math.round(inputs.maxDrawdown / Math.max(inputs.tradingDaysPerMonth, 1))))
      );
      setTradeTarget(String(inputs.tradingDaysPerMonth * 2));
      setEditing(true);
      setMsg("Loaded suggestions from your Prop Planner inputs. Save to apply.");
    } catch {
      setMsg("Could not read Prop Planner — open the Prop Planner tab first or enter goals manually.");
    }
  }

  function handleSaveGoals(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        const row = await upsertTradingGoals({
          monthly_profit_target: profitTarget ? Number(profitTarget) : null,
          min_win_rate_pct: winRateTarget ? Number(winRateTarget) : null,
          max_daily_loss: maxDailyLoss ? Number(maxDailyLoss) : null,
          monthly_trade_target: tradeTarget ? Number(tradeTarget) : null,
        });
        setGoals(row as UserTradingGoals);
        setEditing(false);
        setMsg("Goals saved.");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Failed to save goals");
      }
    });
  }

  function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!newRule.trim()) return;
    startTransition(async () => {
      try {
        const created = await createTradingRule(newRule);
        setRules((prev) => [...prev, created as UserTradingRule]);
        setNewRule("");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Failed to add rule");
      }
    });
  }

  function handleDeleteRule(id: string) {
    startTransition(async () => {
      await deleteTradingRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    });
  }

  if (goalsUnavailable) {
    return (
      <p className="text-sm text-danger rounded-md border border-danger/30 bg-danger/10 p-3">
        Goals tables are missing. Run migration{" "}
        <code className="text-xs">016_trading_goals.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Tracking for <span className="text-foreground">{progress.monthLabel}</span>
            {progress.daysLeft > 0 && ` · ${progress.daysLeft} days left`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={applyFromPropPlanner}
          >
            Suggest from Prop Planner
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel edit" : "Edit goals"}
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSaveGoals} className="card p-5 space-y-4 max-w-2xl">
          <h3 className="font-medium text-sm">Monthly targets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Profit target ($)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={profitTarget}
                onChange={(e) => setProfitTarget(e.target.value)}
                placeholder="e.g. 8000"
              />
            </div>
            <div>
              <label className="label">Min win rate (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={winRateTarget}
                onChange={(e) => setWinRateTarget(e.target.value)}
                placeholder="e.g. 60"
              />
            </div>
            <div>
              <label className="label">Max daily loss ($)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={maxDailyLoss}
                onChange={(e) => setMaxDailyLoss(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div>
              <label className="label">Trade count target</label>
              <input
                className="input"
                type="number"
                min={0}
                value={tradeTarget}
                onChange={(e) => setTradeTarget(e.target.value)}
                placeholder="e.g. 40"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary text-sm" disabled={pending}>
            Save goals
          </button>
        </form>
      )}

      {msg && <p className="text-sm text-muted">{msg}</p>}

      {!progress.hasAnyGoals && !editing && (
        <div className="card p-6 text-center space-y-3 max-w-lg">
          <p className="text-muted text-sm">
            Set monthly targets to track profit, win rate, daily loss limits, and trade volume
            against your journal.
          </p>
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setEditing(true)}
          >
            Set up goals
          </button>
        </div>
      )}

      {progress.hasAnyGoals && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {progress.metrics.map((m) => (
              <div key={m.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted uppercase tracking-wide">{m.label}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusClass(m.status)}`}
                  >
                    {statusLabel(m.status)}
                  </span>
                </div>
                <p
                  className={`text-2xl font-semibold ${
                    m.positive === true ? "positive" : m.positive === false ? "negative" : ""
                  }`}
                >
                  {m.currentLabel}
                </p>
                <p className="text-xs text-muted">Target: {m.targetLabel}</p>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressBarClass(m.status)}`}
                    style={{ width: `${Math.min(100, m.progressPct)}%` }}
                  />
                </div>
                <p className="text-xs text-muted">{m.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {progress.projectedMonthEnd !== null && (
              <div className="card p-4">
                <p className="text-xs text-muted uppercase tracking-wide">Projected month-end</p>
                <p
                  className={`text-xl font-semibold mt-1 ${
                    progress.projectedMonthEnd >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatCurrency(progress.projectedMonthEnd)}
                </p>
                {progress.projectedDetail && (
                  <p className="text-xs text-muted mt-1">{progress.projectedDetail}</p>
                )}
              </div>
            )}
            {progress.bestDayOfWeek && (
              <div className="card p-4">
                <p className="text-xs text-muted uppercase tracking-wide">Best day of week</p>
                <p className="text-xl font-semibold mt-1 positive">
                  {progress.bestDayOfWeek.day} ({formatCurrency(progress.bestDayOfWeek.avgPnl)} avg)
                </p>
                {progress.worstDayOfWeek && progress.worstDayOfWeek.day !== progress.bestDayOfWeek.day && (
                  <p className="text-xs text-muted mt-1">
                    Watch out on {progress.worstDayOfWeek.day} — avg{" "}
                    {formatCurrency(progress.worstDayOfWeek.avgPnl)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-6">
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: `conic-gradient(var(--color-primary) ${progress.consistencyScore * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                }}
              >
                <div className="absolute inset-2 rounded-full bg-surface flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold">{progress.consistencyScore}</span>
                  <span className="text-[10px] text-muted">/ 100</span>
                </div>
              </div>
              <div className="flex-1 min-w-[200px] space-y-2">
                <p className="font-medium text-sm">Consistency score</p>
                <p className="text-xs text-muted mb-3">
                  Composite of journaling, volume, win rate, and profit pace this month.
                </p>
                {progress.consistencyBreakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">{item.label}</span>
                      <span>{item.pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm">Trading rules</h3>
          </div>
          <form onSubmit={handleAddRule} className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="e.g. No trading first 15 minutes"
            />
            <button type="submit" className="btn btn-secondary text-sm shrink-0" disabled={pending}>
              + Add rule
            </button>
          </form>
          {rules.length === 0 ? (
            <p className="text-sm text-muted">No trading rules yet.</p>
          ) : (
            <ul className="space-y-2">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <span className="text-sm">{rule.name}</span>
                  <button
                    type="button"
                    className="text-xs text-danger hover:underline"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">
            Mark trades as &quot;rules broken&quot; on the dashboard to log violations below.
          </p>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-medium text-sm">Violation history</h3>
          {progress.violations.length === 0 ? (
            <p className="text-sm text-muted">No violations recorded — keep following your rules!</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left">
                  <th className="pb-2 font-normal">Rule broken</th>
                  <th className="pb-2 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {progress.violations.map((v, i) => (
                  <tr key={`${v.date}-${i}`} className="border-t border-border/40">
                    <td className="py-2">{v.label}</td>
                    <td className="py-2 text-muted">{v.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-xs text-muted">
        Tip: use{" "}
        <Link href="/tools?tab=planner" className="text-primary hover:underline">
          Prop Planner
        </Link>{" "}
        to model eval targets, then click &quot;Suggest from Prop Planner&quot; to pre-fill goals.
      </p>
    </div>
  );
}
