import type { RestoreDrillSnapshot } from "../../application/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export const CockroachRestoreDrillSnapshotStatement = {
  OrgEvents: "restore_drill_snapshot_org_events",
  ControlPlaneFlags: "restore_drill_snapshot_control_plane_flags",
  ControlPlaneRateLimits: "restore_drill_snapshot_control_plane_rate_limits",
} as const;

export type CockroachRestoreDrillSnapshotStatement =
  (typeof CockroachRestoreDrillSnapshotStatement)[keyof typeof CockroachRestoreDrillSnapshotStatement];

export type CockroachRestoreDrillSnapshotSource = {
  captureSnapshot: () => Promise<RestoreDrillSnapshot>;
};

export type CreateCockroachRestoreDrillSnapshotSourceInput = {
  executor: CockroachGenericSqlExecutor;
  organizationId: string;
  capturedAt: () => string;
};

type OrgEventSnapshotRow = {
  org_event_id: string;
  kind: string;
  subject_id: string;
  from_state: string | null;
  to_state: string | null;
  decision: string;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
  occurred_at: string | Date;
};

type ControlPlaneFlagSnapshotRow = {
  control_plane_flag_id: string;
  scope_kind: string;
  scope_id: string | null;
  flag: string;
  reason: string;
  set_by_hat_id: string;
  set_at: string | Date;
  expires_at: string | Date | null;
};

type ControlPlaneRateLimitSnapshotRow = {
  control_plane_rate_limit_id: string;
  scope_kind: string;
  scope_id: string | null;
  kind: string;
  window_started_at: string | Date;
  window_ends_at: string | Date;
  limit_count: number | string;
  used_count: number | string;
  requested_count: number | string | null;
};

export function createCockroachRestoreDrillSnapshotSource(
  input: CreateCockroachRestoreDrillSnapshotSourceInput,
): CockroachRestoreDrillSnapshotSource {
  return {
    captureSnapshot: async () => ({
      organizationId: input.organizationId,
      capturedAt: input.capturedAt(),
      projections: [
        {
          name: "org_events",
          rows: await loadOrgEvents(input),
        },
        {
          name: "control_plane_flags",
          rows: await loadControlPlaneFlags(input),
        },
        {
          name: "control_plane_rate_limits",
          rows: await loadControlPlaneRateLimits(input),
        },
      ],
    }),
  };
}

async function loadOrgEvents(
  input: CreateCockroachRestoreDrillSnapshotSourceInput,
): Promise<readonly Record<string, unknown>[]> {
  const result = await input.executor.execute<OrgEventSnapshotRow>({
    name: CockroachRestoreDrillSnapshotStatement.OrgEvents,
    sql: `
      SELECT
        org_event_id,
        kind,
        subject_id,
        from_state,
        to_state,
        decision,
        correlation_id,
        causation_id,
        trace_id,
        occurred_at
      FROM agentic_org_org_events
      WHERE organization_id = $1
      ORDER BY occurred_at, org_event_id
    `,
    parameters: [input.organizationId],
  });

  return result.rows.map((row) => ({
    orgEventId: row.org_event_id,
    kind: row.kind,
    subjectId: row.subject_id,
    fromState: row.from_state,
    toState: row.to_state,
    decision: row.decision,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    traceId: row.trace_id,
    occurredAt: toIso(row.occurred_at),
  }));
}

async function loadControlPlaneFlags(
  input: CreateCockroachRestoreDrillSnapshotSourceInput,
): Promise<readonly Record<string, unknown>[]> {
  const result = await input.executor.execute<ControlPlaneFlagSnapshotRow>({
    name: CockroachRestoreDrillSnapshotStatement.ControlPlaneFlags,
    sql: `
      SELECT
        control_plane_flag_id,
        scope_kind,
        scope_id,
        flag,
        reason,
        set_by_hat_id,
        set_at,
        expires_at
      FROM agentic_org_control_plane_flags
      WHERE organization_id = $1
      ORDER BY set_at, control_plane_flag_id
    `,
    parameters: [input.organizationId],
  });

  return result.rows.map((row) => ({
    controlPlaneFlagId: row.control_plane_flag_id,
    scopeKind: row.scope_kind,
    scopeId: row.scope_id,
    flag: row.flag,
    reason: row.reason,
    setByHatId: row.set_by_hat_id,
    setAt: toIso(row.set_at),
    expiresAt: row.expires_at === null ? null : toIso(row.expires_at),
  }));
}

async function loadControlPlaneRateLimits(
  input: CreateCockroachRestoreDrillSnapshotSourceInput,
): Promise<readonly Record<string, unknown>[]> {
  const result = await input.executor.execute<ControlPlaneRateLimitSnapshotRow>({
    name: CockroachRestoreDrillSnapshotStatement.ControlPlaneRateLimits,
    sql: `
      SELECT
        control_plane_rate_limit_id,
        scope_kind,
        scope_id,
        kind,
        window_started_at,
        window_ends_at,
        limit_count,
        used_count,
        requested_count
      FROM agentic_org_control_plane_rate_limits
      WHERE organization_id = $1
      ORDER BY window_started_at, control_plane_rate_limit_id
    `,
    parameters: [input.organizationId],
  });

  return result.rows.map((row) => ({
    controlPlaneRateLimitId: row.control_plane_rate_limit_id,
    scopeKind: row.scope_kind,
    scopeId: row.scope_id,
    kind: row.kind,
    windowStartedAt: toIso(row.window_started_at),
    windowEndsAt: toIso(row.window_ends_at),
    limit: Number(row.limit_count),
    used: Number(row.used_count),
    requested: row.requested_count === null ? null : Number(row.requested_count),
  }));
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
