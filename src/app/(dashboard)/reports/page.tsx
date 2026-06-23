import { createClient, getProfile } from "@/lib/supabase/server";
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
  breakdownBySetup,
  breakdownByDayOfWeek,
  breakdownByAccountType,
  formatCurrency,
  formatPct,
} from "@/lib/reports/stats";
import type { Trade } from "@/lib/types/database";

export default async function ReportsPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", profile!.id)
    .order("traded_at", { ascending: true });

  const list = (trades ?? []) as Trade[];
  const stats = computeTradeStats(list);
  const equity = computeEquityCurve(list);
  const dailyPnl = computeDailyPnl(list);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted text-sm mt-1">Performance analytics from your logged trades</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total P&L" value={formatCurrency(stats.totalPnl)} positive={stats.totalPnl >= 0 ? true : false} />
        <StatCard label="Win rate" value={formatPct(stats.winRate)} sub={`${stats.totalTrades} trades`} />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownChart data={breakdownBySymbol(list)} title="P&L by Symbol" />
        <BreakdownChart data={breakdownBySetup(list)} title="P&L by Setup" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownTable data={breakdownByDayOfWeek(list)} title="By Day of Week" />
        <BreakdownTable data={breakdownByAccountType(list)} title="By Account Type" />
      </div>
    </div>
  );
}
