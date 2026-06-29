import { PropPlanner } from "@/components/PropPlanner";

export default function PlannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prop Planner</h1>
        <p className="text-muted text-sm mt-1">
          Plan evaluation timelines, payout schedules, firm fees, and risk. This is a
          planning tool — it does not model firm-specific payout rules or complex trailing
          drawdown mechanics.
        </p>
      </div>
      <PropPlanner />
    </div>
  );
}
