CREATE TABLE IF NOT EXISTS agentic_org_control_plane_flags (
  control_plane_flag_id STRING NOT NULL,
  organization_id STRING NOT NULL,
  scope_kind STRING NOT NULL,
  scope_id STRING NULL,
  flag STRING NOT NULL,
  reason STRING NOT NULL,
  set_by_hat_id STRING NOT NULL,
  set_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  PRIMARY KEY (organization_id, control_plane_flag_id),
  CONSTRAINT agentic_org_control_plane_flags_scope_kind_check CHECK (scope_kind IN ('organization', 'tenant', 'hat', 'provider')),
  CONSTRAINT agentic_org_control_plane_flags_flag_check CHECK (flag IN ('estop', 'freeze', 'budget_freeze', 'provider_freeze', 'simulator_required')),
  INDEX control_plane_flags_by_org_flag (organization_id, flag),
  INDEX control_plane_flags_by_org_scope (organization_id, scope_kind, scope_id)
);
