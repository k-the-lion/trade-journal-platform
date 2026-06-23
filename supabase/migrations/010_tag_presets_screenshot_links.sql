-- Saved trade tag presets + external chart links on screenshots

CREATE TABLE IF NOT EXISTS trading_tag_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_trading_tag_presets_user_id ON trading_tag_presets(user_id);

ALTER TABLE trade_screenshots
  ADD COLUMN IF NOT EXISTS link_url TEXT;

ALTER TABLE trade_screenshots
  ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE trade_screenshots DROP CONSTRAINT IF EXISTS trade_screenshots_has_media;
ALTER TABLE trade_screenshots ADD CONSTRAINT trade_screenshots_has_media
  CHECK (
    (storage_path IS NOT NULL AND storage_path <> '')
    OR (link_url IS NOT NULL AND link_url <> '')
  );

ALTER TABLE trading_tag_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY trading_tag_presets_select ON trading_tag_presets FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY trading_tag_presets_insert ON trading_tag_presets FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY trading_tag_presets_update ON trading_tag_presets FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY trading_tag_presets_delete ON trading_tag_presets FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON trading_tag_presets TO authenticated;
