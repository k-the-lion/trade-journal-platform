import Link from "next/link";
import { redirect } from "next/navigation";
import { GoalsDashboard } from "@/components/GoalsDashboard";
import { PropPlanner } from "@/components/PropPlanner";
import { createClient, getProfile } from "@/lib/supabase/server";
import type {
  DailyJournalEntry,
  Trade,
  UserTradingGoals,
  UserTradingRule,
} from "@/lib/types/database";

export type ToolsTab = "goals" | "planner";

const TABS: Array<{ id: ToolsTab; label: string }> = [
  { id: "goals", label: "Goals" },
  { id: "planner", label: "Prop Planner" },
];

const TAB_TITLES: Record<ToolsTab, { title: string; description: string }> = {
  goals: {
    title: "Trading goals",
    description:
      "Set monthly targets and track profit, win rate, daily loss limits, and consistency against your live journal data.",
  },
  planner: {
    title: "Prop Planner",
    description:
      "Plan evaluation timelines, payout schedules, firm fees, and risk. This is a planning tool — it does not model firm-specific payout rules or complex trailing drawdown mechanics.",
  },
};

function tabClass(active: boolean) {
  return `shrink-0 px-4 py-2 rounded-full text-sm border transition-colors ${
    active
      ? "border-primary bg-primary/15 text-primary"
      : "border-border text-muted hover:border-primary/40 hover:text-foreground"
  }`;
}

function isGoalsTableMissing(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST205" ||
    error?.message?.includes("user_trading_goals") === true
  );
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const validTab = TABS.some((t) => t.id === tab);
  if (tab && !validTab) {
    redirect("/tools?tab=goals");
  }

  const activeTab: ToolsTab = validTab ? (tab as ToolsTab) : "goals";
  const { title, description } = TAB_TITLES[activeTab];

  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const [
    { data: goals, error: goalsError },
    { data: rules },
    { data: trades },
    { data: journals },
  ] = await Promise.all([
    supabase.from("user_trading_goals").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase
      .from("user_trading_rules")
      .select("*")
      .eq("user_id", profile.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", profile.id)
      .order("traded_at", { ascending: false }),
    supabase
      .from("daily_journal_entries")
      .select("*")
      .eq("user_id", profile.id)
      .gte("journal_date", monthStart)
      .order("journal_date", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tools</h1>
        <p className="text-muted text-sm mt-1">
          Planning, goals, and utility tools for your trading workflow.
        </p>
      </div>

      <nav
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
        aria-label="Tools sections"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/tools?tab=${t.id}`}
            className={tabClass(activeTab === t.id)}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === "goals" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium">{title}</h2>
            <p className="text-muted text-sm mt-1">{description}</p>
          </div>
          <GoalsDashboard
            initialGoals={(goals as UserTradingGoals | null) ?? null}
            initialRules={(rules ?? []) as UserTradingRule[]}
            trades={(trades ?? []) as Trade[]}
            journals={(journals ?? []) as DailyJournalEntry[]}
            goalsUnavailable={isGoalsTableMissing(goalsError)}
          />
        </div>
      )}

      {activeTab === "planner" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium">{title}</h2>
            <p className="text-muted text-sm mt-1">{description}</p>
          </div>
          <PropPlanner />
        </div>
      )}
    </div>
  );
}
