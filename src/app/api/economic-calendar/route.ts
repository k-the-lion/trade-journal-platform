import { NextResponse } from "next/server";
import { fetchFinnhubCalendar } from "@/lib/economic-calendar/finnhub";
import { getFinnhubApiKey } from "@/lib/economic-calendar/finnhub-key";

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
    if (!getFinnhubApiKey()) {
      return NextResponse.json(
        {
          error:
            "FINNHUB_API_KEY is not configured. In Vercel, add FINNHUB_API_KEY (exact name, Production environment) and redeploy.",
        },
        { status: 503 }
      );
    }

    const events = await fetchFinnhubCalendar(from, to);
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
    const status = message.includes("FINNHUB_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
