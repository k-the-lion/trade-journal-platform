-- User-defined trading strategies with rules

CREATE TABLE IF NOT EXISTS trading_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_trading_strategies_user_id ON trading_strategies(user_id);

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES trading_strategies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);

CREATE TRIGGER trading_strategies_updated_at
  BEFORE UPDATE ON trading_strategies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE trading_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY trading_strategies_select ON trading_strategies FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY trading_strategies_insert ON trading_strategies FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY trading_strategies_update ON trading_strategies FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY trading_strategies_delete ON trading_strategies FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON trading_strategies TO authenticated;
