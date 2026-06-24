-- Broker API sync connections (TopstepX, Tradovate later)

ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_source_check;
ALTER TABLE trades ADD CONSTRAINT trades_source_check
  CHECK (source IN ('manual', 'csv', 'tradovate', 'ninjatrader', 'tradingview', 'topstepx', 'other'));

ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_source_check;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_source_check
  CHECK (source IN ('csv', 'tradovate', 'ninjatrader', 'tradingview', 'topstepx', 'other'));

CREATE TABLE IF NOT EXISTS broker_sync_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('topstepx', 'tradovate')),
  label TEXT,
  username TEXT NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  external_account_name TEXT,
  trading_account_id UUID REFERENCES trading_accounts(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES trading_strategies(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  sync_from TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'never')),
  last_sync_error TEXT,
  last_sync_imported INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_sync_connections_user_id
  ON broker_sync_connections(user_id);

CREATE TRIGGER broker_sync_connections_updated_at
  BEFORE UPDATE ON broker_sync_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE broker_sync_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY broker_sync_connections_select ON broker_sync_connections FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY broker_sync_connections_insert ON broker_sync_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY broker_sync_connections_update ON broker_sync_connections FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY broker_sync_connections_delete ON broker_sync_connections FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON broker_sync_connections TO authenticated;
