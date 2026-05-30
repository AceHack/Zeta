CREATE TABLE IF NOT EXISTS agentic_org_control_plane_heartbeat (
  organization_id STRING PRIMARY KEY,
  last_tick_at TIMESTAMPTZ NOT NULL,
  version INT8 NOT NULL
);

CREATE TABLE IF NOT EXISTS agentic_org_control_plane_alerts (
  control_plane_alert_id STRING PRIMARY KEY,
  organization_id STRING NOT NULL,
  kind STRING NOT NULL,
  detail_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
