import type { TradingStrategy } from "@/lib/types/database";

/** Starter templates users can add from the Strategies page */
export const STRATEGY_TEMPLATES: Pick<
  TradingStrategy,
  "name" | "description" | "rules"
>[] = [
  {
    name: "Breakout",
    description: "Trade breaks of key levels with volume confirmation.",
    rules:
      "1. Only trade levels marked pre-session.\n2. Wait for a full candle close beyond the level.\n3. Stop beyond the breakout structure.\n4. No chasing — skip if move is extended.",
  },
  {
    name: "Pullback",
    description: "Enter on pullbacks in an established trend.",
    rules:
      "1. Trend must be clear on higher timeframe.\n2. Enter at prior structure / VWAP / EMA.\n3. Stop below pullback low (long) or above high (short).\n4. No counter-trend pullbacks.",
  },
  {
    name: "Reversal",
    description: "Fade exhaustion at extremes with confirmation.",
    rules:
      "1. Must see exhaustion signal (divergence, failed breakout).\n2. Wait for structure shift before entry.\n3. Tight stop beyond invalidation.\n4. Max 1 reversal attempt per level per session.",
  },
  {
    name: "Trend follow",
    description: "Add on trend continuation setups.",
    rules:
      "1. Trade only in direction of session trend.\n2. Entry on flag / consolidation break.\n3. Trail stop per plan — no hope holds.\n4. Skip chop — ADX/volume filter if used.",
  },
];

export function parseStrategyRules(rules: string): string[] {
  return rules
    .split(/\n+/)
    .map((line) => line.replace(/^\d+[\).\]]\s*/, "").trim())
    .filter(Boolean);
}
