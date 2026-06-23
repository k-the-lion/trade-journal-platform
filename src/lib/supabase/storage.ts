const BUCKET = "trade-screenshots";

export function tradeScreenshotPath(userId: string, tradeId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${tradeId}/${Date.now()}-${safe}`;
}

export { BUCKET };
