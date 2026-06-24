export async function readJsonBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Empty response (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      trimmed.startsWith("Restricted")
        ? "This calendar data source requires a paid API plan."
        : `Invalid response: ${trimmed.slice(0, 120)}`
    );
  }
}
