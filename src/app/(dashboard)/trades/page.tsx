import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/reports/stats";
import type { Trade } from "@/lib/types/database";

export default async function TradesPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: trades } = await supabase
    .from("trades")
    .select("*, trade_tags(*)")
    .eq("user_id", profile!.id)
    .order("traded_at", { ascending: false });

  const list = (trades ?? []) as Trade[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trades</h1>
          <p className="text-muted text-sm">{list.length} logged</p>
        </div>
        <Link href="/trades/new" className="btn btn-primary">Log trade</Link>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <p>No trades yet.</p>
          <Link href="/trades/new" className="btn btn-primary mt-4 inline-flex">Log your first trade</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left">
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Symbol</th>
                <th className="px-4 py-2 font-normal">Dir</th>
                <th className="px-4 py-2 font-normal">Setup</th>
                <th className="px-4 py-2 font-normal">P&L</th>
                <th className="px-4 py-2 font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-border/50 hover:bg-white/5">
                  <td className="px-4 py-2">{t.traded_at.slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/trades/${t.id}`} className="text-primary hover:underline">{t.symbol}</Link>
                  </td>
                  <td className="px-4 py-2 capitalize">{t.direction}</td>
                  <td className="px-4 py-2 text-muted">{t.setup_tag ?? "—"}</td>
                  <td className={`px-4 py-2 ${Number(t.pnl) >= 0 ? "positive" : "negative"}`}>
                    {formatCurrency(Number(t.pnl))}
                  </td>
                  <td className="px-4 py-2 text-muted capitalize">{t.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
