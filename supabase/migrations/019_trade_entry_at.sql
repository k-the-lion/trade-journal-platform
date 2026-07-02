-- Optional trade entry time (exit/close remains in traded_at)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trades_entry_at ON trades(entry_at) WHERE entry_at IS NOT NULL;
