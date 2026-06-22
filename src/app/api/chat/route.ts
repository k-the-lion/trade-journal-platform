import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, getProfile } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/context";
import type { CoachingPlaybook, Trade } from "@/lib/types/database";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, message } = body as { sessionId: string; message: string };

  if (!sessionId || !message?.trim()) {
    return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", profile.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: message.trim(),
  });

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", profile.id)
    .order("traded_at", { ascending: false })
    .limit(100);

  let playbook: CoachingPlaybook | null = null;

  if (session.org_id) {
    const { data } = await supabase
      .from("coaching_playbooks")
      .select("*")
      .eq("org_id", session.org_id)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    playbook = data;
  }

  if (!playbook) {
    const { data } = await supabase
      .from("coaching_playbooks")
      .select("*")
      .is("org_id", null)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    playbook = data;
  }

  const defaultPlaybook: CoachingPlaybook = {
    id: "default",
    org_id: null,
    name: "Default",
    tone: "supportive",
    topics_to_emphasize: ["risk management", "rule adherence"],
    topics_to_avoid: ["specific trade calls"],
    custom_rules: "Never give buy/sell signals.",
    review_checklist: "Ask reflective questions before giving advice.",
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const systemPrompt = buildSystemPrompt(
    profile,
    playbook ?? defaultPlaybook,
    (trades ?? []) as Trade[]
  );

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...(history ?? [])
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  ];

  const openai = getOpenAI();
  let assistantContent: string;

  if (!openai) {
    assistantContent =
      "AI coaching is not configured yet. Add OPENAI_API_KEY to your environment. " +
      "Based on your logged trades, focus on reviewing your recent P&L patterns and rule adherence.";
  } else {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });
    assistantContent =
      completion.choices[0]?.message?.content ??
      "I couldn't generate a response. Please try again.";
  }

  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: assistantContent,
  });

  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return NextResponse.json({ content: assistantContent });
}
