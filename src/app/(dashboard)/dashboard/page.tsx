import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import {
  computeTradeStats,
  formatCurrency,
  formatPct,
} from "@/lib/reports/stats";
import type { Trade } from "@/lib/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", profile!.id)
    .order("traded_at", { ascending: false });

  const stats = computeTradeStats((trades ?? []) as Trade[]);
  const recent = (trades ?? []).slice(0, 5) as Trade[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted text-sm mt-1">Your trading journal overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total P&L" value={formatCurrency(stats.totalPnl)} positive={stats.totalPnl >= 0 ? true : stats.totalPnl < 0 ? false : null} />
        <StatCard label="Win rate" value={formatPct(stats.winRate)} sub={`${stats.totalTrades} trades`} />
        <StatCard label="Profit factor" value={String(stats.profitFactor)} />
        <StatCard label="Rule adherence" value={formatPct(stats.ruleFollowedPct)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/trades/new" className="btn btn-primary">Log a trade</Link>
        <Link href="/chat" className="btn btn-secondary">Talk to AI coach</Link>
        <Link href="/reports" className="btn btn-secondary">View reports</Link>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
          <h2 className="font-medium">Recent trades</h2>
          <Link href="/trades" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-muted">No trades yet. Log your first trade to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left">
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Symbol</th>
                <th className="px-4 py-2 font-normal">Direction</th>
                <th className="px-4 py-2 font-normal">P&L</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className="border-t border-border/50">
                  <td className="px-4 py-2">{t.traded_at.slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/trades/${t.id}`} className="text-primary hover:underline">{t.symbol}</Link>
                  </td>
                  <td className="px-4 py-2 capitalize">{t.direction}</td>
                  <td className={`px-4 py-2 ${Number(t.pnl) >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(Number(t.pnl))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
