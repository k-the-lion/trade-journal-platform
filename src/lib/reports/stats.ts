import type { Trade } from "@/lib/types/database";
import { computeHoldStats, formatAvgHoldMinutes } from "@/lib/trades/datetime";

export interface TradeStats {
  totalTrades: number;
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  ruleFollowedPct: number;
  currentStreak: number;
  currentStreakType: "win" | "loss" | "none";
  maxDrawdown: number;
  bestDay: number;
  worstDay: number;
  avgHoldMinutes: number | null;
  tradesWithHold: number;
}

export interface EquityPoint {
  date: string;
  cumulativePnl: number;
  tradeCount: number;
}

export interface BreakdownItem {
  label: string;
  count: number;
  pnl: number;
  winRate: number;
}

function round(n: number, decimals = 2) {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

export function computeTradeStats(trades: Trade[]): TradeStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      totalPnl: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      ruleFollowedPct: 0,
      currentStreak: 0,
      currentStreakType: "none",
      maxDrawdown: 0,
      bestDay: 0,
      worstDay: 0,
      avgHoldMinutes: null,
      tradesWithHold: 0,
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl), 0);
  const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0));
  const winRate = (wins.length / trades.length) * 100;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const lossRate = 100 - winRate;
  const expectancy = (avgWin * (winRate / 100)) - (avgLoss * (lossRate / 100));

  const withRules = trades.filter((t) => t.rule_followed !== null);
  const ruleFollowedPct =
    withRules.length > 0
      ? (withRules.filter((t) => t.rule_followed).length / withRules.length) * 100
      : 0;

  const sorted = [...trades].sort(
    (a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime()
  );

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  for (const t of sorted) {
    cumulative += Number(t.pnl);
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const dailyPnl = new Map<string, number>();
  for (const t of trades) {
    const day = t.traded_at.slice(0, 10);
    dailyPnl.set(day, (dailyPnl.get(day) ?? 0) + Number(t.pnl));
  }
  const dailyValues = [...dailyPnl.values()];
  const bestDay = dailyValues.length ? Math.max(...dailyValues) : 0;
  const worstDay = dailyValues.length ? Math.min(...dailyValues) : 0;

  let streak = 0;
  let streakType: "win" | "loss" | "none" = "none";
  for (let i = sorted.length - 1; i >= 0; i--) {
    const isWin = sorted[i].pnl > 0;
    const type = isWin ? "win" : sorted[i].pnl < 0 ? "loss" : "none";
    if (streakType === "none") {
      if (type === "none") break;
      streakType = type;
      streak = 1;
    } else if (type === streakType) {
      streak++;
    } else {
      break;
    }
  }

  const holdStats = computeHoldStats(trades);

  return {
    totalTrades: trades.length,
    totalPnl: round(totalPnl),
    winRate: round(winRate, 1),
    profitFactor: profitFactor === Infinity ? 999 : round(profitFactor),
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    expectancy: round(expectancy),
    ruleFollowedPct: round(ruleFollowedPct, 1),
    currentStreak: streak,
    currentStreakType: streakType,
    maxDrawdown: round(maxDrawdown),
    bestDay: round(bestDay),
    worstDay: round(worstDay),
    avgHoldMinutes: holdStats.avgHoldMinutes,
    tradesWithHold: holdStats.tradesWithHold,
  };
}

export function computeEquityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime()
  );

  let cumulative = 0;
  return sorted.map((t, i) => {
    cumulative += Number(t.pnl);
    return {
      date: t.traded_at.slice(0, 10),
      cumulativePnl: round(cumulative),
      tradeCount: i + 1,
    };
  });
}

export function breakdownByField(
  trades: Trade[],
  getLabel: (t: Trade) => string | null | undefined,
  unsetLabel = "Unassigned"
): BreakdownItem[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const label = getLabel(t)?.trim() || unsetLabel;
    const list = groups.get(label) ?? [];
    list.push(t);
    groups.set(label, list);
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const wins = group.filter((t) => t.pnl > 0).length;
      return {
        label,
        count: group.length,
        pnl: round(group.reduce((s, t) => s + Number(t.pnl), 0)),
        winRate: round((wins / group.length) * 100, 1),
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

function breakdownByMultiLabel(
  trades: Trade[],
  getLabels: (t: Trade) => string[],
  unsetLabel = "Unassigned"
): BreakdownItem[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const labels = getLabels(t).map((l) => l.trim()).filter(Boolean);
    const keys = labels.length > 0 ? labels : [unsetLabel];
    for (const label of keys) {
      const list = groups.get(label) ?? [];
      list.push(t);
      groups.set(label, list);
    }
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const wins = group.filter((t) => t.pnl > 0).length;
      return {
        label,
        count: group.length,
        pnl: round(group.reduce((s, t) => s + Number(t.pnl), 0)),
        winRate: round((wins / group.length) * 100, 1),
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

export function breakdownByDayOfWeek(trades: Trade[]): BreakdownItem[] {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return breakdownByField(trades, (t) => days[new Date(t.traded_at).getDay()]);
}

export function breakdownBySymbol(trades: Trade[]): BreakdownItem[] {
  return breakdownByField(trades, (t) => t.symbol);
}

export function breakdownByStrategy(trades: Trade[]): BreakdownItem[] {
  return breakdownByField(trades, (t) => {
    if (t.trading_strategies?.name) return t.trading_strategies.name;
    if (t.strategy_id && t.setup_tag) return t.setup_tag;
    return null;
  });
}

export function breakdownByAccount(trades: Trade[]): BreakdownItem[] {
  return breakdownByField(trades, (t) => t.trading_accounts?.name ?? null);
}

export function breakdownByTags(trades: Trade[]): BreakdownItem[] {
  return breakdownByMultiLabel(
    trades,
    (t) => (t.trade_tags ?? []).map((row) => row.tag),
    "Untagged"
  );
}

export function breakdownByDirection(trades: Trade[]): BreakdownItem[] {
  return breakdownByField(trades, (t) =>
    t.direction === "long" ? "Long" : t.direction === "short" ? "Short" : null
  );
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  csv: "CSV import",
  tradovate: "Tradovate",
  ninjatrader: "NinjaTrader",
  tradingview: "TradingView",
  other: "Other",
};

export function breakdownBySource(trades: Trade[]): BreakdownItem[] {
  return breakdownByField(trades, (t) => SOURCE_LABELS[t.source] ?? t.source);
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  eval: "Eval",
  funded: "Funded",
  personal: "Personal",
  live: "Live",
  paper: "Paper",
};

export function breakdownByAccountType(trades: Trade[]): BreakdownItem[] {
  return breakdownByField(trades, (t) =>
    t.account_type ? ACCOUNT_TYPE_LABELS[t.account_type] ?? t.account_type : null
  );
}

export function breakdownByRuleFollowed(trades: Trade[]): BreakdownItem[] {
  return breakdownByField(trades, (t) => {
    if (t.rule_followed === true) return "Rules followed";
    if (t.rule_followed === false) return "Rules broken";
    return "Not tracked";
  }, "Not tracked");
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

export function computeDailyPnl(trades: Trade[]): Record<string, number> {
  const daily = new Map<string, number>();
  for (const t of trades) {
    const day = t.traded_at.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + Number(t.pnl));
  }
  const result: Record<string, number> = {};
  for (const [day, pnl] of daily) {
    result[day] = round(pnl);
  }
  return result;
}
