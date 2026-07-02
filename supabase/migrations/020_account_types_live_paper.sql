-- Add live and paper account types

ALTER TABLE trading_accounts DROP CONSTRAINT IF EXISTS trading_accounts_account_type_check;
ALTER TABLE trading_accounts ADD CONSTRAINT trading_accounts_account_type_check
  CHECK (account_type IS NULL OR account_type IN ('eval', 'funded', 'personal', 'live', 'paper'));

ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_account_type_check;
ALTER TABLE trades ADD CONSTRAINT trades_account_type_check
  CHECK (account_type IS NULL OR account_type IN ('eval', 'funded', 'personal', 'live', 'paper'));
