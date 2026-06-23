-- Trading accounts + trade screenshots

CREATE TABLE IF NOT EXISTS trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  broker TEXT,
  account_type TEXT CHECK (account_type IN ('eval', 'funded', 'personal')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);

CREATE TABLE IF NOT EXISTS trade_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade_id ON trade_screenshots(trade_id);

CREATE TRIGGER trading_accounts_updated_at
  BEFORE UPDATE ON trading_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY trading_accounts_select ON trading_accounts FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY trading_accounts_insert ON trading_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY trading_accounts_update ON trading_accounts FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY trading_accounts_delete ON trading_accounts FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY trade_screenshots_select ON trade_screenshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trades t
    WHERE t.id = trade_id
      AND (t.user_id = auth.uid() OR (t.org_id IS NOT NULL AND is_org_coach(t.org_id, auth.uid())))
  ));
CREATE POLICY trade_screenshots_insert ON trade_screenshots FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trades t WHERE t.id = trade_id AND t.user_id = auth.uid()
  ));
CREATE POLICY trade_screenshots_delete ON trade_screenshots FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM trades t WHERE t.id = trade_id AND t.user_id = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON trading_accounts TO authenticated;
GRANT SELECT, INSERT, DELETE ON trade_screenshots TO authenticated;

-- Private storage bucket for trade chart screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY trade_screenshots_storage_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trade-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY trade_screenshots_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trade-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY trade_screenshots_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trade-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
