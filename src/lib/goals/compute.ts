import { formatCurrency } from "@/lib/reports/stats";
import type {
  DailyJournalEntry,
  Trade,
  UserTradingGoals,
} from "@/lib/types/database";

export type GoalStatus = "on_track" | "at_risk" | "respected" | "neutral";

export interface GoalMetricCard {
  id: string;
  label: string;
  currentLabel: string;
  targetLabel: string;
  progressPct: number;
  status: GoalStatus;
  detail: string;
  positive: boolean | null;
}

export interface GoalsProgress {
  monthLabel: string;
  daysLeft: number;
  metrics: GoalMetricCard[];
  projectedMonthEnd: number | null;
  projectedDetail: string | null;
  bestDayOfWeek: { day: string; avgPnl: number } | null;
  worstDayOfWeek: { day: string; avgPnl: number } | null;
  consistencyScore: number;
  consistencyBreakdown: Array<{ label: string; pct: number }>;
  violations: Array<{ date: string; label: string }>;
  hasAnyGoals: boolean;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function monthBounds(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const daysInMonth = end.getUTCDate();
  const dayOfMonth = now.getUTCDate();
  return { start, end, daysInMonth, dayOfMonth, daysLeft: daysInMonth - dayOfMonth };
}

function isInMonth(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function journalHasContent(entry: DailyJournalEntry): boolean {
  return Boolean(
    entry.mood ||
      entry.day_summary?.trim() ||
      entry.went_well?.trim() ||
      entry.to_improve?.trim() ||
      entry.lessons_learned?.trim() ||
      entry.tomorrow_focus?.trim() ||
      entry.discipline_rating
  );
}

function statusBadge(
  progressPct: number,
  inverted: boolean,
  hasTarget: boolean
): GoalStatus {
  if (!hasTarget) return "neutral";
  const effective = inverted ? 100 - progressPct : progressPct;
  if (effective >= 75) return inverted ? "respected" : "on_track";
  if (effective >= 40) return "neutral";
  return "at_risk";
}

export function computeGoalsProgress(
  goals: UserTradingGoals | null,
  trades: Trade[],
  journals: DailyJournalEntry[],
  now = new Date()
): GoalsProgress {
  const { start, end, daysInMonth, dayOfMonth, daysLeft } = monthBounds(now);
  const monthTrades = trades.filter((t) => isInMonth(t.traded_at, start, end));
  const monthJournals = journals.filter((j) => {
    const d = new Date(`${j.journal_date}T12:00:00Z`);
    return d >= start && d <= end;
  });

  const monthLabel = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const totalPnl = monthTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const wins = monthTrades.filter((t) => Number(t.pnl) > 0);
  const winRate = monthTrades.length ? (wins.length / monthTrades.length) * 100 : 0;

  const dailyPnl = new Map<string, number>();
  for (const t of monthTrades) {
    const day = t.traded_at.slice(0, 10);
    dailyPnl.set(day, (dailyPnl.get(day) ?? 0) + Number(t.pnl));
  }
  const dailyValues = [...dailyPnl.values()];
  const worstDay = dailyValues.length ? Math.min(...dailyValues) : 0;

  const tradingDays = new Set(monthTrades.map((t) => t.traded_at.slice(0, 10)));
  const journaledDays = new Set(
    monthJournals.filter(journalHasContent).map((j) => j.journal_date)
  );
  const journalingPct =
    tradingDays.size > 0
      ? Math.round(([...tradingDays].filter((d) => journaledDays.has(d)).length / tradingDays.size) * 100)
      : monthJournals.filter(journalHasContent).length > 0
        ? 100
        : 0;

  const profitTarget = goals?.monthly_profit_target ?? null;
  const winRateTarget = goals?.min_win_rate_pct ?? null;
  const maxDailyLoss = goals?.max_daily_loss ?? null;
  const tradeTarget = goals?.monthly_trade_target ?? null;

  const metrics: GoalMetricCard[] = [];

  if (profitTarget !== null && profitTarget > 0) {
    const progressPct = Math.min(100, Math.round((totalPnl / profitTarget) * 100));
    const remaining = profitTarget - totalPnl;
    metrics.push({
      id: "profit",
      label: "Monthly profit target",
      currentLabel: formatCurrency(totalPnl),
      targetLabel: formatCurrency(profitTarget),
      progressPct,
      status: statusBadge(progressPct, false, true),
      detail:
        remaining > 0
          ? `${formatCurrency(remaining)} remaining · ${daysLeft} days left`
          : `Target reached · ${daysLeft} days left`,
      positive: totalPnl >= 0 ? true : false,
    });
  }

  if (winRateTarget !== null && winRateTarget > 0) {
    const progressPct = Math.min(100, Math.round((winRate / winRateTarget) * 100));
    const gap = winRateTarget - winRate;
    metrics.push({
      id: "winrate",
      label: "Minimum win rate",
      currentLabel: `${Math.round(winRate)}%`,
      targetLabel: `${Math.round(winRateTarget)}%`,
      progressPct,
      status: winRate >= winRateTarget ? "on_track" : gap > 15 ? "at_risk" : "neutral",
      detail:
        winRate >= winRateTarget
          ? "At or above target"
          : `${Math.round(gap)}% below target`,
      positive: winRate >= winRateTarget ? true : false,
    });
  }

  if (maxDailyLoss !== null && maxDailyLoss > 0) {
    const limit = -Math.abs(maxDailyLoss);
    const usedPct = Math.min(100, Math.round((Math.abs(worstDay) / maxDailyLoss) * 100));
    const respected = worstDay >= limit;
    metrics.push({
      id: "dailyloss",
      label: "Max daily loss limit",
      currentLabel: formatCurrency(worstDay),
      targetLabel: formatCurrency(limit),
      progressPct: respected ? Math.max(0, 100 - usedPct) : usedPct,
      status: respected ? "respected" : "at_risk",
      detail: respected
        ? `Worst day: ${formatCurrency(Math.abs(worstDay))} — limit respected`
        : `Worst day breached limit by ${formatCurrency(Math.abs(worstDay - limit))}`,
      positive: respected ? true : false,
    });
  }

  if (tradeTarget !== null && tradeTarget > 0) {
    const progressPct = Math.min(100, Math.round((monthTrades.length / tradeTarget) * 100));
    const remaining = tradeTarget - monthTrades.length;
    const perDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
    metrics.push({
      id: "trades",
      label: "Trade count target",
      currentLabel: String(monthTrades.length),
      targetLabel: `${tradeTarget} trades`,
      progressPct,
      status: statusBadge(progressPct, false, true),
      detail:
        remaining > 0
          ? daysLeft > 0
            ? `Need ${perDay} trades/day to hit target`
            : `${remaining} trades short of target`
          : "Target reached",
      positive: monthTrades.length >= tradeTarget ? true : null,
    });
  }

  let projectedMonthEnd: number | null = null;
  let projectedDetail: string | null = null;
  if (profitTarget !== null && profitTarget > 0 && dayOfMonth > 0) {
    projectedMonthEnd = (totalPnl / dayOfMonth) * daysInMonth;
    const shortfall = profitTarget - projectedMonthEnd;
    projectedDetail =
      shortfall > 0
        ? `${formatCurrency(shortfall)} short of goal at this pace`
        : "On pace to hit profit target";
  }

  const weekdayTotals = new Map<number, { sum: number; count: number }>();
  for (const t of monthTrades) {
    const wd = new Date(t.traded_at).getUTCDay();
    const bucket = weekdayTotals.get(wd) ?? { sum: 0, count: 0 };
    bucket.sum += Number(t.pnl);
    bucket.count += 1;
    weekdayTotals.set(wd, bucket);
  }
  const weekdayAvgs = [...weekdayTotals.entries()]
    .map(([wd, { sum, count }]) => ({
      day: WEEKDAYS[wd],
      avgPnl: sum / count,
    }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  const pacePct =
    profitTarget && profitTarget > 0
      ? Math.min(100, Math.round((totalPnl / profitTarget) * 100))
      : 0;
  const volumePct =
    tradeTarget && tradeTarget > 0
      ? Math.min(100, Math.round((monthTrades.length / tradeTarget) * 100))
      : 0;
  const winRatePct =
    winRateTarget && winRateTarget > 0
      ? Math.min(100, Math.round((winRate / winRateTarget) * 100))
      : 0;

  const consistencyBreakdown = [
    { label: "Journaling", pct: journalingPct },
    { label: "Trade volume", pct: volumePct },
    { label: "Win rate", pct: winRatePct },
    { label: "Pace", pct: pacePct },
  ];
  const consistencyScore = Math.round(
    consistencyBreakdown.reduce((s, x) => s + x.pct, 0) / consistencyBreakdown.length
  );

  const violations = monthTrades
    .filter((t) => t.rule_followed === false)
    .sort((a, b) => b.traded_at.localeCompare(a.traded_at))
    .slice(0, 20)
    .map((t) => ({
      date: t.traded_at.slice(0, 10),
      label: t.setup_tag ? `Rules broken — ${t.setup_tag}` : "Rules broken",
    }));

  return {
    monthLabel,
    daysLeft,
    metrics,
    projectedMonthEnd,
    projectedDetail,
    bestDayOfWeek: weekdayAvgs[0] ?? null,
    worstDayOfWeek: weekdayAvgs.length ? weekdayAvgs[weekdayAvgs.length - 1] : null,
    consistencyScore,
    consistencyBreakdown,
    violations,
    hasAnyGoals: metrics.length > 0,
  };
}
