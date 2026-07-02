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

/** Extract a pasted image from the clipboard (screenshot, copied chart, etc.). */
export function imageFileFromClipboard(
  clipboardData: DataTransfer | null | undefined
): File | null {
  if (!clipboardData?.items?.length) return null;

  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i];
    if (!item.type.startsWith("image/")) continue;

    const blob = item.getAsFile();
    if (!blob) continue;

    const ext = item.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    return new File([blob], `pasted-${Date.now()}.${ext}`, { type: item.type });
  }

  return null;
}

function fileFromImageBlob(blob: Blob, type: string): File {
  const ext = type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  return new File([blob], `pasted-${Date.now()}.${ext}`, { type });
}

/** Read a copied image after a user click (requires clipboard permission). */
export async function imageFileFromSystemClipboard(): Promise<File | null> {
  if (!navigator.clipboard?.read) return null;

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      return fileFromImageBlob(blob, imageType);
    }
  } catch {
    return null;
  }

  return null;
}
