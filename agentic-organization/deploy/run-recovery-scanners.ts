/**
 * G3 KIND proof: seed one recovery candidate for each scanner in live Cockroach,
 * run the same scanner lanes the always-on worker composes, and require durable
 * recovery OrgEvents for all four incidents.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-recovery-scanners.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import { OrgEventKind, ReactionPlanStatus, ScheduleBlockState, ScheduleBlockType, WorkItemState, WorkItemType } from "../packages/domain/src/index.ts";
import {
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachRecoveryScanReader,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import {
  createAbandonedRunBindingScanCadenceLane,
  createDeadLetterClassifierCadenceLane,
  createStaleReactionPlanScanCadenceLane,
  createStrandedScheduleScanCadenceLane,
} from "../apps/workers/src/org-cadence-lanes.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const organizationId = `org-recovery-${randomUUID().slice(0, 8)}`;
const projectId = "project-recovery-proof";
const workItemId = `work-recovery-${randomUUID().slice(0, 8)}`;
const nowMs = Date.now();
const oldIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
const expiredIso = new Date(nowMs - 30 * 60 * 1000).toISOString();
const createId = (prefix: string) => `${prefix}-${randomUUID()}`;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const client: CockroachSqlClient = {
      query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
      transaction: async (operation) => operation(client),
    };
    const executor = createCockroachSqlExecutor({ client });

    for (const migration of createCockroachCoreStateMigrations()) {
      for (const statement of splitSqlStatements(migration.sql)) {
        await pool.query(statement);
      }
    }

    await seedRecoveryCandidates(pool);

    const reader = createCockroachRecoveryScanReader({ executor });
    const orgEvents = createCockroachOrgEventStore({ executor });
    const appendEvent = (event: Parameters<typeof orgEvents.append>[0]) => orgEvents.append(event);
    const laneDeps = { organizationId, now: () => nowMs, createId, appendEvent, limit: 10 };
    const lanes = [
      createStaleReactionPlanScanCadenceLane({ ...laneDeps, reader, staleAfterMs: 10 * 60 * 1000 }),
      createStrandedScheduleScanCadenceLane({ ...laneDeps, reader, graceMs: 5 * 60 * 1000 }),
      createAbandonedRunBindingScanCadenceLane({ ...laneDeps, reader, heartbeatDeadlineMs: 5 * 60 * 1000 }),
      createDeadLetterClassifierCadenceLane({ ...laneDeps, reader }),
    ];

    const laneResults = [];
    for (const lane of lanes) {
      laneResults.push({ lane: lane.name, result: await lane.runOnce() });
    }

    const events = (await orgEvents.listByOrganization(organizationId, 100)).filter((event) =>
      event.kind === OrgEventKind.RecoveryIncidentDetected || event.kind === OrgEventKind.RecoveryScanCompleted
    );
    const incidentCount = events.filter((event) => event.kind === OrgEventKind.RecoveryIncidentDetected).length;
    const completionCount = events.filter((event) => event.kind === OrgEventKind.RecoveryScanCompleted).length;
    const expectedLanes = new Set([
      "stale-reaction-plan-scan",
      "stranded-schedule-scan",
      "abandoned-run-binding-scan",
      "dead-letter-classifier",
    ]);
    const observedLanes = new Set(laneResults.map((result) => result.lane));
    const ok =
      [...expectedLanes].every((lane) => observedLanes.has(lane)) &&
      laneResults.every(({ result }) => result.failures.length === 0 && result.status.endsWith(":1incidents")) &&
      incidentCount === 4 &&
      completionCount === 4;

    console.log(JSON.stringify({
      track: "G3 recovery scanners",
      organizationId,
      laneResults,
      recoveryEvents: { incidentCount, completionCount },
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

async function seedRecoveryCandidates(pool: Pool): Promise<void> {
  await pool.query(
    `
      INSERT INTO agentic_org_work_items (
        work_item_id, organization_id, project_id, title, description, state,
        created_at, created_by_agent_id, created_by_hat_assignment_id,
        work_item_type, updated_at, version, correlation_id, causation_id, trace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `,
    [
      workItemId,
      organizationId,
      projectId,
      "Recovery scanner proof work",
      "seed row for G3 proof",
      WorkItemState.InProgress,
      oldIso,
      "agent-proof",
      "hat-proof",
      WorkItemType.Task,
      oldIso,
      1,
      organizationId,
      createId("cause"),
      organizationId,
    ],
  );

  await pool.query(
    `
      INSERT INTO agentic_org_reaction_plans (
        reaction_plan_id, consumer_name, created_at, status, trigger_event_id,
        organization_id, project_id, work_item_id, action_json, attempt_count,
        claim_id, claimed_at, claim_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::JSONB, $10, $11, $12, $13)
    `,
    [
      createId("rp-stale"),
      "v0_automation_planner",
      oldIso,
      ReactionPlanStatus.Claimed,
      createId("evt"),
      organizationId,
      projectId,
      workItemId,
      JSON.stringify({ actionType: "request_implementation_assignment" }),
      1,
      createId("claim"),
      oldIso,
      expiredIso,
    ],
  );

  await pool.query(
    `
      INSERT INTO agentic_org_reaction_plans (
        reaction_plan_id, consumer_name, created_at, status, trigger_event_id,
        organization_id, project_id, work_item_id, action_json, attempt_count,
        failed_at, failure_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::JSONB, $10, $11, $12::JSONB)
    `,
    [
      createId("rp-dead"),
      "v0_automation_planner",
      oldIso,
      ReactionPlanStatus.Failed,
      createId("evt"),
      organizationId,
      projectId,
      workItemId,
      JSON.stringify({ actionType: "request_implementation_assignment" }),
      5,
      expiredIso,
      JSON.stringify({ message: "invalid durable reaction plan action", retryable: false }),
    ],
  );

  await pool.query(
    `
      INSERT INTO agentic_org_work_schedule_blocks (
        work_schedule_block_id, organization_id, project_id, team_id, work_item_id,
        discussion_anchor_id, assigned_agent_id, assigned_hat_assignment_id,
        block_type, state, title, purpose, starts_at, ends_at,
        scheduled_by_agent_id, scheduled_by_hat_assignment_id, scheduled_at,
        updated_at, version, correlation_id, causation_id, trace_id
      ) VALUES ($1, $2, $3, NULL, $4, NULL, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `,
    [
      createId("sched"),
      organizationId,
      projectId,
      workItemId,
      "agent-proof",
      "hat-proof",
      ScheduleBlockType.PrioritizedWork,
      ScheduleBlockState.Active,
      "Expired recovery proof block",
      "prove stranded schedule scanning",
      oldIso,
      expiredIso,
      "agent-proof",
      "hat-proof",
      oldIso,
      expiredIso,
      1,
      organizationId,
      createId("cause"),
      organizationId,
    ],
  );

  await pool.query(
    `
      INSERT INTO agentic_org_hermes_run (
        run_id, work_item_id, agent_id, session_id, hat_assignment_id,
        prompt_flow_run_id, state, last_heartbeat_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [createId("run"), workItemId, "agent-proof", "session-proof", "hat-proof", "prompt-proof", "running", oldIso],
  );
}

await main();
