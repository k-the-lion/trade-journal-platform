"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatCoachFilters } from "@/components/ChatCoachFilters";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import type { CoachTradeFilters } from "@/lib/ai/coach-filters";
import type {
  ChatMessage,
  ChatSession,
  Trade,
  TradingAccount,
  TradingStrategy,
  TradingTagPreset,
} from "@/lib/types/database";

export function ChatPanel({
  session,
  initialMessages,
  accounts,
  strategies,
  tagPresets,
  trades,
}: {
  session: ChatSession;
  initialMessages: ChatMessage[];
  accounts: TradingAccount[];
  strategies: TradingStrategy[];
  tagPresets: TradingTagPreset[];
  trades: Trade[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [sessionTitle, setSessionTitle] = useState(session.title);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<CoachTradeFilters>({
    accountIds: [],
    strategyIds: [],
    tagNames: [],
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
    setSessionTitle(session.title);
    setInput("");
    setLoading(false);
  }, [session.id, session.title, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        session_id: session.id,
        role: "user",
        content: userMsg,
        created_at: new Date().toISOString(),
      },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          message: userMsg,
          filters,
        }),
      });
      const raw = await res.text();
      let data: {
        content?: string;
        error?: string;
        sessionTitle?: string;
        sessionId?: string;
      } = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error("Server returned an invalid response. Please try again.");
        }
      }
      if (!res.ok) {
        if (res.status === 404 && data.error?.toLowerCase().includes("session")) {
          router.replace("/chat");
          return;
        }
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const content = data.content;
      if (!content) {
        throw new Error("Empty response from coach. Please try again.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `temp-a-${Date.now()}`,
          session_id: session.id,
          role: "assistant",
          content,
          created_at: new Date().toISOString(),
        },
      ]);
      if (data.sessionTitle) {
        setSessionTitle(data.sessionTitle);
      }
      if (data.sessionId && data.sessionId !== session.id) {
        router.replace(`/chat?session=${data.sessionId}`);
      } else if (data.sessionTitle) {
        router.refresh();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-e-${Date.now()}`,
          session_id: session.id,
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex flex-col h-[calc(100vh-12rem)]">
      <div className="px-4 py-3 border-b border-border space-y-3">
        <div>
          <h2 className="font-medium">{sessionTitle}</h2>
          <p className="text-xs text-muted mt-0.5">
            Educational coaching only — not financial advice. Coach sees your trades, daily
            journals, tags, notes, and screenshot links for the filtered scope.
          </p>
        </div>
        <ChatCoachFilters
          filters={filters}
          onChange={setFilters}
          accounts={accounts}
          strategies={strategies}
          tagPresets={tagPresets}
          trades={trades}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted text-center py-8">
            Ask about your trades, daily journal, rule adherence, or performance. Set filters above
            to focus on an account, strategy, or tag.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" ? (
              <div className="max-w-[92%] min-w-0">
                <p className="text-[0.65rem] uppercase tracking-wider text-muted mb-1.5 px-1">
                  Coach
                </p>
                <div className="rounded-xl px-4 py-3 bg-white/[0.04] border border-border/80 shadow-sm">
                  <ChatMarkdown content={msg.content} />
                </div>
              </div>
            ) : (
              <div className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-primary/15 text-foreground border border-primary/20">
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-sm text-muted animate-pulse">Coach is thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-border flex gap-2">
        <input
          className="input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="How did my funded account perform this week?"
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
