"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteChatSession, startNewChatSession } from "@/lib/actions";
import type { ChatSession } from "@/lib/types/database";

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
}: {
  sessions: ChatSession[];
  activeSessionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(sessionId: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setDeletingId(sessionId);
    startTransition(async () => {
      try {
        await deleteChatSession(sessionId);
        if (sessionId === activeSessionId) {
          router.replace("/chat");
        } else {
          router.refresh();
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete session");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <aside className="lg:w-56 shrink-0 space-y-2">
      <form action={startNewChatSession}>
        <button type="submit" className="btn btn-secondary w-full text-sm">
          New session
        </button>
      </form>
      <div className="card p-2 space-y-1">
        {sessions.length === 0 && (
          <p className="text-xs text-muted px-3 py-2">No past sessions</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center gap-1 rounded ${
              s.id === activeSessionId ? "bg-primary/15" : "hover:bg-white/5"
            }`}
          >
            <Link
              href={`/chat?session=${s.id}`}
              className={`flex-1 min-w-0 px-3 py-2 text-sm truncate ${
                s.id === activeSessionId ? "text-primary" : "text-muted"
              }`}
            >
              {s.title}
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleDelete(s.id, s.title);
              }}
              disabled={pending && deletingId === s.id}
              className="shrink-0 mr-1 w-6 h-6 flex items-center justify-center rounded text-xs text-muted hover:text-danger hover:bg-danger/15 disabled:opacity-50"
              title="Delete session"
              aria-label={`Delete ${s.title}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
