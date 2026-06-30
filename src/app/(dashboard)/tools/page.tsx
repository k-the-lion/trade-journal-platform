import Link from "next/link";
import { redirect } from "next/navigation";
import { PropPlanner } from "@/components/PropPlanner";

export type ToolsTab = "planner";

const TABS: Array<{ id: ToolsTab; label: string }> = [
  { id: "planner", label: "Prop Planner" },
];

const TAB_TITLES: Record<ToolsTab, { title: string; description: string }> = {
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

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const validTab = TABS.some((t) => t.id === tab);
  if (tab && !validTab) {
    redirect("/tools?tab=planner");
  }

  const activeTab: ToolsTab = validTab ? (tab as ToolsTab) : "planner";
  const { title, description } = TAB_TITLES[activeTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tools</h1>
        <p className="text-muted text-sm mt-1">
          Planning and utility tools for your trading workflow.
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
