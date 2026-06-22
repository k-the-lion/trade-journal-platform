"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, ChatSession } from "@/lib/types/database";

export function ChatPanel({
  session,
  initialMessages,
}: {
  session: ChatSession;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        body: JSON.stringify({ sessionId: session.id, message: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");

      setMessages((prev) => [
        ...prev,
        {
          id: `temp-a-${Date.now()}`,
          session_id: session.id,
          role: "assistant",
          content: data.content,
          created_at: new Date().toISOString(),
        },
      ]);
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
    <div className="card flex flex-col h-[calc(100vh-12rem)] max-w-3xl">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-medium">{session.title}</h2>
        <p className="text-xs text-muted mt-0.5">
          Educational coaching only — not financial advice.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted text-center py-8">
            Ask about your recent trades, rule adherence, or performance patterns.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary/20 text-foreground"
                  : "bg-white/5 border border-border"
              }`}
            >
              {msg.content}
            </div>
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
          placeholder="How did I perform this week?"
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
