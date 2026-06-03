ALTER TABLE IF EXISTS agentic_org_context_pack_snapshots
  ADD COLUMN IF NOT EXISTS phase STRING;
