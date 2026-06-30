import type {
  CoachingPlaybook,
  DailyJournalEntry,
  Profile,
  Trade,
  TradingAccount,
  TradingStrategy,
} from "@/lib/types/database";
import {
  hasActiveCoachFilters,
  type CoachTradeFilters,
  UNASSIGNED_ACCOUNT,
  UNASSIGNED_STRATEGY,
  UNTAGGED,
} from "@/lib/ai/coach-filters";
import { moodLabel } from "@/lib/constants/trade-meta";
import { computeTradeStats } from "@/lib/reports/stats";

const MAX_TRADE_DETAILS = 40;
const MAX_NOTE_CHARS = 500;
const MAX_RULES_CHARS = 400;
const MAX_JOURNAL_FIELD_CHARS = 600;

function clip(text: string | null | undefined, max: number): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function filterLabel(
  filters: CoachTradeFilters,
  accounts: TradingAccount[],
  strategies: TradingStrategy[]
): string {
  if (!hasActiveCoachFilters(filters)) {
    return "All trades and journals (no filters).";
  }

  const parts: string[] = [];

  if (filters.accountIds.length > 0) {
    const names = filters.accountIds.map((id) =>
      id === UNASSIGNED_ACCOUNT
        ? "Unassigned account"
        : accounts.find((a) => a.id === id)?.name ?? "Account"
    );
    parts.push(`Accounts: ${names.join(", ")}`);
  }

  if (filters.strategyIds.length > 0) {
    const names = filters.strategyIds.map((id) =>
      id === UNASSIGNED_STRATEGY
        ? "Unassigned strategy"
        : strategies.find((s) => s.id === id)?.name ?? "Strategy"
    );
    parts.push(`Strategies: ${names.join(", ")}`);
  }

  if (filters.tagNames.length > 0) {
    const names = filters.tagNames.map((t) => (t === UNTAGGED ? "Untagged" : t));
    parts.push(`Tags (all required): ${names.join(", ")}`);
  }

  return parts.join(" · ");
}

function formatScreenshots(trade: Trade): string | null {
  const shots = trade.trade_screenshots ?? [];
  if (shots.length === 0) return null;

  return shots
    .map((s, i) => {
      const bits: string[] = [`#${i + 1}`];
      if (s.link_url) bits.push(`chart link: ${s.link_url}`);
      if (s.signed_url) bits.push(`image: ${s.signed_url}`);
      else if (s.storage_path) bits.push("uploaded chart image on file");
      if (s.caption) bits.push(`caption: ${s.caption}`);
      return bits.join(" | ");
    })
    .join("; ");
}

function formatTradeLine(trade: Trade): string {
  const account = trade.trading_accounts?.name ?? (trade.account_id ? "Account" : "Unassigned");
  const strategy = trade.trading_strategies?.name ?? trade.setup_tag ?? null;
  const tags = trade.trade_tags?.map((t) => t.tag).join(", ");
  const mood =
    trade.mood_before || trade.mood_after
      ? `${moodLabel(trade.mood_before)} → ${moodLabel(trade.mood_after)}`
      : trade.emotional_state
        ? moodLabel(trade.emotional_state)
        : null;

  const bits = [
    `${trade.traded_at.slice(0, 10)} ${trade.symbol} ${trade.direction}`,
    `P&L $${trade.pnl}`,
    trade.quantity != null ? `qty ${trade.quantity}` : null,
    trade.entry_price != null ? `entry ${trade.entry_price}` : null,
    trade.exit_price != null ? `exit ${trade.exit_price}` : null,
    trade.r_multiple != null ? `R ${trade.r_multiple}` : null,
    `account: ${account}`,
    strategy ? `strategy: ${strategy}` : null,
    tags ? `tags: ${tags}` : null,
    mood ? `mood: ${mood}` : null,
    trade.rule_followed === true
      ? "rules: followed"
      : trade.rule_followed === false
        ? "rules: BROKEN"
        : null,
    clip(trade.notes, MAX_NOTE_CHARS) ? `notes: ${clip(trade.notes, MAX_NOTE_CHARS)}` : null,
  ].filter(Boolean);

  const screenshots = formatScreenshots(trade);
  let line = `- ${bits.join(" | ")}`;
  if (screenshots) line += `\n  Screenshots: ${screenshots}`;

  const rules = clip(trade.trading_strategies?.rules, MAX_RULES_CHARS);
  if (rules) line += `\n  Strategy rules: ${rules}`;

  return line;
}

function journalHasContent(entry: DailyJournalEntry): boolean {
  return !!(
    entry.mood ||
    entry.day_summary ||
    entry.went_well ||
    entry.to_improve ||
    entry.lessons_learned ||
    entry.tomorrow_focus ||
    entry.discipline_rating
  );
}

function formatJournalEntry(entry: DailyJournalEntry): string {
  const bits = [`${entry.journal_date}`];
  if (entry.mood) bits.push(`mood: ${moodLabel(entry.mood)}`);
  if (entry.discipline_rating) bits.push(`discipline: ${entry.discipline_rating}/5`);

  const fields: Array<[string, string | null]> = [
    ["summary", clip(entry.day_summary, MAX_JOURNAL_FIELD_CHARS)],
    ["went well", clip(entry.went_well, MAX_JOURNAL_FIELD_CHARS)],
    ["to improve", clip(entry.to_improve, MAX_JOURNAL_FIELD_CHARS)],
    ["lessons", clip(entry.lessons_learned, MAX_JOURNAL_FIELD_CHARS)],
    ["tomorrow focus", clip(entry.tomorrow_focus, MAX_JOURNAL_FIELD_CHARS)],
  ];

  let block = `- ${bits.join(" | ")}`;
  for (const [label, value] of fields) {
    if (value) block += `\n  ${label}: ${value}`;
  }
  return block;
}

export function buildSystemPrompt(
  profile: Profile,
  playbook: CoachingPlaybook,
  trades: Trade[],
  dailyJournals: DailyJournalEntry[],
  filters: CoachTradeFilters,
  accounts: TradingAccount[],
  strategies: TradingStrategy[]
): string {
  const stats = computeTradeStats(trades);
  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.traded_at).getTime() - new Date(a.traded_at).getTime())
    .slice(0, MAX_TRADE_DETAILS);

  const tradeSummary =
    recentTrades.length === 0
      ? "No trades match the current filter."
      : recentTrades.map(formatTradeLine).join("\n");

  const journalsWithContent = dailyJournals.filter(journalHasContent).slice(0, 20);
  const journalSummary =
    journalsWithContent.length === 0
      ? hasActiveCoachFilters(filters)
        ? "No daily journal entries on days with matching trades."
        : "No daily journal entries logged yet."
      : journalsWithContent.map(formatJournalEntry).join("\n");

  const strategyCatalog =
    strategies.length === 0
      ? "No strategies defined."
      : strategies
          .map((s) => {
            const rules = clip(s.rules, MAX_RULES_CHARS);
            return `- ${s.name}${s.description ? ` — ${s.description}` : ""}${rules ? `\n  Rules: ${rules}` : ""}`;
          })
          .join("\n");

  return `You are a trading coach for ${profile.full_name || profile.email}.

IMPORTANT GUARDRAILS:
- Never give specific buy/sell signals or guaranteed outcomes.
- This is an educational coaching tool, not financial advice.
- Always reference the trader's logged data when giving feedback.
- You cannot view chart images directly unless the trader pastes them in chat; use screenshot links, captions, and trade notes when discussing charts.
- Format replies with clean Markdown: short headings (##), bullet lists, and **bold** for key points. Keep paragraphs concise.

COACHING STYLE: ${playbook.tone}

TOPICS TO EMPHASIZE: ${playbook.topics_to_emphasize.join(", ")}

TOPICS TO AVOID: ${playbook.topics_to_avoid.join(", ")}

ORGANIZATION RULES:
${playbook.custom_rules}

REVIEW CHECKLIST:
${playbook.review_checklist}

CONTEXT FILTERS:
${filterLabel(filters, accounts, strategies)}
Stats and trade details below reflect this scope only.

TRADER PERFORMANCE SUMMARY (filtered scope):
- Trades in scope: ${stats.totalTrades}
- Total P&L: $${stats.totalPnl}
- Win rate: ${stats.winRate}%
- Profit factor: ${stats.profitFactor}
- Average win: $${stats.avgWin} | Average loss: $${stats.avgLoss}
- Expectancy: $${stats.expectancy} per trade
- Rule adherence: ${stats.ruleFollowedPct}%
- Current streak: ${stats.currentStreak} ${stats.currentStreakType}
- Max drawdown: $${stats.maxDrawdown}

STRATEGY LIBRARY:
${strategyCatalog}

TRADES IN SCOPE (up to ${MAX_TRADE_DETAILS} most recent; full notes, tags, accounts, screenshots):
${tradeSummary}

DAILY JOURNAL ENTRIES (days with trades in scope, or recent if unfiltered):
${journalSummary}`;
}
