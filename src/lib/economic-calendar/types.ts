export type EventImpact = "high" | "medium" | "low";

export type EventCategory =
  | "inflation"
  | "employment"
  | "fed"
  | "gdp"
  | "housing"
  | "consumer"
  | "other";

export interface EconomicEvent {
  id: string;
  event: string;
  country: string;
  impact: EventImpact;
  category: EventCategory;
  time: string;
  timeEt: string;
  dateKey: string;
  actual: string | null;
  estimate: string | null;
  previous: string | null;
  unit: string | null;
}

export interface CalendarFilters {
  impacts: EventImpact[];
  countries: string[];
}
