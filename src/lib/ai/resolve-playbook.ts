import type { CoachingPlaybook } from "@/lib/types/database";
import type { createClient } from "@/lib/supabase/server";

export const PLAYBOOK_AUTO = "auto";
export const PLAYBOOK_DEFAULT = "default";
export const PLAYBOOK_ORG = "org";

export function platformDefaultPlaybook(): CoachingPlaybook {
  return {
    id: "default",
    org_id: null,
    name: "Default coach",
    tone: "supportive",
    topics_to_emphasize: ["risk management", "rule adherence", "patience"],
    topics_to_avoid: ["specific trade calls", "guaranteed outcomes"],
    custom_rules: "Never give buy/sell signals. Focus on process and discipline.",
    review_checklist: "Ask reflective questions before giving advice.",
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function fromUserRow(row: {
  id: string;
  name: string;
  tone: string;
  topics_to_emphasize: string[];
  topics_to_avoid: string[];
  custom_rules: string;
  review_checklist: string;
}): CoachingPlaybook {
  return {
    id: row.id,
    org_id: null,
    name: row.name,
    tone: row.tone,
    topics_to_emphasize: row.topics_to_emphasize,
    topics_to_avoid: row.topics_to_avoid,
    custom_rules: row.custom_rules,
    review_checklist: row.review_checklist,
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function resolvePlaybookForChat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  playbookKey: string,
  orgId: string | null
): Promise<CoachingPlaybook> {
  const key = playbookKey || PLAYBOOK_AUTO;

  async function loadUserPlaybook(id: string) {
    const { data } = await supabase
      .from("user_coach_playbooks")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? fromUserRow(data) : null;
  }

  async function loadOrgPlaybook() {
    if (!orgId) return null;
    const { data } = await supabase
      .from("coaching_playbooks")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as CoachingPlaybook | null;
  }

  async function loadDefaultUserPlaybook() {
    const { data } = await supabase
      .from("user_coach_playbooks")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    return data ? fromUserRow(data) : null;
  }

  async function loadPlatformPlaybook() {
    const { data } = await supabase
      .from("coaching_playbooks")
      .select("*")
      .is("org_id", null)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return (data as CoachingPlaybook | null) ?? platformDefaultPlaybook();
  }

  if (key !== PLAYBOOK_AUTO && key !== PLAYBOOK_DEFAULT && key !== PLAYBOOK_ORG) {
    const personal = await loadUserPlaybook(key);
    if (personal) return personal;
  }

  if (key === PLAYBOOK_DEFAULT) {
    return loadPlatformPlaybook();
  }

  if (key === PLAYBOOK_ORG) {
    const orgPlaybook = await loadOrgPlaybook();
    if (orgPlaybook) return orgPlaybook;
    return loadPlatformPlaybook();
  }

  // auto: personal default → org coach → platform
  const personalDefault = await loadDefaultUserPlaybook();
  if (personalDefault) return personalDefault;

  const orgPlaybook = await loadOrgPlaybook();
  if (orgPlaybook) return orgPlaybook;

  return loadPlatformPlaybook();
}
