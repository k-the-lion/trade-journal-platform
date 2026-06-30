-- Personal AI coach playbooks + per-session playbook selection

CREATE TABLE IF NOT EXISTS user_coach_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'supportive',
  topics_to_emphasize TEXT[] NOT NULL DEFAULT ARRAY['risk management', 'rule adherence'],
  topics_to_avoid TEXT[] NOT NULL DEFAULT ARRAY['specific trade calls', 'guaranteed outcomes'],
  custom_rules TEXT NOT NULL DEFAULT '',
  review_checklist TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_coach_playbooks_user
  ON user_coach_playbooks(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coach_playbooks_one_default
  ON user_coach_playbooks(user_id)
  WHERE is_default = TRUE;

CREATE TRIGGER user_coach_playbooks_updated_at
  BEFORE UPDATE ON user_coach_playbooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE user_coach_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_coach_playbooks_select ON user_coach_playbooks FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY user_coach_playbooks_insert ON user_coach_playbooks FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_coach_playbooks_update ON user_coach_playbooks FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY user_coach_playbooks_delete ON user_coach_playbooks FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON user_coach_playbooks TO authenticated;

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS playbook_key TEXT NOT NULL DEFAULT 'auto';
