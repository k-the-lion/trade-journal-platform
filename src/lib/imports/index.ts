import { registerImportAdapter } from "./adapter";
import { csvImportAdapter } from "./csv-adapter";

registerImportAdapter(csvImportAdapter);

export { csvImportAdapter, parseCsvTrades, type CsvColumnMapping } from "./csv-adapter";
export {
  type ImportAdapter,
  type NormalizedTradeRow,
  normalizedToTradeInput,
  getImportAdapter,
  listImportAdapters,
} from "./adapter";
