-- Per-account trading goals (one goal set per trading account)

ALTER TABLE user_trading_goals
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE;

UPDATE user_trading_goals g
SET account_id = (
  SELECT ta.id
  FROM trading_accounts ta
  WHERE ta.user_id = g.user_id
  ORDER BY ta.is_default DESC, ta.created_at ASC
  LIMIT 1
)
WHERE account_id IS NULL;

DELETE FROM user_trading_goals WHERE account_id IS NULL;

ALTER TABLE user_trading_goals DROP CONSTRAINT IF EXISTS user_trading_goals_pkey;

ALTER TABLE user_trading_goals ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE user_trading_goals ADD PRIMARY KEY (account_id);

CREATE INDEX IF NOT EXISTS idx_user_trading_goals_user
  ON user_trading_goals(user_id);

DROP POLICY IF EXISTS user_trading_goals_insert ON user_trading_goals;
CREATE POLICY user_trading_goals_insert ON user_trading_goals FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trading_accounts ta
      WHERE ta.id = account_id AND ta.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS user_trading_goals_update ON user_trading_goals;
CREATE POLICY user_trading_goals_update ON user_trading_goals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trading_accounts ta
      WHERE ta.id = account_id AND ta.user_id = auth.uid()
    )
  );
