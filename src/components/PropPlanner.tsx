"use client";

import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { calculatePropPlanner } from "@/lib/prop-planner/calculate";
import {
  DEFAULT_PROP_PLANNER_INPUTS,
  PROP_PLANNER_STORAGE_KEY,
} from "@/lib/prop-planner/defaults";
import { formatPlannerCurrency, formatTradingDuration } from "@/lib/prop-planner/format";
import type { PropPlannerInputs } from "@/lib/prop-planner/types";

function PlannerSwitch({
  checked,
  onChange,
  label,
  title,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 py-1 ${disabled ? "opacity-50" : ""}`}
      title={title}
    >
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? "bg-primary border-primary" : "bg-background border-border"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function PlannerNumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <label className="label" htmlFor={id}>
        {label}
        {hint ? <span className="text-muted font-normal"> ({hint})</span> : null}
      </label>
      <input
        id={id}
        type="number"
        className="input"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function PlannerSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="card group" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 py-3 font-medium text-sm border-b border-border/60 [&::-webkit-details-marker]:hidden flex items-center justify-between">
        {title}
        <span className="text-muted text-xs group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="p-4 space-y-4">{children}</div>
    </details>
  );
}

function ResultsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<{ cells: string[]; hidden?: boolean }>;
}) {
  const visibleRows = rows.filter((row) => !row.hidden);
  if (visibleRows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border/60">
            {headers.map((header) => (
              <th key={header} className="py-2 pr-4 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={index} className="border-b border-border/40 last:border-0">
              {row.cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-2 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function loadStoredInputs(): PropPlannerInputs {
  if (typeof window === "undefined") return DEFAULT_PROP_PLANNER_INPUTS;
  try {
    const raw = localStorage.getItem(PROP_PLANNER_STORAGE_KEY);
    if (!raw) return DEFAULT_PROP_PLANNER_INPUTS;
    return { ...DEFAULT_PROP_PLANNER_INPUTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROP_PLANNER_INPUTS;
  }
}

export function PropPlanner() {
  const [inputs, setInputs] = useState<PropPlannerInputs>(DEFAULT_PROP_PLANNER_INPUTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setInputs(loadStoredInputs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PROP_PLANNER_STORAGE_KEY, JSON.stringify(inputs));
  }, [inputs, hydrated]);

  const results = useMemo(() => calculatePropPlanner(inputs), [inputs]);

  function patch<K extends keyof PropPlannerInputs>(key: K, value: PropPlannerInputs[K]) {
    setInputs((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "directToFunded" && value === true) {
        next.accountFeeRecurring = false;
        next.activationEnabled = false;
      }
      if (key === "tradingDaysPerMonth") {
        const days = typeof value === "number" ? value : prev.tradingDaysPerMonth;
        next.tradingDaysPerMonth = Math.min(21, Math.max(1, days || 21));
      }
      return next;
    });
  }

  const consistencyPctLabel =
    inputs.consistencyPct % 1 === 0
      ? inputs.consistencyPct.toFixed(0)
      : String(inputs.consistencyPct);
  const maxFirstGross = inputs.firstPayout * (inputs.consistencyPct / 100);
  const maxRecurringGross = inputs.recurringPayout * (inputs.consistencyPct / 100);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-sm">Configuration</h3>
          <p className="text-xs text-muted mt-0.5">
            Enter your trading assumptions and firm settings. Expand each section to edit.
          </p>
        </div>

        <PlannerSection title="1 · Core Trading Edge" defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlannerNumberField
              id="avgProfit"
              label="Average daily win"
              hint="$"
              value={inputs.avgProfit}
              onChange={(v) => patch("avgProfit", v)}
            />
            <PlannerNumberField
              id="avgLoss"
              label="Average daily loss"
              hint="$"
              value={inputs.avgLoss}
              onChange={(v) => patch("avgLoss", v)}
            />
            <PlannerNumberField
              id="tradingDays"
              label="Trading days per month"
              hint="max 21"
              value={inputs.tradingDaysPerMonth}
              min={1}
              max={21}
              onChange={(v) => patch("tradingDaysPerMonth", v)}
            />
            <PlannerNumberField
              id="winRate"
              label="Win rate"
              hint="%"
              value={inputs.winRate}
              min={0}
              max={100}
              onChange={(v) => patch("winRate", v)}
            />
          </div>
        </PlannerSection>

        <PlannerSection title="2 · Firm and fees">
          <PlannerSwitch
            checked={inputs.directToFunded}
            onChange={(v) => patch("directToFunded", v)}
            label="Direct to funded account"
            title="Off = evaluation account. On = start funded with no evaluation phase."
          />
          <p className="text-xs text-muted">{results.accountTypeNote}</p>

          <PlannerNumberField
            id="profitSplit"
            label="Profit split"
            hint="%"
            value={inputs.profitSplit}
            min={0}
            max={100}
            onChange={(v) => patch("profitSplit", v)}
          />

          <div className="space-y-3 p-3 rounded-lg border border-border/60 bg-background/40">
            <PlannerSwitch
              checked={inputs.consistencyEnabled}
              onChange={(v) => patch("consistencyEnabled", v)}
              label="Consistency rule (funded)"
            />
            <PlannerNumberField
              id="consistencyPct"
              label="Consistency rule"
              hint="%"
              value={inputs.consistencyPct}
              min={0}
              max={100}
              disabled={!inputs.consistencyEnabled}
              onChange={(v) => patch("consistencyPct", v)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlannerNumberField
              id="accCount"
              label="Number of accounts"
              value={inputs.accountCount}
              min={0}
              onChange={(v) => patch("accountCount", v)}
            />
            <PlannerNumberField
              id="scalingPlan"
              label="Scaling plan"
              hint="%"
              value={inputs.scalingPlanPct}
              min={0}
              max={100}
              disabled={inputs.directToFunded}
              onChange={(v) => patch("scalingPlanPct", v)}
            />
          </div>

          <div className="space-y-3 p-3 rounded-lg border border-border/60 bg-background/40">
            <PlannerSwitch
              checked={inputs.accountFeeRecurring}
              onChange={(v) => patch("accountFeeRecurring", v)}
              label="Account fee bills every calendar month"
              disabled={inputs.directToFunded}
            />
            <PlannerNumberField
              id="accountFeeAmount"
              label="Account fee"
              hint="$ per account"
              value={inputs.accountFeeAmount}
              min={0}
              disabled={inputs.directToFunded}
              onChange={(v) => patch("accountFeeAmount", v)}
            />
          </div>

          <div className="space-y-3 p-3 rounded-lg border border-border/60 bg-background/40">
            <PlannerSwitch
              checked={inputs.activationEnabled}
              onChange={(v) => patch("activationEnabled", v)}
              label="Activation fee (when you pass)"
              disabled={inputs.directToFunded}
            />
            <PlannerNumberField
              id="activationFeeAmount"
              label="Activation"
              hint="$ per account, one-time at pass"
              value={inputs.activationFeeAmount}
              min={0}
              disabled={inputs.directToFunded || !inputs.activationEnabled}
              onChange={(v) => patch("activationFeeAmount", v)}
            />
          </div>

          <PlannerNumberField
            id="evalProfitTarget"
            label="Evaluation profit target"
            hint="$ per account"
            value={inputs.evalProfitTarget}
            min={0}
            disabled={inputs.directToFunded}
            onChange={(v) => patch("evalProfitTarget", v)}
          />
        </PlannerSection>

        <PlannerSection title="3 · Payouts & drawdown risk">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlannerNumberField
              id="bufferAmount"
              label="Buffer on funded"
              hint="$ gross"
              value={inputs.bufferAmount}
              onChange={(v) => patch("bufferAmount", v)}
            />
            <PlannerNumberField
              id="firstPayout"
              label="First payout"
              hint="$ gross"
              value={inputs.firstPayout}
              onChange={(v) => patch("firstPayout", v)}
            />
            <PlannerNumberField
              id="recurringPayout"
              label="Recurring payout"
              hint="$ gross"
              value={inputs.recurringPayout}
              onChange={(v) => patch("recurringPayout", v)}
            />
            <PlannerNumberField
              id="maxDrawdown"
              label="Max drawdown"
              hint="$"
              value={inputs.maxDrawdown}
              onChange={(v) => patch("maxDrawdown", v)}
            />
          </div>
        </PlannerSection>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-sm">Results</h3>
          <p className="text-xs text-muted mt-0.5">
            Estimates from your configuration. Expand any section for timelines, payouts, and fees.
          </p>
        </div>

        <PlannerSection title={results.netSplitSectionLabel} defaultOpen>
          <p className="text-sm text-muted">{results.netSplitCaption}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Daily"
              value={formatPlannerCurrency(results.tradingDailyTotal)}
              positive={
                results.negativeTrading
                  ? false
                  : results.tradingDailyTotal > 0
                    ? true
                    : null
              }
            />
            <StatCard
              label="Monthly"
              value={formatPlannerCurrency(results.tradingMonthlyTotal)}
              positive={
                results.negativeTrading
                  ? false
                  : results.tradingMonthlyTotal > 0
                    ? true
                    : null
              }
            />
            <StatCard
              label="Annual"
              value={formatPlannerCurrency(results.tradingAnnualTotal)}
              positive={
                results.negativeTrading
                  ? false
                  : results.tradingAnnualTotal > 0
                    ? true
                    : null
              }
            />
          </div>
        </PlannerSection>

        <PlannerSection title="Payout timeline">
          <div
            className="text-sm text-muted p-3 rounded-lg border border-border/60 bg-background/40"
            dangerouslySetInnerHTML={{ __html: results.timelineBannerHtml }}
          />
          <div className="space-y-3">
            {!inputs.directToFunded && (
              <div className="card p-4 border-primary/30">
                <p className="text-xs text-muted mb-1">Step 1 · Evaluation to pass</p>
                <p className="text-sm font-medium">{results.evalTimelineHtml}</p>
              </div>
            )}
            <div className="card p-4 border-primary/30">
              <p className="text-xs text-muted mb-1">
                Step {inputs.directToFunded ? "1" : "2"} · Funded from zero to first payout
              </p>
              <p className="text-sm font-medium">{results.firstTimelineHtml}</p>
            </div>
            <div className="card p-4 border-primary/30">
              <p className="text-xs text-muted mb-1">
                Step {inputs.directToFunded ? "2" : "3"} · Recurring withdrawals on funded
              </p>
              <p className="text-sm font-medium">{results.recurringTimelineHtml}</p>
            </div>
          </div>
        </PlannerSection>

        <PlannerSection title="Funded consistency & risk">
          <div
            className={`card p-4 space-y-3 ${
              results.consistencyAlertHtml ? "border-danger/50" : ""
            }`}
          >
            <p className="text-xs text-muted">Consistency rule (funded payouts)</p>
            {!inputs.consistencyEnabled ? (
              <p className="text-sm text-muted">
                Turn on <strong>Consistency rule (funded)</strong> in Firm and fees to see daily
                gross caps.
              </p>
            ) : inputs.consistencyPct <= 0 ? (
              <p className="text-sm text-muted">
                Set <strong>Consistency rule (%)</strong> in Firm and fees (e.g. 20 for a 20% cap).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium mb-1">1st payout cap</p>
                  {inputs.firstPayout > 0 ? (
                    <>
                      <p>
                        Max gross per trading day:{" "}
                        <strong>{formatPlannerCurrency(maxFirstGross)}</strong>
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {consistencyPctLabel}% of {formatPlannerCurrency(inputs.firstPayout)}{" "}
                        gross first payout
                      </p>
                    </>
                  ) : (
                    <p className="text-muted">Set first payout in Payouts</p>
                  )}
                </div>
                <div>
                  <p className="font-medium mb-1">Recurring cap</p>
                  {inputs.recurringPayout > 0 ? (
                    <>
                      <p>
                        Max gross per trading day:{" "}
                        <strong>{formatPlannerCurrency(maxRecurringGross)}</strong>
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {consistencyPctLabel}% of {formatPlannerCurrency(inputs.recurringPayout)}{" "}
                        gross recurring payout
                      </p>
                    </>
                  ) : (
                    <p className="text-muted">Set recurring payout in Payouts</p>
                  )}
                </div>
              </div>
            )}
            {results.consistencyAlertHtml && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md p-3">
                <strong>Alert:</strong> {results.consistencyAlertHtml}
              </p>
            )}
          </div>

          <div className="card p-4">
            <p className="text-xs text-muted mb-1">Risk management metric</p>
            <p className="text-sm">
              Consecutive losses to liquidate (est.):{" "}
              <span className="text-danger font-medium">{results.consecutiveLossesText}</span>
            </p>
          </div>
        </PlannerSection>

        <PlannerSection title="Results breakdown">
          <p className="text-sm text-muted">{results.resultsBreakdownNote}</p>
          <ResultsTable
            headers={["Item", "Per account", "All accounts"]}
            rows={[
              {
                cells: [
                  `${results.netSplitSectionLabel} — per trading day`,
                  formatPlannerCurrency(results.netDailyPerAccountFunded),
                  formatPlannerCurrency(results.tradingDailyTotal),
                ],
              },
              {
                cells: [
                  `${results.netSplitSectionLabel} — per trading month`,
                  formatPlannerCurrency(
                    results.netDailyPerAccountFunded * results.tradingDaysPerMonth
                  ),
                  formatPlannerCurrency(results.tradingMonthlyTotal),
                ],
              },
              {
                cells: [
                  `${results.netSplitSectionLabel} — per year`,
                  formatPlannerCurrency(
                    results.netDailyPerAccountFunded * results.tradingDaysPerYear
                  ),
                  formatPlannerCurrency(results.tradingAnnualTotal),
                ],
              },
              {
                cells: ["1st payout (net take-home)", formatPlannerCurrency(results.netFirstPerAcc), formatPlannerCurrency(results.netFirstPerAcc * inputs.accountCount)],
              },
              {
                cells: [
                  "Recurring payout (net take-home)",
                  formatPlannerCurrency(results.netRecPerAcc),
                  formatPlannerCurrency(results.netRecPerAcc * inputs.accountCount),
                ],
              },
            ]}
          />
        </PlannerSection>

        <PlannerSection title="Spend planner">
          <p className="text-sm text-muted">
            Rows show only when they apply to your settings. Timelines and dollar fees are listed
            separately.
          </p>

          {(results.showPlanEval ||
            results.showPlanEvalMonths ||
            results.showPlanFunded ||
            results.showPlanPath) && (
            <>
              <p className="text-xs text-muted uppercase tracking-wide">Plan & timeline</p>
              <ResultsTable
                headers={["Item", "Estimate"]}
                rows={[
                  {
                    hidden: !results.showPlanEval,
                    cells: [
                      "Evaluation to pass (gross)",
                      results.evalDaysPass == null || results.evPerAccount <= 0
                        ? "Not available (expected gross per trading day is zero or negative)"
                        : `${formatTradingDuration(results.evalDaysPass, results.tradingDaysPerMonth)}, gross`,
                    ],
                  },
                  {
                    hidden: !results.showPlanEvalMonths,
                    cells: [
                      "Calendar months of subscription before pass",
                      inputs.accountCount > 0
                        ? `${results.evalSubBillPeriods} calendar months × ${inputs.accountCount} accounts (estimate)`
                        : `${results.evalSubBillPeriods} calendar months (estimate)`,
                    ],
                  },
                  {
                    hidden: !results.showPlanFunded,
                    cells: [
                      "Funded from zero to first payout",
                      results.daysToFirstFunded != null
                        ? `${formatTradingDuration(results.daysToFirstFunded, results.tradingDaysPerMonth)}, gross from zero on funded`
                        : "—",
                    ],
                  },
                  {
                    hidden: !results.showPlanPath,
                    cells: [
                      "Full path to first payout",
                      inputs.directToFunded
                        ? `${formatTradingDuration(results.daysToFirstFunded!, results.tradingDaysPerMonth)} (direct to funded)`
                        : results.evalDaysPass != null
                          ? `${formatTradingDuration(results.evalDaysPass + results.daysToFirstFunded!, results.tradingDaysPerMonth)} (evaluation ${results.evalDaysPass} trading days, then funded ${results.daysToFirstFunded} trading days)`
                          : `${formatTradingDuration(results.daysToFirstFunded!, results.tradingDaysPerMonth)} (funded only — add evaluation target for full path)`,
                    ],
                  },
                ]}
              />
            </>
          )}

          {(results.showFeeMonthly ||
            results.showFeeEvalRecurring ||
            results.showFeeOneTimeEval ||
            results.showFeeActivation ||
            results.showFeeRollup) && (
            <>
              <p className="text-xs text-muted uppercase tracking-wide mt-4">
                Firm fees (per account & all accounts)
              </p>
              <ResultsTable
                headers={["Fee", "Per account", "All accounts"]}
                rows={[
                  {
                    hidden: !results.showFeeMonthly,
                    cells: [
                      "Monthly account fee (recurring)",
                      formatPlannerCurrency(inputs.accountFeeAmount),
                      formatPlannerCurrency(results.recurringCostMonthly),
                    ],
                  },
                  {
                    hidden: !results.showFeeEvalRecurring,
                    cells: [
                      `Subscription during evaluation (${results.evalSubBillPeriods} calendar months)`,
                      results.subCostPerAccEval != null
                        ? formatPlannerCurrency(results.subCostPerAccEval)
                        : "—",
                      formatPlannerCurrency(results.evalSubCostDuringEval),
                    ],
                  },
                  {
                    hidden: !results.showFeeOneTimeEval,
                    cells: [
                      "One-time account fee (evaluation)",
                      formatPlannerCurrency(results.oneTimeEvalPerAccount),
                      formatPlannerCurrency(results.oneTimeEvalTotal),
                    ],
                  },
                  {
                    hidden: !results.showFeeActivation,
                    cells: [
                      "Activation at pass",
                      formatPlannerCurrency(results.activationPerAccount),
                      formatPlannerCurrency(results.activationPassTotal),
                    ],
                  },
                  {
                    hidden: !results.showFeeRollup,
                    cells: [
                      "Pass costs subtotal (eval one-time + activation)",
                      formatPlannerCurrency(
                        results.oneTimeEvalPerAccount + results.activationPerAccount
                      ),
                      formatPlannerCurrency(
                        results.oneTimeEvalTotal + results.activationPassTotal
                      ),
                    ],
                  },
                ]}
              />
              <p className="text-xs text-muted mt-2">
                Activation is due when you pass—not bundled into first evaluation month
                subscription cash.
              </p>
            </>
          )}

          {results.feeWarnMsg && (
            <p className="text-sm text-warning bg-warning/10 border border-warning/30 rounded-md p-3 mt-3">
              {results.feeWarnMsg}
            </p>
          )}
          <p className="text-xs text-muted mt-2">{results.dashboardNote}</p>
        </PlannerSection>
      </div>

      <div
        className="text-xs text-muted card p-4 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: results.keyLegendHtml }}
      />
      <p
        className="text-xs text-muted text-center"
        dangerouslySetInnerHTML={{ __html: results.footerHtml }}
      />
    </div>
  );
}
