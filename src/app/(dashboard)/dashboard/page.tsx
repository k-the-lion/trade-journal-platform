import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/data";
import { BrokerSyncRefresh } from "@/components/BrokerSyncRefresh";
import { TradeJournalBoard } from "@/components/TradeJournalBoard";

export default async function DashboardPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const [{ accounts, strategies, tagPresets, trades }, { count: connectionCount }] =
    await Promise.all([
      getDashboardData(profile!.id),
      supabase
        .from("broker_sync_connections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile!.id)
        .eq("is_active", true)
        .in("provider", ["topstepx", "tradovate"]),
    ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-muted text-sm mt-1">
            Journal your trades, track strategies, and review performance by account
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 shrink-0">
          <BrokerSyncRefresh connectionCount={connectionCount ?? 0} />
          <Link href="/journal" className="btn btn-primary text-sm shrink-0">
            Daily journal
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
