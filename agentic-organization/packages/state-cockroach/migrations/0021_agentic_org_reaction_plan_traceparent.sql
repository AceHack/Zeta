ALTER TABLE IF EXISTS agentic_org_reaction_plans
  ADD COLUMN IF NOT EXISTS traceparent STRING;
