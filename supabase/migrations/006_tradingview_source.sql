-- Allow tradingview as a trade source

ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_source_check;
ALTER TABLE trades ADD CONSTRAINT trades_source_check
  CHECK (source IN ('manual', 'csv', 'tradovate', 'ninjatrader', 'tradingview', 'other'));

ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_source_check;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_source_check
  CHECK (source IN ('csv', 'tradovate', 'ninjatrader', 'tradingview', 'other'));
