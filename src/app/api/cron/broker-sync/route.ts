import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  markTopstepXSyncError,
  runTopstepXSyncForConnection,
} from "@/lib/brokers/run-topstepx-sync";
import {
  markTradovateSyncError,
  runTradovateSyncForConnection,
} from "@/lib/brokers/run-tradovate-sync";
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

async function syncConnection(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  connection: BrokerSyncConnection
): Promise<{ connectionId: string; imported: number; error?: string }> {
  try {
    const result =
      connection.provider === "tradovate"
        ? await runTradovateSyncForConnection(supabase, connection)
        : await runTopstepXSyncForConnection(supabase, connection);

    return {
      connectionId: connection.id,
      imported: result.imported,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    if (connection.provider === "tradovate") {
      await markTradovateSyncError(supabase, connection.id, message);
    } else {
      await markTopstepXSyncError(supabase, connection.id, message);
    }
    return {
      connectionId: connection.id,
      imported: 0,
      error: message,
    };
  }
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
    .in("provider", ["topstepx", "tradovate"])
    .eq("is_active", true)
    .eq("auto_sync", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (connections ?? []) as BrokerSyncConnection[];
  const results = [];

  for (const connection of list) {
    results.push(await syncConnection(supabase, connection));
  }

  return NextResponse.json({
    ok: true,
    processed: list.length,
    results,
  });
}
