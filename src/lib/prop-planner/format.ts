const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPlannerCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatTradingDuration(
  tradingDays: number,
  tradingDaysPerMonth: number
): string {
  const perMonth = tradingDaysPerMonth > 0 ? tradingDaysPerMonth : 21;
  const approxMonths = (tradingDays / perMonth).toFixed(1);
  return `${tradingDays} trading day${tradingDays === 1 ? "" : "s"} (~${approxMonths} mo)`;
}

export function clampTradingDaysPerMonth(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 21;
  return Math.min(21, value);
}

export function clampScalingPlanPct(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
}

export function clampConsistencyPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
