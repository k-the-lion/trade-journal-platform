import { NextResponse } from "next/server";
import { fetchTradingViewSnapshotUrl } from "@/lib/screenshots-server";
import { isAllowedChartLink, normalizeChartLink } from "@/lib/screenshots";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const url = normalizeChartLink(raw);
  if (!isAllowedChartLink(url)) {
    return NextResponse.json({ error: "Invalid chart URL" }, { status: 400 });
  }

  const imageUrl = await fetchTradingViewSnapshotUrl(url);
  if (!imageUrl) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  try {
    const imageRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradeJournalBot/1.0)" },
      next: { revalidate: 3600 },
    });

    if (!imageRes.ok) {
      return NextResponse.json({ error: "Failed to load snapshot" }, { status: 502 });
    }

    const contentType = imageRes.headers.get("content-type") ?? "image/png";
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to proxy snapshot" }, { status: 502 });
  }
}
