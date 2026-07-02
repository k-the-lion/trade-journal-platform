export type PlatformRole = "admin" | "coach" | "student" | "solo";
export type OrgMemberRole = "coach" | "student";
export type TradeDirection = "long" | "short";
export type AccountType = "eval" | "funded" | "personal" | "live" | "paper";
export type TradeSource = "manual" | "csv" | "tradovate" | "ninjatrader" | "tradingview" | "topstepx" | "other";
export type ImportSource = "csv" | "tradovate" | "ninjatrader" | "tradingview" | "topstepx" | "other";
export type ImportStatus = "pending" | "processing" | "completed" | "failed";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  platform_role: PlatformRole;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgMemberRole;
  created_at: string;
  profiles?: Profile;
}

export interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  role: OrgMemberRole;
  invited_by: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface CoachingPlaybook {
  id: string;
  org_id: string | null;
  name: string;
  tone: string;
  topics_to_emphasize: string[];
  topics_to_avoid: string[];
  custom_rules: string;
  review_checklist: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  account_type: AccountType | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TradeScreenshot {
  id: string;
  trade_id: string;
  storage_path: string | null;
  link_url: string | null;
  caption: string | null;
  sort_order: number;
  created_at: string;
  signed_url?: string;
}

export interface TradingTagPreset {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface DailyJournalEntry {
  id: string;
  user_id: string;
  journal_date: string;
  mood: string | null;
  day_summary: string | null;
  went_well: string | null;
  to_improve: string | null;
  lessons_learned: string | null;
  tomorrow_focus: string | null;
  discipline_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserTradingGoals {
  user_id: string;
  account_id: string;
  monthly_profit_target: number | null;
  min_win_rate_pct: number | null;
  max_daily_loss: number | null;
  monthly_trade_target: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserTradingRule {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface TradingStrategy {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  rules: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BrokerSyncConnection {
  id: string;
  user_id: string;
  provider: "topstepx" | "tradovate";
  label: string | null;
  username: string;
  credentials_encrypted: string;
  external_account_id: string;
  external_account_name: string | null;
  trading_account_id: string | null;
  strategy_id: string | null;
  org_id: string | null;
  sync_from: string | null;
  last_synced_at: string | null;
  last_sync_status: "success" | "error" | "never" | null;
  last_sync_error: string | null;
  last_sync_imported: number;
  is_active: boolean;
  auto_sync: boolean;
  created_at: string;
  updated_at: string;
}

export type BrokerSyncConnectionPublic = Omit<
  BrokerSyncConnection,
  "credentials_encrypted"
>;

export interface Trade {
  id: string;
  user_id: string;
  org_id: string | null;
  account_id: string | null;
  strategy_id: string | null;
  traded_at: string;
  entry_at: string | null;
  symbol: string;
  direction: TradeDirection;
  entry_price: number | null;
  exit_price: number | null;
  quantity: number;
  pnl: number;
  r_multiple: number | null;
  setup_tag: string | null;
  notes: string | null;
  import_notes: string | null;
  emotional_state: string | null;
  mood_before: string | null;
  mood_after: string | null;
  rule_followed: boolean | null;
  account_type: AccountType | null;
  screenshot_url: string | null;
  source: TradeSource;
  external_id: string | null;
  import_job_id: string | null;
  created_at: string;
  updated_at: string;
  trade_tags?: TradeTag[];
  trade_screenshots?: TradeScreenshot[];
  trading_accounts?: TradingAccount | null;
  trading_strategies?: TradingStrategy | null;
}

export interface TradeTag {
  id: string;
  trade_id: string;
  tag: string;
}

export interface ImportJob {
  id: string;
  user_id: string;
  org_id: string | null;
  source: ImportSource;
  status: ImportStatus;
  file_name: string | null;
  row_count: number;
  imported_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface UserCoachPlaybook {
  id: string;
  user_id: string;
  name: string;
  tone: string;
  topics_to_emphasize: string[];
  topics_to_avoid: string[];
  custom_rules: string;
  review_checklist: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  org_id: string | null;
  playbook_key: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface TradeInput {
  traded_at: string;
  entry_at?: string | null;
  symbol: string;
  direction: TradeDirection;
  entry_price?: number | null;
  exit_price?: number | null;
  quantity: number;
  pnl: number;
  r_multiple?: number | null;
  setup_tag?: string | null;
  notes?: string | null;
  emotional_state?: string | null;
  mood_before?: string | null;
  mood_after?: string | null;
  rule_followed?: boolean | null;
  account_type?: AccountType | null;
  account_id?: string | null;
  strategy_id?: string | null;
  org_id?: string | null;
  tags?: string[];
  screenshot_url?: string | null;
}

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, Partial<Profile> & { id: string; email: string }, Partial<Profile>>;
      organizations: TableDef<Organization, Omit<Organization, "id" | "created_at" | "updated_at">, Partial<Organization>>;
      org_members: TableDef<OrgMember, Omit<OrgMember, "id" | "created_at">, Partial<OrgMember>>;
      org_invites: TableDef<OrgInvite, Omit<OrgInvite, "id" | "created_at" | "token">, Partial<OrgInvite>>;
      coaching_playbooks: TableDef<CoachingPlaybook, Partial<CoachingPlaybook>, Partial<CoachingPlaybook>>;
      user_coach_playbooks: TableDef<
        UserCoachPlaybook,
        Partial<UserCoachPlaybook> & { user_id: string; name: string },
        Partial<UserCoachPlaybook>
      >;
      trades: TableDef<
        Trade,
        Partial<Trade> & { user_id: string; traded_at: string; symbol: string; direction: TradeDirection; pnl: number },
        Partial<Trade>
      >;
      trade_tags: TableDef<TradeTag, Omit<TradeTag, "id">, Partial<TradeTag>>;
      trading_accounts: TableDef<
        TradingAccount,
        Partial<TradingAccount> & { user_id: string; name: string },
        Partial<TradingAccount>
      >;
      trading_strategies: TableDef<
        TradingStrategy,
        Partial<TradingStrategy> & { user_id: string; name: string },
        Partial<TradingStrategy>
      >;
      trade_screenshots: TableDef<
        TradeScreenshot,
        Omit<TradeScreenshot, "id" | "created_at" | "signed_url">,
        Partial<TradeScreenshot>
      >;
      trading_tag_presets: TableDef<
        TradingTagPreset,
        Partial<TradingTagPreset> & { user_id: string; name: string },
        Partial<TradingTagPreset>
      >;
      daily_journal_entries: TableDef<
        DailyJournalEntry,
        Partial<DailyJournalEntry> & { user_id: string; journal_date: string },
        Partial<DailyJournalEntry>
      >;
      user_trading_goals: TableDef<
        UserTradingGoals,
        Partial<UserTradingGoals> & { user_id: string; account_id: string },
        Partial<UserTradingGoals>
      >;
      user_trading_rules: TableDef<
        UserTradingRule,
        Partial<UserTradingRule> & { user_id: string; name: string },
        Partial<UserTradingRule>
      >;
      import_jobs: TableDef<ImportJob, Partial<ImportJob> & { user_id: string; source: ImportSource }, Partial<ImportJob>>;
      broker_sync_connections: TableDef<
        BrokerSyncConnection,
        Partial<BrokerSyncConnection> & {
          user_id: string;
          provider: BrokerSyncConnection["provider"];
          username: string;
          credentials_encrypted: string;
          external_account_id: string;
        },
        Partial<BrokerSyncConnection>
      >;
      chat_sessions: TableDef<ChatSession, Partial<ChatSession> & { user_id: string }, Partial<ChatSession>>;
      chat_messages: TableDef<ChatMessage, Omit<ChatMessage, "id" | "created_at">, Partial<ChatMessage>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
