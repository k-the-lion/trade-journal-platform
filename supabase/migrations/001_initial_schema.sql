-- Trading Journal Platform — initial schema with RLS

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  platform_role TEXT NOT NULL DEFAULT 'solo' CHECK (platform_role IN ('admin', 'coach', 'student', 'solo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations (coach groups)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Org membership
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'student')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Pending invites
CREATE TABLE IF NOT EXISTS org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('coach', 'student')),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coaching playbooks (versioned per org; NULL org_id = platform default)
CREATE TABLE IF NOT EXISTS coaching_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Playbook',
  tone TEXT NOT NULL DEFAULT 'supportive',
  topics_to_emphasize TEXT[] DEFAULT ARRAY['risk management', 'rule adherence', 'patience'],
  topics_to_avoid TEXT[] DEFAULT ARRAY['specific trade calls', 'guaranteed outcomes'],
  custom_rules TEXT NOT NULL DEFAULT '',
  review_checklist TEXT NOT NULL DEFAULT 'Always ask what rule was followed before suggesting changes.',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trades (broker-agnostic)
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  traded_at TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price NUMERIC(18, 6),
  exit_price NUMERIC(18, 6),
  quantity NUMERIC(18, 6) NOT NULL DEFAULT 1,
  pnl NUMERIC(18, 2) NOT NULL,
  r_multiple NUMERIC(10, 4),
  setup_tag TEXT,
  notes TEXT,
  emotional_state TEXT,
  rule_followed BOOLEAN,
  account_type TEXT CHECK (account_type IN ('eval', 'funded', 'personal')),
  screenshot_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'tradovate', 'ninjatrader', 'other')),
  external_id TEXT,
  import_job_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, source, external_id)
);

-- Trade tags (many-to-many)
CREATE TABLE IF NOT EXISTS trade_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE(trade_id, tag)
);

-- Import jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('csv', 'tradovate', 'ninjatrader', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_name TEXT,
  row_count INT DEFAULT 0,
  imported_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE trades
  ADD CONSTRAINT trades_import_job_id_fkey
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL;

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Coaching Session',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_traded_at ON trades(traded_at);
CREATE INDEX IF NOT EXISTS idx_trades_org_id ON trades(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER coaching_playbooks_updated_at BEFORE UPDATE ON coaching_playbooks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed platform default playbook
INSERT INTO coaching_playbooks (org_id, name, tone, custom_rules, is_active)
SELECT
  NULL,
  'Platform Default',
  'supportive',
  'Never give buy/sell signals. Focus on process, risk management, and emotional discipline. Reference the trader''s logged data when giving feedback.',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM coaching_playbooks WHERE org_id IS NULL AND name = 'Platform Default'
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is org coach
CREATE OR REPLACE FUNCTION is_org_coach(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = p_user_id AND role = 'coach'
  ) OR EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND owner_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is org member
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND owner_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_insert_signup ON profiles FOR INSERT
  TO authenticated, anon, service_role
  WITH CHECK (true);

-- Organizations policies
CREATE POLICY orgs_select_member ON organizations FOR SELECT
  USING (is_org_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY orgs_insert_owner ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY orgs_update_coach ON organizations FOR UPDATE
  USING (owner_id = auth.uid() OR is_org_coach(id, auth.uid()));

-- Org members policies
CREATE POLICY org_members_select ON org_members FOR SELECT
  USING (is_org_member(org_id, auth.uid()));
CREATE POLICY org_members_insert_coach ON org_members FOR INSERT
  WITH CHECK (is_org_coach(org_id, auth.uid()));
CREATE POLICY org_members_delete_coach ON org_members FOR DELETE
  USING (is_org_coach(org_id, auth.uid()));

-- Org invites policies
CREATE POLICY org_invites_select_coach ON org_invites FOR SELECT
  USING (is_org_coach(org_id, auth.uid()) OR email = (SELECT email FROM profiles WHERE id = auth.uid()));
CREATE POLICY org_invites_insert_coach ON org_invites FOR INSERT
  WITH CHECK (is_org_coach(org_id, auth.uid()));
CREATE POLICY org_invites_update ON org_invites FOR UPDATE
  USING (is_org_coach(org_id, auth.uid()) OR email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Playbooks policies
CREATE POLICY playbooks_select ON coaching_playbooks FOR SELECT
  USING (
    org_id IS NULL
    OR is_org_member(org_id, auth.uid())
  );
CREATE POLICY playbooks_insert_coach ON coaching_playbooks FOR INSERT
  WITH CHECK (org_id IS NULL OR is_org_coach(org_id, auth.uid()));
CREATE POLICY playbooks_update_coach ON coaching_playbooks FOR UPDATE
  USING (org_id IS NULL OR is_org_coach(org_id, auth.uid()));

-- Trades policies: own trades + coach read in org
CREATE POLICY trades_select ON trades FOR SELECT
  USING (
    user_id = auth.uid()
    OR (org_id IS NOT NULL AND is_org_coach(org_id, auth.uid()))
  );
CREATE POLICY trades_insert ON trades FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY trades_update ON trades FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY trades_delete ON trades FOR DELETE
  USING (user_id = auth.uid());

-- Trade tags policies (via trade ownership)
CREATE POLICY trade_tags_select ON trade_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM trades t WHERE t.id = trade_id AND (t.user_id = auth.uid() OR (t.org_id IS NOT NULL AND is_org_coach(t.org_id, auth.uid())))));
CREATE POLICY trade_tags_insert ON trade_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trades t WHERE t.id = trade_id AND t.user_id = auth.uid()));
CREATE POLICY trade_tags_delete ON trade_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM trades t WHERE t.id = trade_id AND t.user_id = auth.uid()));

-- Import jobs policies
CREATE POLICY import_jobs_select ON import_jobs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY import_jobs_insert ON import_jobs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY import_jobs_update ON import_jobs FOR UPDATE USING (user_id = auth.uid());

-- Chat policies
CREATE POLICY chat_sessions_select ON chat_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY chat_sessions_insert ON chat_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY chat_sessions_update ON chat_sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY chat_sessions_delete ON chat_sessions FOR DELETE USING (user_id = auth.uid());

CREATE POLICY chat_messages_select ON chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

-- Storage bucket for screenshots (run in Supabase dashboard or separate migration)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('trade-screenshots', 'trade-screenshots', false);
