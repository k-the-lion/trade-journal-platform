-- Auto-sync toggle for broker API connections (15-minute cron when enabled)

ALTER TABLE broker_sync_connections
  ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN NOT NULL DEFAULT FALSE;
