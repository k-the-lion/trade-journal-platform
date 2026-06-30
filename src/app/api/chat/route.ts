import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, getProfile } from "@/lib/supabase/server";
import { resolvePlaybookForChat } from "@/lib/ai/resolve-playbook";
import { buildSystemPrompt } from "@/lib/ai/context";
import type { CoachTradeFilters } from "@/lib/ai/coach-filters";
import { loadCoachData } from "@/lib/ai/load-coach-data";
import { normalizeChatMessages } from "@/lib/ai/messages";
import { isDefaultChatTitle, titleFromMessage } from "@/lib/ai/title";
import type { CoachingPlaybook } from "@/lib/types/database";

const MODEL = "claude-haiku-4-5-20251001";

export const runtime = "nodejs";
export const maxDuration = 60;

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

async function ensureChatSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string
) {
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (session) return session;

  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "student")
    .limit(1);

  const { data: created, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      org_id: memberships?.[0]?.org_id ?? null,
      title: "New Session",
    })
    .select()
    .single();

  if (error || !created) {
    return null;
  }

  return created;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, message, filters: rawFilters } = body as {
      sessionId: string;
      message: string;
      filters?: CoachTradeFilters;
    };

    const filters: CoachTradeFilters = {
      accountIds: rawFilters?.accountIds ?? [],
      strategyIds: rawFilters?.strategyIds ?? [],
      tagNames: rawFilters?.tagNames ?? [],
    };

    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
    }

    let session = await ensureChatSession(supabase, profile.id, sessionId);
    const sessionReplaced = session && session.id !== sessionId;

    if (!session) {
      return NextResponse.json(
        { error: "Could not start a chat session. Refresh the page and try again." },
        { status: 500 }
      );
    }

    const activeSessionId = session.id;

    await supabase.from("chat_messages").insert({
      session_id: activeSessionId,
      role: "user",
      content: message.trim(),
    });

    let sessionTitle = session.title;
    if (isDefaultChatTitle(session.title)) {
      sessionTitle = titleFromMessage(message);
      await supabase
        .from("chat_sessions")
        .update({
          title: sessionTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeSessionId);
    }

    const coachData = await loadCoachData(supabase, profile.id, filters);

    const playbookKey =
      (session as { playbook_key?: string }).playbook_key ?? "auto";
    const playbook: CoachingPlaybook = await resolvePlaybookForChat(
      supabase,
      profile.id,
      playbookKey,
      session.org_id
    );

    const systemPrompt = buildSystemPrompt(
      profile,
      playbook,
      coachData.filteredTrades,
      coachData.dailyJournals,
      filters,
      coachData.accounts,
      coachData.strategies
    );

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", activeSessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const chatMessages = normalizeChatMessages(
      (history ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
    );

    if (chatMessages.length === 0) {
      return NextResponse.json({ error: "No messages to send" }, { status: 400 });
    }

    const anthropic = getAnthropic();
    let assistantContent: string;

    if (!anthropic) {
      assistantContent =
        "AI coaching is not configured yet. Add ANTHROPIC_API_KEY to your environment. " +
        "Based on your logged trades, focus on reviewing your recent P&L patterns and rule adherence.";
    } else {
      try {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 800,
          system: systemPrompt,
          messages: chatMessages,
        });

        const textBlock = response.content.find((b) => b.type === "text");
        assistantContent =
          textBlock && "text" in textBlock
            ? textBlock.text
            : "I couldn't generate a response. Please try again.";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("authentication_error") || message.includes("x-api-key")) {
          return NextResponse.json(
            {
              error:
                "AI coach API key is invalid or missing. Check ANTHROPIC_API_KEY in your environment.",
            },
            { status: 503 }
          );
        }
        throw err;
      }
    }

    await supabase.from("chat_messages").insert({
      session_id: activeSessionId,
      role: "assistant",
      content: assistantContent,
    });

    await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeSessionId);

    return NextResponse.json({
      content: assistantContent,
      sessionTitle,
      sessionId: sessionReplaced ? activeSessionId : undefined,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    const errMessage =
      err instanceof Error ? err.message : "Failed to generate coaching response";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
