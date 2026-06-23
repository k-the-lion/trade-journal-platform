export function normalizeChartLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isTradingViewChartUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?tradingview\.com\/x\//i.test(url);
}

export function isAllowedChartLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return isTradingViewChartUrl(url);
  } catch {
    return false;
  }
}

export function chartLinkLabel(url: string): string {
  if (isTradingViewChartUrl(url)) return "TradingView chart";
  return "Chart link";
}

export function chartPreviewApiUrl(chartUrl: string): string {
  return `/api/chart-preview?url=${encodeURIComponent(normalizeChartLink(chartUrl))}`;
}
