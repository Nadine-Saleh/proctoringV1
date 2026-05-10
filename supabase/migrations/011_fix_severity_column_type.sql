-- Migration 011: Convert violation_events.severity from VARCHAR to smallint
--
-- Migration 001 created the column as VARCHAR(20) accepting only 'low/medium/high/critical'.
-- Migration 006 assumed a fresh integer column, but because the table already existed
-- the CREATE TABLE IF NOT EXISTS was a no-op, leaving the VARCHAR column intact.
-- The record_violation_batch RPC now sends numeric severity (e.g. 5, 15, 25); that
-- number is stored as '5' in the VARCHAR column and rejected by the old string check.
--
-- Fix: drop the old constraint, backfill string labels to their numeric equivalents,
-- and convert the column to smallint with the 1–25 range check.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'violation_events'
      AND column_name  = 'severity'
      AND data_type    = 'character varying'
  ) THEN

    -- 1. Drop the old string check constraint so UPDATE can write numeric strings
    ALTER TABLE public.violation_events
      DROP CONSTRAINT IF EXISTS violation_events_severity_check;

    -- 2. Drop the old DEFAULT 'medium' — Postgres can't cast a string default to
    --    smallint during ALTER COLUMN TYPE, so the default must go first.
    ALTER TABLE public.violation_events
      ALTER COLUMN severity DROP DEFAULT;

    -- 3. Backfill legacy string labels → numeric strings (will be cast below)
    UPDATE public.violation_events SET severity = '25' WHERE severity = 'critical';
    UPDATE public.violation_events SET severity = '15' WHERE severity = 'high';
    UPDATE public.violation_events SET severity = '10' WHERE severity = 'medium';
    UPDATE public.violation_events SET severity = '5'  WHERE severity = 'low';

    -- 4. Anything still non-numeric (NULL, unknown strings) gets clamped to 5
    UPDATE public.violation_events
      SET severity = '5'
     WHERE severity IS NULL
        OR severity !~ '^\d+$';

    -- 5. Convert VARCHAR → smallint
    ALTER TABLE public.violation_events
      ALTER COLUMN severity TYPE smallint USING severity::smallint;

    -- 6. Enforce NOT NULL
    ALTER TABLE public.violation_events
      ALTER COLUMN severity SET NOT NULL;

    -- 7. Set the new numeric DEFAULT
    ALTER TABLE public.violation_events
      ALTER COLUMN severity SET DEFAULT 5;

    -- 8. Re-add the constraint that record_violation_batch expects
    ALTER TABLE public.violation_events
      ADD CONSTRAINT violation_events_severity_check
        CHECK (severity >= 1 AND severity <= 25);

  END IF;
END $$;
