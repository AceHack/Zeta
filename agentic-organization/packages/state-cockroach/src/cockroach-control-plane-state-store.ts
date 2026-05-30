/**
 * Cockroach-backed control-plane state store — the durable substrate for the
 * deterministic keep-alive control plane (operator tenet #1).
 *
 * Two responsibilities, two tables (DV2.0 change-rate split):
 *   - heartbeat: ONE row per org, UPSERTed every keep-alive tick. last_tick_at
 *     advancing IS the org's observable proof of life.
 *   - alerts: append-only self-heal signal log (org stall, stale-work
 *     reassignment, lease reap) the deterministic engine emitted.
 *
 * Age is computed by the DATABASE clock (now() - last_tick_at), not the worker
 * clock, so liveness stays deterministic across replicas with skewed clocks.
 */

import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

/** The kinds of self-heal signal the keep-alive engine appends to the alert log. */
export const ControlPlaneAlertKind = {
  OrgStall: "org_stall",
  StaleWorkReassignment: "stale_work_reassignment",
  LeaseReap: "lease_reap",
} as const;
export type ControlPlaneAlertKind = (typeof ControlPlaneAlertKind)[keyof typeof ControlPlaneAlertKind];

export const CockroachControlPlaneStateStoreStatement = {
  ReadOrgHeartbeatAge: "read_org_heartbeat_age",
  TickOrgHeartbeat: "tick_org_heartbeat",
  AppendControlPlaneAlert: "append_control_plane_alert",
  RecordAgentHeartbeat: "record_agent_heartbeat",
  ReadAgentHeartbeats: "read_agent_heartbeats",
} as const;
export type CockroachControlPlaneStateStoreStatement =
  (typeof CockroachControlPlaneStateStoreStatement)[keyof typeof CockroachControlPlaneStateStoreStatement];

export type AppendControlPlaneAlertInput = {
  alertId: string;
  organizationId: string;
  kind: ControlPlaneAlertKind;
  detail: Record<string, unknown>;
};

export type RecordAgentHeartbeatInput = {
  organizationId: string;
  agentId: string;
  hatAssignmentId: string;
  workItemId: string;
  deadlineMs: number;
};

/**
 * One agent session's liveness fact, in the keep-alive engine's shape. Age is
 * computed by the DB clock (now() - last_heartbeat_at), so agent staleness is
 * deterministic across replicas.
 */
export type AgentHeartbeatRecord = {
  agentId: string;
  hatAssignmentId: string;
  workItemId: string;
  heartbeatAgeMs: number;
  deadlineMs: number;
};

export type CockroachControlPlaneStateStore = {
  /** ms since the org last ticked, or undefined if it has never ticked. */
  readOrgHeartbeatAgeMs: (organizationId: string) => Promise<number | undefined>;
  /** UPSERT the org heartbeat row — last_tick_at = now(), version + 1. */
  tickOrgHeartbeat: (organizationId: string) => Promise<void>;
  /** Append one immutable self-heal signal to the alert log. */
  appendAlert: (input: AppendControlPlaneAlertInput) => Promise<void>;
  /** UPSERT an agent session's heartbeat — last_heartbeat_at = now(), version + 1. */
  recordAgentHeartbeat: (input: RecordAgentHeartbeatInput) => Promise<void>;
  /** Read every agent session's liveness for an org, in the engine's shape. */
  readAgentHeartbeats: (organizationId: string) => Promise<readonly AgentHeartbeatRecord[]>;
};

export type CreateCockroachControlPlaneStateStoreInput = {
  executor: CockroachGenericSqlExecutor;
};

type OrgHeartbeatAgeRow = {
  age_ms: number | string;
};

type AgentHeartbeatRow = {
  agent_id: string;
  hat_assignment_id: string;
  work_item_id: string;
  age_ms: number | string;
  deadline_ms: number | string;
};

export function createCockroachControlPlaneStateStore(
  input: CreateCockroachControlPlaneStateStoreInput,
): CockroachControlPlaneStateStore {
  return {
    readOrgHeartbeatAgeMs: async (organizationId: string): Promise<number | undefined> => {
      const result = await input.executor.execute<OrgHeartbeatAgeRow>({
        name: CockroachControlPlaneStateStoreStatement.ReadOrgHeartbeatAge,
        sql: `
          SELECT (EXTRACT(EPOCH FROM (now() - last_tick_at)) * 1000)::INT8 AS age_ms
          FROM agentic_org_control_plane_heartbeat
          WHERE organization_id = $1
        `,
        parameters: [organizationId],
      });

      const row = result.rows[0];
      if (row === undefined) {
        return undefined;
      }

      return Number(row.age_ms);
    },
    tickOrgHeartbeat: async (organizationId: string): Promise<void> => {
      await input.executor.execute({
        name: CockroachControlPlaneStateStoreStatement.TickOrgHeartbeat,
        sql: `
          INSERT INTO agentic_org_control_plane_heartbeat (organization_id, last_tick_at, version)
          VALUES ($1, now(), 1)
          ON CONFLICT (organization_id) DO UPDATE
          SET last_tick_at = now(), version = agentic_org_control_plane_heartbeat.version + 1
        `,
        parameters: [organizationId],
      });
    },
    appendAlert: async (alert: AppendControlPlaneAlertInput): Promise<void> => {
      await input.executor.execute({
        name: CockroachControlPlaneStateStoreStatement.AppendControlPlaneAlert,
        sql: `
          INSERT INTO agentic_org_control_plane_alerts (
            control_plane_alert_id,
            organization_id,
            kind,
            detail_json,
            created_at
          ) VALUES ($1, $2, $3, $4, now())
        `,
        parameters: [alert.alertId, alert.organizationId, alert.kind, JSON.stringify(alert.detail)],
      });
    },
    recordAgentHeartbeat: async (heartbeat: RecordAgentHeartbeatInput): Promise<void> => {
      await input.executor.execute({
        name: CockroachControlPlaneStateStoreStatement.RecordAgentHeartbeat,
        sql: `
          INSERT INTO agentic_org_agent_heartbeat (
            organization_id,
            agent_id,
            hat_assignment_id,
            work_item_id,
            last_heartbeat_at,
            deadline_ms,
            version
          ) VALUES ($1, $2, $3, $4, now(), $5, 1)
          ON CONFLICT (organization_id, agent_id) DO UPDATE
          SET hat_assignment_id = excluded.hat_assignment_id,
              work_item_id = excluded.work_item_id,
              last_heartbeat_at = now(),
              deadline_ms = excluded.deadline_ms,
              version = agentic_org_agent_heartbeat.version + 1
        `,
        parameters: [
          heartbeat.organizationId,
          heartbeat.agentId,
          heartbeat.hatAssignmentId,
          heartbeat.workItemId,
          heartbeat.deadlineMs,
        ],
      });
    },
    readAgentHeartbeats: async (organizationId: string): Promise<readonly AgentHeartbeatRecord[]> => {
      const result = await input.executor.execute<AgentHeartbeatRow>({
        name: CockroachControlPlaneStateStoreStatement.ReadAgentHeartbeats,
        sql: `
          SELECT
            agent_id,
            hat_assignment_id,
            work_item_id,
            (EXTRACT(EPOCH FROM (now() - last_heartbeat_at)) * 1000)::INT8 AS age_ms,
            deadline_ms
          FROM agentic_org_agent_heartbeat
          WHERE organization_id = $1
          ORDER BY agent_id
        `,
        parameters: [organizationId],
      });

      return result.rows.map((row) => ({
        agentId: row.agent_id,
        hatAssignmentId: row.hat_assignment_id,
        workItemId: row.work_item_id,
        heartbeatAgeMs: Number(row.age_ms),
        deadlineMs: Number(row.deadline_ms),
      }));
    },
  };
}
