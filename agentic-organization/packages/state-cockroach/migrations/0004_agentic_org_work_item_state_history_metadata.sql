ALTER TABLE IF EXISTS agentic_org_work_item_state_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS agentic_org_work_item_state_history
  ADD COLUMN IF NOT EXISTS version INT8;

UPDATE agentic_org_work_item_state_history
  SET updated_at = COALESCE(updated_at, transitioned_at),
      version = COALESCE(version, 1);

ALTER TABLE IF EXISTS agentic_org_work_item_state_history
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN version SET NOT NULL;
