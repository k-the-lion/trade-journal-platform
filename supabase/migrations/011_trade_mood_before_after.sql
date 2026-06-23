-- Before / after trade mood (replaces single emotional_state for journaling)

ALTER TABLE trades ADD COLUMN IF NOT EXISTS mood_before text;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS mood_after text;

UPDATE trades
SET mood_before = emotional_state
WHERE mood_before IS NULL AND emotional_state IS NOT NULL;
