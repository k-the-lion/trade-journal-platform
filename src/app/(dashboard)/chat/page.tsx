import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatSessionSidebar } from "@/components/ChatSessionSidebar";
import { createChatSession } from "@/lib/actions";
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
    const fresh = await createChatSession("New Session");
    redirect(`/chat?session=${fresh.id}`);
  }

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", profile.id)
    .single();

  if (!session) {
    const fresh = await createChatSession("New Session");
    redirect(`/chat?session=${fresh.id}`);
  }

  const activeSession = session;

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
        <ChatSessionSidebar
          sessions={sessionsList}
          activeSessionId={activeSession.id}
        />
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
