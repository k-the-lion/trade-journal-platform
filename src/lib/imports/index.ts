import { registerImportAdapter } from "./adapter";
import { csvImportAdapter } from "./csv-adapter";
import { topstepxImportAdapter } from "./topstepx-adapter";
import { tradovateImportAdapter } from "./tradovate-adapter";
import { tradingviewImportAdapter } from "./tradingview-adapter";

registerImportAdapter("csv", csvImportAdapter);
registerImportAdapter("topstepx", topstepxImportAdapter);
registerImportAdapter("tradovate", tradovateImportAdapter);
registerImportAdapter("tradingview", tradingviewImportAdapter);

export {
  csvImportAdapter,
  parseCsvTrades,
  buildMappingFromHeaders,
  DEFAULT_MAPPING,
  type CsvColumnMapping,
} from "./csv-adapter";
export { parseTopstepXTrades, topstepxImportAdapter } from "./topstepx-adapter";
export { parseTradovateCsv, tradovateImportAdapter } from "./tradovate-adapter";
export {
  classifyTradingViewExport,
  parseTradingViewCsv,
  tradingviewImportAdapter,
} from "./tradingview-adapter";
export {
  detectImportFormat,
  presetToAdapterKey,
  type DetectedFormat,
  type ImportPreset,
} from "./detect-format";
export { parseCsvRows, findPnlColumn } from "./csv-utils";
export {
  type ImportAdapter,
  type ImportAdapterInfo,
  type NormalizedTradeRow,
  normalizedToTradeInput,
  getImportAdapter,
  listImportAdapters,
  listImportAdapterInfo,
} from "./adapter";
