import type { EventCategory } from "./types";

const RULES: { category: EventCategory; pattern: RegExp }[] = [
  {
    category: "inflation",
    pattern: /\b(cpi|ppi|pce|inflation|consumer price|producer price)\b/i,
  },
  {
    category: "employment",
    pattern: /\b(nfp|non.?farm|payroll|unemployment|jobless|adp employment|employment change)\b/i,
  },
  {
    category: "fed",
    pattern: /\b(fomc|fed |federal reserve|interest rate|powell|beige book)\b/i,
  },
  {
    category: "gdp",
    pattern: /\b(gdp|gross domestic)\b/i,
  },
  {
    category: "housing",
    pattern: /\b(housing|home sales|building permits|mortgage)\b/i,
  },
  {
    category: "consumer",
    pattern: /\b(retail sales|consumer confidence|consumer sentiment)\b/i,
  },
];

export function categorizeEvent(name: string): EventCategory {
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return "other";
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  inflation: "Inflation",
  employment: "Employment",
  fed: "Fed / rates",
  gdp: "GDP",
  housing: "Housing",
  consumer: "Consumer",
  other: "Other",
};
