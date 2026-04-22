-- ============================================================================
-- Migration 008: violation_events legacy column compatibility
-- ============================================================================
-- Migration 001 created violation_events with legacy columns:
--   violation_type VARCHAR(50) NOT NULL
--   occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
--   description    TEXT
--   duration_ms    INTEGER
--
-- Migration 006 added the Phase 2 schema (type, client_event_id,
-- client_captured_at, ...) via ALTER TABLE but did not remove or relax
-- the legacy NOT NULL constraint on violation_type. The record_violation_batch
-- RPC only writes the Phase 2 columns, so every insert now fails with:
--   null value in column "violation_type" of relation "violation_events"
--   violates not-null constraint
--
-- Fix: relax NOT NULL on the legacy column and install a BEFORE INSERT/UPDATE
-- trigger that mirrors the new columns into the legacy ones, so any code
-- still reading violation_type / occurred_at continues to work.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'violation_events'
      AND column_name = 'violation_type'
  ) THEN
    ALTER TABLE public.violation_events
      ALTER COLUMN violation_type DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'violation_events'
      AND column_name = 'occurred_at'
  ) THEN
    ALTER TABLE public.violation_events
      ALTER COLUMN occurred_at DROP NOT NULL;
  END IF;
END $$;

-- Trigger: keep legacy columns in sync with Phase 2 columns on insert/update.
CREATE OR REPLACE FUNCTION public.violation_events_sync_legacy()
RETURNS trigger AS $$
BEGIN
  IF NEW.violation_type IS NULL AND NEW.type IS NOT NULL THEN
    NEW.violation_type := NEW.type;
  END IF;

  IF NEW.occurred_at IS NULL AND NEW.client_captured_at IS NOT NULL THEN
    NEW.occurred_at := NEW.client_captured_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_violation_events_sync_legacy ON public.violation_events;
CREATE TRIGGER trg_violation_events_sync_legacy
BEFORE INSERT OR UPDATE ON public.violation_events
FOR EACH ROW EXECUTE FUNCTION public.violation_events_sync_legacy();

-- Backfill any existing rows where the legacy columns ended up NULL.
UPDATE public.violation_events
   SET violation_type = type
 WHERE violation_type IS NULL AND type IS NOT NULL;

UPDATE public.violation_events
   SET occurred_at = client_captured_at
 WHERE occurred_at IS NULL AND client_captured_at IS NOT NULL;
