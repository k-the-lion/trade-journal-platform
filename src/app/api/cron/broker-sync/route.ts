import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  markTopstepXSyncError,
  runTopstepXSyncForConnection,
} from "@/lib/brokers/run-topstepx-sync";
import type { BrokerSyncConnection } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin client unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const { data: connections, error } = await supabase
    .from("broker_sync_connections")
    .select("*")
    .eq("provider", "topstepx")
    .eq("is_active", true)
    .eq("auto_sync", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (connections ?? []) as BrokerSyncConnection[];
  const results: Array<{
    connectionId: string;
    imported: number;
    error?: string;
  }> = [];

  for (const connection of list) {
    try {
      const result = await runTopstepXSyncForConnection(supabase, connection);
      results.push({
        connectionId: connection.id,
        imported: result.imported,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await markTopstepXSyncError(supabase, connection.id, message);
      results.push({
        connectionId: connection.id,
        imported: 0,
        error: message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: list.length,
    results,
  });
}
