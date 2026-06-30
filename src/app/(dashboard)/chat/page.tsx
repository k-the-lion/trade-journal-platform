import { redirect } from "next/navigation";
import { buildPlaybookOptions } from "@/components/ChatPlaybookSelect";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/data";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatSessionSidebar } from "@/components/ChatSessionSidebar";
import { openChatSession } from "@/lib/actions";
import type { ChatMessage, ChatSession, UserCoachPlaybook } from "@/lib/types/database";

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

  const activeSession = session as ChatSession;

  const [
    { data: messages },
    { data: allSessions },
    { data: userPlaybooks },
    orgRes,
    dashboard,
  ] = await Promise.all([
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
    supabase
      .from("user_coach_playbooks")
      .select("*")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("name"),
    activeSession.org_id
      ? supabase
          .from("organizations")
          .select("name")
          .eq("id", activeSession.org_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getDashboardData(profile.id),
  ]);

  const orgName = (orgRes.data as { name: string } | null)?.name ?? null;
  const playbookOptions = buildPlaybookOptions(
    (userPlaybooks ?? []) as UserCoachPlaybook[],
    orgName
  );

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
          Pick a coaching playbook, filter your data, then ask about trades, journals, and
          performance.
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
            playbookOptions={playbookOptions}
          />
        </div>
      </div>
    </div>
  );
}
