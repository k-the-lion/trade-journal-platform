import type { createClient } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/supabase/storage";
import type { TradeScreenshot } from "@/lib/types/database";

export async function signScreenshotUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  screenshots: TradeScreenshot[],
  expiresIn = 3600
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniquePaths = [
    ...new Set(
      screenshots
        .map((s) => s.storage_path)
        .filter((p): p is string => Boolean(p))
    ),
  ];

  await Promise.all(
    uniquePaths.map(async (path) => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
      if (data?.signedUrl) map.set(path, data.signedUrl);
    })
  );

  return map;
}
