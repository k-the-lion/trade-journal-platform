import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlaybookEditor } from "@/components/PlaybookEditor";
import type { CoachingPlaybook } from "@/lib/types/database";

export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: orgId } = await searchParams;
  const supabase = await createClient();

  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">AI Coaching Playbook</h1>
        <p className="text-muted text-sm">Select an organization from the coach dashboard to edit its playbook.</p>
        <Link href="/coach" className="btn btn-secondary inline-flex">Back to coach</Link>
      </div>
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (!org) notFound();

  let { data: playbook } = await supabase
    .from("coaching_playbooks")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (!playbook) {
    const { data: created } = await supabase
      .from("coaching_playbooks")
      .insert({
        org_id: orgId,
        name: `${org.name} Playbook`,
        tone: "supportive",
        custom_rules: "Never give buy/sell signals.",
        is_active: true,
      })
      .select()
      .single();
    playbook = created;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-muted hover:text-primary">← Coach</Link>
        <h1 className="text-2xl font-semibold mt-1">Playbook — {org.name}</h1>
      </div>
      <PlaybookEditor playbook={playbook as CoachingPlaybook} />
    </div>
  );
}
