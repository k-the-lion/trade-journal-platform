import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { TradeForm } from "@/components/TradeForm";
import { DeleteTradeButton } from "@/components/DeleteTradeButton";
import { formatCurrency } from "@/lib/reports/stats";
import type { Trade } from "@/lib/types/database";

async function getOrgOptions(userId: string) {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, organizations(id, name)")
    .eq("user_id", userId);

  return (memberships ?? [])
    .map((m) => {
      const org = m.organizations as unknown as { id: string; name: string } | null;
      return org ? { id: org.id, name: org.name } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];
}

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: trade } = await supabase
    .from("trades")
    .select("*, trade_tags(*)")
    .eq("id", id)
    .eq("user_id", profile!.id)
    .single();

  if (!trade) notFound();

  const orgOptions = await getOrgOptions(profile!.id);

  const { data: accounts } = await supabase
    .from("trading_accounts")
    .select("id, name")
    .eq("user_id", profile!.id)
    .order("name");

  const t = trade as Trade;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-muted hover:text-primary">← Dashboard</Link>
          <h1 className="text-2xl font-semibold mt-1">
            {t.symbol}{" "}
            <span className={Number(t.pnl) >= 0 ? "positive" : "negative"}>
              {formatCurrency(Number(t.pnl))}
            </span>
          </h1>
        </div>
        <DeleteTradeButton
          tradeId={id}
          tradeLabel={`${t.symbol} (${formatCurrency(Number(t.pnl))})`}
          redirectTo="/dashboard"
        />
      </div>
      <TradeForm
        trade={t}
        orgOptions={orgOptions}
        accountOptions={(accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
