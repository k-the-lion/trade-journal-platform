import { createClient, getProfile } from "@/lib/supabase/server";
import { ImportTabs } from "@/components/ImportTabs";
import { listImportAdapterInfo } from "@/lib/imports";
import {
  getTradovateOAuthRedirectUri,
  isTradovateOAuthConfigured,
} from "@/lib/brokers/tradovate/oauth-config";
import type { BrokerSyncConnectionPublic } from "@/lib/types/database";

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

export default async function ImportPage() {
  const profile = await getProfile();
  const orgOptions = await getOrgOptions(profile!.id);
  const adapters = listImportAdapterInfo();

  const supabase = await createClient();
  const [{ data: jobs }, { data: accounts }, { data: strategies }, { data: connections }] =
    await Promise.all([
      supabase
        .from("import_jobs")
        .select("*")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("trading_accounts")
        .select("id, name, is_default")
        .eq("user_id", profile!.id)
        .order("is_default", { ascending: false })
        .order("name"),
      supabase
        .from("trading_strategies")
        .select("id, name")
        .eq("user_id", profile!.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("broker_sync_connections")
        .select(
          "id, user_id, provider, label, username, external_account_id, external_account_name, trading_account_id, strategy_id, org_id, sync_from, auto_sync, last_synced_at, last_sync_status, last_sync_error, last_sync_imported, is_active, created_at, updated_at"
        )
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false }),
    ]);

  const allConnections = (connections ?? []) as BrokerSyncConnectionPublic[];
  const topstepxConnections = allConnections.filter((c) => c.provider === "topstepx");
  const tradovateConnections = allConnections.filter((c) => c.provider === "tradovate");

  const accountOptions = (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    is_default: a.is_default,
  }));

  const tradovateOAuthConfigured = isTradovateOAuthConfigured();
  const tradovateOAuthRedirectUri = getTradovateOAuthRedirectUri();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Import Trades</h1>
        <p className="text-muted text-sm mt-1">
          Upload a broker CSV, or connect TopstepX or Tradovate for automatic sync.
        </p>
      </div>

      <ImportTabs
        orgOptions={orgOptions}
        accountOptions={accountOptions}
        strategyOptions={(strategies ?? []).map((s) => ({ id: s.id, name: s.name }))}
        topstepxConnections={topstepxConnections}
        tradovateConnections={tradovateConnections}
        tradovateOAuthConfigured={tradovateOAuthConfigured}
        tradovateOAuthRedirectUri={tradovateOAuthRedirectUri}
        adapters={adapters}
      />

      {(jobs ?? []).length > 0 && (
        <div className="card overflow-hidden max-w-2xl">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-medium text-sm">Recent imports</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left">
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Source</th>
                <th className="px-4 py-2 font-normal">Status</th>
                <th className="px-4 py-2 font-normal">Imported</th>
              </tr>
            </thead>
            <tbody>
              {jobs!.map((j) => (
                <tr key={j.id} className="border-t border-border/50">
                  <td className="px-4 py-2">{j.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-2 capitalize">{j.source}</td>
                  <td className="px-4 py-2 capitalize">{j.status}</td>
                  <td className="px-4 py-2">
                    {j.imported_count} / {j.row_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
