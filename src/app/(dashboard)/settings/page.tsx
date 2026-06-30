import { redirect } from "next/navigation";
import { SettingsView, type SettingsTab } from "@/components/SettingsView";
import { createClient, getProfile } from "@/lib/supabase/server";
import type {
  TradingAccount,
  TradingStrategy,
  TradingTagPreset,
  UserCoachPlaybook,
} from "@/lib/types/database";

const VALID_TABS: SettingsTab[] = [
  "profile",
  "accounts",
  "strategies",
  "playbooks",
  "coach",
  "danger",
];

function isPlaybooksTableMissing(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST205" ||
    error?.message?.includes("user_coach_playbooks") === true
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const isCoach =
    profile.platform_role === "coach" || profile.platform_role === "admin";

  let activeTab: SettingsTab = "profile";
  if (tab && VALID_TABS.includes(tab as SettingsTab)) {
    const requested = tab as SettingsTab;
    if (requested === "coach" && !isCoach) {
      activeTab = "profile";
    } else {
      activeTab = requested;
    }
  }

  const supabase = await createClient();
  const [
    { data: playbooks, error: playbooksError },
    { data: accounts },
    { data: strategies },
    { data: tagPresets },
    { count: tradeCount },
  ] = await Promise.all([
    supabase
      .from("user_coach_playbooks")
      .select("*")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("trading_accounts")
      .select("*")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("name"),
    supabase
      .from("trading_strategies")
      .select("*")
      .eq("user_id", profile.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("trading_tag_presets")
      .select("*")
      .eq("user_id", profile.id)
      .order("sort_order")
      .order("name"),
    supabase
      .from("trades")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id),
  ]);

  const tabTitles: Record<SettingsTab, string> = {
    profile: "Profile & security",
    accounts: "Trading accounts",
    strategies: "Strategies & tags",
    playbooks: "AI playbooks",
    coach: "Coach groups",
    danger: "Danger zone",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted text-sm mt-1">{tabTitles[activeTab]}</p>
      </div>
      <SettingsView
        activeTab={activeTab}
        profile={profile}
        accounts={(accounts ?? []) as TradingAccount[]}
        strategies={(strategies ?? []) as TradingStrategy[]}
        tagPresets={(tagPresets ?? []) as TradingTagPreset[]}
        playbooks={(playbooks ?? []) as UserCoachPlaybook[]}
        playbooksUnavailable={isPlaybooksTableMissing(playbooksError)}
        isCoach={isCoach}
        tradeCount={tradeCount ?? 0}
      />
    </div>
  );
}
