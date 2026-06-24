import { createClient, getProfile } from "@/lib/supabase/server";
import { ImportTabs } from "@/components/ImportTabs";
import { listImportAdapters } from "@/lib/imports";
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
  const adapters = listImportAdapters();

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Import Trades</h1>
        <p className="text-muted text-sm mt-1">
          Sync from TopstepX or Tradovate automatically, or upload a CSV from any supported broker.
        </p>
      </div>

      <ImportTabs
        orgOptions={orgOptions}
        accountOptions={accountOptions}
        strategyOptions={(strategies ?? []).map((s) => ({ id: s.id, name: s.name }))}
        topstepxConnections={topstepxConnections}
        tradovateConnections={tradovateConnections}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-5xl">
        <div className="card p-5 space-y-2">
          <h2 className="font-medium text-sm">TopStep X API</h2>
          <ol className="text-xs text-muted list-decimal pl-4 space-y-1">
            <li>Subscribe to ProjectX API in TopstepX Settings</li>
            <li>Copy your username and API key</li>
            <li>Connect above — first sync pulls your trade history</li>
            <li>Use <strong className="text-foreground">Sync now</strong> anytime for new trades</li>
          </ol>
        </div>
        <div className="card p-5 space-y-2">
          <h2 className="font-medium text-sm">TopStep X CSV</h2>
          <ol className="text-xs text-muted list-decimal pl-4 space-y-1">
            <li>Open TopStep X and select your account</li>
            <li>Go to the <strong className="text-foreground">Trades</strong> tab at the bottom</li>
            <li>Click <strong className="text-foreground">Export</strong> and choose your date range</li>
            <li>Upload via the CSV tab — choose &quot;TopStep X&quot; or Auto-detect</li>
          </ol>
        </div>
        <div className="card p-5 space-y-2">
          <h2 className="font-medium text-sm">Tradovate API</h2>
          <ol className="text-xs text-muted list-decimal pl-4 space-y-1">
            <li>Subscribe to API Access in Tradovate Application Settings</li>
            <li>Generate an API key — copy Client ID (cid) and Secret</li>
            <li>Connect above — syncs Position History with duplicate detection</li>
            <li>Use <strong className="text-foreground">Demo</strong> for sim/eval, <strong className="text-foreground">Live</strong> for funded accounts</li>
          </ol>
        </div>
      </div>

      <div className="card p-6 max-w-2xl space-y-3">
        <h2 className="font-medium text-sm">Supported CSV formats</h2>
        <ul className="text-sm text-muted space-y-2">
          {adapters.map((a) => (
            <li key={a.name}>
              <span className="text-foreground">{a.name}</span>
              {a.supportedFields && (
                <span className="block text-xs mt-0.5">
                  Columns: {a.supportedFields.slice(0, 8).join(", ")}
                  {a.supportedFields.length > 8 ? "…" : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

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
