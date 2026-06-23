import type { CoachingPlaybook, Profile, Trade } from "@/lib/types/database";
import { computeTradeStats } from "@/lib/reports/stats";

export function buildSystemPrompt(
  profile: Profile,
  playbook: CoachingPlaybook,
  trades: Trade[]
): string {
  const stats = computeTradeStats(trades);
  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.traded_at).getTime() - new Date(a.traded_at).getTime())
    .slice(0, 10);

  const tradeSummary =
    recentTrades.length === 0
      ? "No trades logged yet."
      : recentTrades
          .map(
            (t) =>
              `- ${t.traded_at.slice(0, 10)} ${t.symbol} ${t.direction} PnL: $${t.pnl}${t.setup_tag ? ` Strategy: ${t.setup_tag}` : ""}${t.mood_before || t.mood_after ? ` Mood: ${t.mood_before ?? "?"} → ${t.mood_after ?? "?"}` : t.emotional_state ? ` Mood: ${t.emotional_state}` : ""}${t.notes ? ` Notes: ${t.notes.slice(0, 80)}` : ""}${t.rule_followed === false ? " [RULE BROKEN]" : ""}`
          )
          .join("\n");

  return `You are a trading coach for ${profile.full_name || profile.email}.

IMPORTANT GUARDRAILS:
- Never give specific buy/sell signals or guaranteed outcomes.
- This is an educational coaching tool, not financial advice.
- Always reference the trader's logged data when giving feedback.
- Format replies with clean Markdown: short headings (##), bullet lists, and **bold** for key points. Keep paragraphs concise.

COACHING STYLE: ${playbook.tone}

TOPICS TO EMPHASIZE: ${playbook.topics_to_emphasize.join(", ")}

TOPICS TO AVOID: ${playbook.topics_to_avoid.join(", ")}

ORGANIZATION RULES:
${playbook.custom_rules}

REVIEW CHECKLIST:
${playbook.review_checklist}

TRADER PERFORMANCE SUMMARY:
- Total trades: ${stats.totalTrades}
- Total P&L: $${stats.totalPnl}
- Win rate: ${stats.winRate}%
- Profit factor: ${stats.profitFactor}
- Average win: $${stats.avgWin} | Average loss: $${stats.avgLoss}
- Expectancy: $${stats.expectancy} per trade
- Rule adherence: ${stats.ruleFollowedPct}%
- Current streak: ${stats.currentStreak} ${stats.currentStreakType}
- Max drawdown: $${stats.maxDrawdown}

RECENT TRADES:
${tradeSummary}`;
}
