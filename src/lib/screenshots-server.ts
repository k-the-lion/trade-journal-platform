import { isAllowedChartLink, normalizeChartLink } from "@/lib/screenshots";

export async function fetchTradingViewSnapshotUrl(chartUrl: string): Promise<string | null> {
  const url = normalizeChartLink(chartUrl);
  if (!isAllowedChartLink(url)) return null;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradeJournalBot/1.0)",
        Accept: "text/html",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const patterns = [
      /property="og:image"\s+content="([^"]+)"/i,
      /content="([^"]+)"\s+property="og:image"/i,
      /property='og:image'\s+content='([^']+)'/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1].replace(/&amp;/g, "&");
    }

    return null;
  } catch {
    return null;
  }
}
