-- Broker/import metadata separate from user journal notes
ALTER TABLE trades ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- Move existing import metadata out of journal notes
UPDATE trades
SET import_notes = notes,
    notes = NULL
WHERE notes IS NOT NULL
  AND source IS NOT NULL
  AND source != 'manual'
  AND import_notes IS NULL;
