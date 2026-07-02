import { EconomicCalendar } from "@/components/EconomicCalendar";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Economic Events</h1>
        <p className="text-muted text-sm mt-1">
          CPI, NFP, FOMC, and other market-moving releases from the current trading week.
          Red-folder (high impact) events are highlighted by default — times shown in US Eastern (ET).
        </p>
      </div>

      <EconomicCalendar />
    </div>
  );
}
