import { createClient, getProfile } from "@/lib/supabase/server";
import { TradeForm } from "@/components/TradeForm";

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

export default async function NewTradePage() {
  const profile = await getProfile();
  const orgOptions = await getOrgOptions(profile!.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Log a trade</h1>
      <TradeForm orgOptions={orgOptions} />
    </div>
  );
}
