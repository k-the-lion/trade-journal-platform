export const TRADE_MOODS = [
  { value: "great", emoji: "😄", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "neutral", emoji: "😐", label: "Neutral" },
  { value: "anxious", emoji: "😰", label: "Anxious" },
  { value: "frustrated", emoji: "😤", label: "Frustrated" },
  { value: "revenge", emoji: "😡", label: "Revenge" },
  { value: "fomo", emoji: "🤑", label: "FOMO" },
] as const;

export const DEFAULT_STRATEGIES = [
  "Breakout",
  "Pullback",
  "Reversal",
  "Trend follow",
  "Range / scalp",
  "News play",
  "Opening drive",
  "Other",
] as const;

export function moodEmoji(value: string | null | undefined): string {
  if (!value) return "—";
  return TRADE_MOODS.find((m) => m.value === value)?.emoji ?? value.slice(0, 2);
}

export function moodLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  return TRADE_MOODS.find((m) => m.value === value)?.label ?? value;
}
