import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/data";
import { TradeJournalBoard } from "@/components/TradeJournalBoard";

export default async function DashboardPage() {
  const profile = await getProfile();

  const { accounts, strategies, tagPresets, trades } = await getDashboardData(profile!.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-muted text-sm mt-1">
            Journal your trades, track strategies, and review performance by account
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/trades/new" className="btn btn-primary">
            Log a trade
          </Link>
          <Link href="/import" className="btn btn-secondary">
            Import CSV
          </Link>
          <Link href="/chat" className="btn btn-secondary">
            AI coach
          </Link>
          <Link href="/reports" className="btn btn-secondary">
            Reports
          </Link>
        </div>
      </div>

      <TradeJournalBoard
        initialTrades={trades}
        accounts={accounts}
        strategies={strategies}
        tagPresets={tagPresets}
      />
    </div>
  );
}
