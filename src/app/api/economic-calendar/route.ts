import { NextResponse } from "next/server";
import { hasCalendarApiKey, CALENDAR_KEY_SETUP_HINT } from "@/lib/economic-calendar/api-keys";
import { fetchEconomicCalendar } from "@/lib/economic-calendar/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "from and to are required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    if (!hasCalendarApiKey()) {
      return NextResponse.json(
        {
          error: `No calendar API key configured. ${CALENDAR_KEY_SETUP_HINT}`,
        },
        { status: 503 }
      );
    }

    const events = await fetchEconomicCalendar(from, to);
    return NextResponse.json(
      { events },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load economic calendar";
    const status =
      message.includes("not configured") || message.includes("FMP_API_KEY")
        ? 503
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
