import { createClient, getProfile } from "@/lib/supabase/server";
import { CsvImportForm } from "@/components/CsvImportForm";
import { listImportAdapters } from "@/lib/imports";

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
  const { data: jobs } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("user_id", profile!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: accounts } = await supabase
    .from("trading_accounts")
    .select("id, name, is_default")
    .eq("user_id", profile!.id)
    .order("is_default", { ascending: false })
    .order("name");

  const { data: strategies } = await supabase
    .from("trading_strategies")
    .select("id, name")
    .eq("user_id", profile!.id)
    .eq("is_active", true)
    .order("name");

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
          Upload a CSV exported from TopStep X, Tradovate, or any spreadsheet.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        <div className="card p-5 space-y-2">
          <h2 className="font-medium text-sm">TopStep X</h2>
          <ol className="text-xs text-muted list-decimal pl-4 space-y-1">
            <li>Open TopStep X and select your account</li>
            <li>Go to the <strong className="text-foreground">Trades</strong> tab at the bottom</li>
            <li>Click <strong className="text-foreground">Export</strong> and choose your date range</li>
            <li>Upload the CSV here — choose &quot;TopStep X&quot; or Auto-detect</li>
          </ol>
        </div>
        <div className="card p-5 space-y-2">
          <h2 className="font-medium text-sm">Tradovate</h2>
          <ol className="text-xs text-muted list-decimal pl-4 space-y-1">
            <li>Tradovate → <strong className="text-foreground">Accounts</strong> → gear icon</li>
            <li>Use <strong className="text-foreground">Position History</strong> (best — includes P&L)</li>
            <li>Or Reports → <strong className="text-foreground">Orders</strong> (not Performance)</li>
            <li>Download CSV and upload — choose Tradovate preset</li>
          </ol>
        </div>
      </div>

      <CsvImportForm
        orgOptions={orgOptions}
        accountOptions={accountOptions}
        strategyOptions={(strategies ?? []).map((s) => ({ id: s.id, name: s.name }))}
      />

      <div className="card p-6 max-w-2xl space-y-3">
        <h2 className="font-medium text-sm">Supported formats</h2>
        <ul className="text-sm text-muted space-y-2">
          {adapters.map((a) => (
            <li key={a.name}>
              <span className="text-foreground">{a.name}</span>
              {a.supportedFields && (
                <span className="block text-xs mt-0.5">
                  Columns: {a.supportedFields.join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Tip: Don&apos;t edit the CSV in Excel before importing — it can break dates and numbers.
          Re-importing the same file is safe; duplicate trades are skipped when an ID is present.
        </p>
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
                  <td className="px-4 py-2">{j.imported_count} / {j.row_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
