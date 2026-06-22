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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Import Trades</h1>
        <p className="text-muted text-sm mt-1">
          Upload a CSV with flexible column mapping. Broker API sync coming soon.
        </p>
      </div>

      <CsvImportForm orgOptions={orgOptions} />

      <div className="card p-6 max-w-2xl space-y-3">
        <h2 className="font-medium text-sm">Available import sources</h2>
        <ul className="text-sm text-muted space-y-2">
          {adapters.map((a) => (
            <li key={a.source}>
              <span className="text-foreground capitalize">{a.name}</span>
              {a.supportedFields && (
                <span className="block text-xs mt-0.5">
                  Fields: {a.supportedFields.join(", ")}
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
