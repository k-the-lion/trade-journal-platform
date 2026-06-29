-- Daily session journal (one entry per user per calendar day)

CREATE TABLE IF NOT EXISTS daily_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  journal_date DATE NOT NULL,
  mood TEXT,
  day_summary TEXT,
  went_well TEXT,
  to_improve TEXT,
  lessons_learned TEXT,
  tomorrow_focus TEXT,
  discipline_rating INT CHECK (discipline_rating >= 1 AND discipline_rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, journal_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_journal_user_date
  ON daily_journal_entries(user_id, journal_date DESC);

CREATE TRIGGER daily_journal_entries_updated_at
  BEFORE UPDATE ON daily_journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE daily_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_journal_select ON daily_journal_entries FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY daily_journal_insert ON daily_journal_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY daily_journal_update ON daily_journal_entries FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY daily_journal_delete ON daily_journal_entries FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON daily_journal_entries TO authenticated;
