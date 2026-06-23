export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Anthropic requires alternating roles starting with user. */
export function normalizeChatMessages(messages: ChatTurn[]): ChatTurn[] {
  const merged: ChatTurn[] = [];

  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const content = msg.content?.trim();
    if (!content) continue;

    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      merged.push({ role: msg.role, content });
    }
  }

  while (merged.length > 0 && merged[0].role !== "user") {
    merged.shift();
  }

  return merged;
}
