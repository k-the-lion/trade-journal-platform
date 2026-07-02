/** Parse symbol and strategy name from TradingView Strategy Tester export filenames. */
export function parseStrategyTesterFilename(fileName: string): {
  symbol?: string;
  strategyName?: string;
} {
  const base = fileName.replace(/\.csv$/i, "").trim();
  const dateMatch = base.match(/_(\d{4}-\d{2}-\d{2})_/);
  if (!dateMatch || dateMatch.index === undefined) return {};

  const prefix = base.slice(0, dateMatch.index);
  const parts = prefix.split("_").filter((p) => p && p !== "-");
  if (!parts.length) return {};

  let symbol: string | undefined;
  let strategyParts: string[];

  if (parts.length >= 3 && parts[parts.length - 2].toUpperCase() === "MINI") {
    symbol = parts[parts.length - 1];
    strategyParts = parts.slice(0, -3);
  } else {
    symbol = parts[parts.length - 1];
    strategyParts = parts.slice(0, -1);
  }

  const strategyName = strategyParts.length
    ? strategyParts.join(" ").replace(/\s+/g, " ").trim()
    : undefined;

  return {
    symbol: symbol ? symbol.toUpperCase() : undefined,
    strategyName,
  };
}
