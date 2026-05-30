CREATE TABLE IF NOT EXISTS agentic_org_tenant_config (
  organization_id STRING PRIMARY KEY,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL
);
