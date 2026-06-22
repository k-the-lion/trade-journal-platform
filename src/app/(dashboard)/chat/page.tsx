import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/ChatPanel";
import { createChatSession, startNewChatSession } from "@/lib/actions";
import type { ChatMessage, ChatSession } from "@/lib/types/database";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) redirect("/login");

  let session: ChatSession | null = null;

  if (sessionId) {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", profile.id)
      .single();
    session = data as ChatSession | null;
  }

  if (!session) {
    const { data: sessions } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    session = (sessions?.[0] as ChatSession | undefined) ?? null;
  }

  if (!session) {
    session = await createChatSession();
  }

  const activeSession = session as ChatSession;

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", activeSession.id)
    .order("created_at", { ascending: true });

  const { data: allSessions } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(10);

  const sessionsList = (allSessions ?? []) as ChatSession[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Coach</h1>
        <p className="text-muted text-sm mt-1">
          Coaching based on your trades and your coach&apos;s playbook rules
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0 space-y-2">
          <form action={startNewChatSession}>
            <button type="submit" className="btn btn-secondary w-full text-sm">
              New session
            </button>
          </form>
          <div className="card p-2 space-y-1">
            {sessionsList.map((s) => (
              <Link
                key={s.id}
                href={`/chat?session=${s.id}`}
                className={`block px-3 py-2 rounded text-sm truncate ${
                  s.id === activeSession.id ? "bg-primary/15 text-primary" : "text-muted hover:bg-white/5"
                }`}
              >
                {s.title}
              </Link>
            ))}
          </div>
        </aside>
        <div className="flex-1">
          <ChatPanel
            session={activeSession}
            initialMessages={(messages ?? []) as ChatMessage[]}
          />
        </div>
      </div>
    </div>
  );
}
