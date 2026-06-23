const DEFAULT_TITLES = new Set(["New Session", "Coaching Session"]);

export function isDefaultChatTitle(title: string) {
  return DEFAULT_TITLES.has(title.trim());
}

export function titleFromMessage(message: string, maxLen = 48): string {
  const oneLine = message.trim().replace(/\s+/g, " ");
  if (!oneLine) return "New Session";
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen).trimEnd()}…`;
}
