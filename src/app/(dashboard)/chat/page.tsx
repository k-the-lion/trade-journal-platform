import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/data";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatSessionSidebar } from "@/components/ChatSessionSidebar";
import { openChatSession } from "@/lib/actions";
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

  if (!sessionId) {
    const fresh = await openChatSession();
    redirect(`/chat?session=${fresh.id}`);
  }

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", profile.id)
    .single();

  if (!session) {
    const fresh = await openChatSession();
    redirect(`/chat?session=${fresh.id}`);
  }

  const activeSession = session;

  const [{ data: messages }, { data: allSessions }, dashboard] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", activeSession.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("chat_sessions")
      .select("*, chat_messages(count)")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(30),
    getDashboardData(profile.id),
  ]);

  const sessionsList = ((allSessions ?? []) as (ChatSession & {
    chat_messages: { count: number }[];
  })[])
    .filter((s) => {
      const messageCount = s.chat_messages?.[0]?.count ?? 0;
      return messageCount > 0 || s.id === activeSession.id;
    })
    .map(({ chat_messages: _cm, ...s }) => s as ChatSession);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Coach</h1>
        <p className="text-muted text-sm mt-1">
          Coaching grounded in your trades, daily journals, strategies, tags, notes, and chart
          links — filter the context before you ask.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <ChatSessionSidebar
          sessions={sessionsList}
          activeSessionId={activeSession.id}
        />
        <div className="flex-1 min-w-0">
          <ChatPanel
            key={activeSession.id}
            session={activeSession}
            initialMessages={(messages ?? []) as ChatMessage[]}
            accounts={dashboard.accounts}
            strategies={dashboard.strategies}
            tagPresets={dashboard.tagPresets}
            trades={dashboard.trades}
          />
        </div>
      </div>
    </div>
  );
}
