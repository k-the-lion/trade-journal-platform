-- Monthly trading goals and personal trading rules

CREATE TABLE IF NOT EXISTS user_trading_goals (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  monthly_profit_target NUMERIC,
  min_win_rate_pct NUMERIC,
  max_daily_loss NUMERIC,
  monthly_trade_target INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_trading_goals_updated_at
  BEFORE UPDATE ON user_trading_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE user_trading_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_trading_goals_select ON user_trading_goals FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY user_trading_goals_insert ON user_trading_goals FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_trading_goals_update ON user_trading_goals FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY user_trading_goals_delete ON user_trading_goals FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON user_trading_goals TO authenticated;

CREATE TABLE IF NOT EXISTS user_trading_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_trading_rules_user
  ON user_trading_rules(user_id, sort_order, created_at);

ALTER TABLE user_trading_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_trading_rules_select ON user_trading_rules FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY user_trading_rules_insert ON user_trading_rules FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_trading_rules_update ON user_trading_rules FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY user_trading_rules_delete ON user_trading_rules FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON user_trading_rules TO authenticated;
