import { createClient, getProfile } from "@/lib/supabase/server";
import { CoachPanel } from "@/components/CoachPanel";
import type { Organization } from "@/lib/types/database";

export default async function CoachPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: owned } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", profile!.id);

  const { data: coached } = await supabase
    .from("org_members")
    .select("organizations(*)")
    .eq("user_id", profile!.id)
    .eq("role", "coach");

  const fromMembership = (coached ?? [])
    .map((m) => m.organizations as unknown as Organization)
    .filter(Boolean);

  const orgMap = new Map<string, Organization>();
  for (const o of [...(owned ?? []), ...fromMembership] as Organization[]) {
    orgMap.set(o.id, o);
  }

  const organizations = [...orgMap.values()];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Coach Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Create groups, invite students, and configure AI coaching playbooks
        </p>
      </div>
      <CoachPanel organizations={organizations} />
    </div>
  );
}
