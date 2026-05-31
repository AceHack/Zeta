import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ReactionPlanStatus, ScheduleBlockState } from "../../domain/src/index.ts";
import {
  CockroachRecoveryScanReaderStatement,
  createCockroachRecoveryScanReader,
  type CockroachRecoveryScanSqlExecutor,
  type CockroachRecoveryScanSqlStatement,
} from "../src/cockroach-recovery-scan-reader.ts";

test("cockroach recovery reader uses bounded tenant-scoped lifecycle predicates", async () => {
  const executor = createRecordingExecutor();
  const reader = createCockroachRecoveryScanReader({ executor });

  await reader.listStaleReactionPlanCandidates({ organizationId: "org-lfg", nowIso: "2026-05-30T12:00:00.000Z", staleBeforeIso: "2026-05-30T11:50:00.000Z", limit: 25 });
  await reader.listStrandedScheduleCandidates({ organizationId: "org-lfg", nowIso: "2026-05-30T12:00:00.000Z", endedBeforeIso: "2026-05-30T11:55:00.000Z", limit: 25 });
  await reader.listAbandonedRunBindingCandidates({ organizationId: "org-lfg", nowMs: Date.parse("2026-05-30T12:00:00.000Z"), heartbeatBeforeIso: "2026-05-30T11:59:00.000Z", limit: 25 });
  await reader.listDeadLetterCandidates({ organizationId: "org-lfg", limit: 25 });

  deepEqual(executor.statements.map((statement) => statement.name), [
    CockroachRecoveryScanReaderStatement.ListStaleReactionPlanCandidates,
    CockroachRecoveryScanReaderStatement.ListStrandedScheduleCandidates,
    CockroachRecoveryScanReaderStatement.ListAbandonedRunBindingCandidates,
    CockroachRecoveryScanReaderStatement.ListDeadLetterCandidates,
  ]);
  ok(executor.statements[0]!.sql.includes("agentic_org_reaction_plans"));
  ok(executor.statements[0]!.sql.includes("organization_id = $1"));
  ok(executor.statements[0]!.sql.includes("claim_expires_at <= $2"));
  ok(executor.statements[0]!.sql.includes("created_at <= $3"));
  ok(executor.statements[0]!.sql.includes("LIMIT $4"));
  deepEqual(executor.statements[0]!.parameters, ["org-lfg", "2026-05-30T12:00:00.000Z", "2026-05-30T11:50:00.000Z", 25]);

  ok(executor.statements[1]!.sql.includes("agentic_org_work_schedule_blocks"));
  ok(executor.statements[1]!.sql.includes("state IN"));
  ok(executor.statements[1]!.sql.includes("ends_at <= $2"));

  ok(executor.statements[2]!.sql.includes("agentic_org_hermes_run"));
  ok(executor.statements[2]!.sql.includes("agentic_org_work_items"));
  ok(executor.statements[2]!.sql.includes("state = 'running'"));
  ok(executor.statements[2]!.sql.includes("last_heartbeat_at <= $2"));

  ok(executor.statements[3]!.sql.includes("status = 'failed'"));
  ok(executor.statements[3]!.sql.includes("failure_json IS NOT NULL"));
});

test("cockroach recovery reader maps lifecycle rows into scanner candidates", async () => {
  const reader = createCockroachRecoveryScanReader({ executor: createRecordingExecutor() });

  const stale = await reader.listStaleReactionPlanCandidates({ organizationId: "org-lfg", nowIso: "2026-05-30T12:00:00.000Z", staleBeforeIso: "2026-05-30T11:50:00.000Z", limit: 25 });
  const stranded = await reader.listStrandedScheduleCandidates({ organizationId: "org-lfg", nowIso: "2026-05-30T12:00:00.000Z", endedBeforeIso: "2026-05-30T11:55:00.000Z", limit: 25 });
  const abandoned = await reader.listAbandonedRunBindingCandidates({ organizationId: "org-lfg", nowMs: Date.parse("2026-05-30T12:00:00.000Z"), heartbeatBeforeIso: "2026-05-30T11:59:00.000Z", limit: 25 });
  const deadLetters = await reader.listDeadLetterCandidates({ organizationId: "org-lfg", limit: 25 });

  equal(stale[0]?.reactionPlanId, "rp-1");
  equal(stranded[0]?.workScheduleBlockId, "sched-1");
  equal(abandoned[0]?.runId, "run-1");
  equal(deadLetters[0]?.deadLetterId, "rp-failed");
  equal(deadLetters[0]?.failureMessage, "invalid durable reaction plan action");
});

type RecordingExecutor = CockroachRecoveryScanSqlExecutor & {
  statements: CockroachRecoveryScanSqlStatement[];
};

function createRecordingExecutor(): RecordingExecutor {
  const statements: CockroachRecoveryScanSqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachRecoveryScanSqlStatement) => {
      statements.push(statement);

      if (statement.name === CockroachRecoveryScanReaderStatement.ListStaleReactionPlanCandidates) {
        return {
          rows: [
            {
              reaction_plan_id: "rp-1",
              organization_id: "org-lfg",
              status: ReactionPlanStatus.Claimed,
              created_at: "2026-05-30T10:00:00.000Z",
              claimed_at: "2026-05-30T10:01:00.000Z",
              claim_expires_at: "2026-05-30T10:02:00.000Z",
              attempt_count: 1,
              next_attempt_at: null,
            },
          ] as Row[],
        };
      }

      if (statement.name === CockroachRecoveryScanReaderStatement.ListStrandedScheduleCandidates) {
        return {
          rows: [
            {
              work_schedule_block_id: "sched-1",
              organization_id: "org-lfg",
              work_item_id: "work-1",
              assigned_agent_id: "agent-1",
              assigned_hat_assignment_id: "hat-1",
              state: ScheduleBlockState.Active,
              starts_at: "2026-05-30T10:00:00.000Z",
              ends_at: "2026-05-30T11:00:00.000Z",
            },
          ] as Row[],
        };
      }

      if (statement.name === CockroachRecoveryScanReaderStatement.ListAbandonedRunBindingCandidates) {
        return {
          rows: [
            {
              run_id: "run-1",
              work_item_id: "work-1",
              agent_id: "agent-1",
              session_id: "session-1",
              hat_assignment_id: "hat-1",
              prompt_flow_run_id: "prompt-1",
              state: "running",
              last_heartbeat_ms: Date.parse("2026-05-30T10:00:00.000Z"),
            },
          ] as Row[],
        };
      }

      return {
        rows: [
          {
            dead_letter_id: "rp-failed",
            organization_id: "org-lfg",
            created_at: "2026-05-30T10:00:00.000Z",
            failed_at: "2026-05-30T10:05:00.000Z",
            failure_json: { message: "invalid durable reaction plan action", retryable: false },
            attempt_count: 1,
          },
        ] as Row[],
      };
    },
  };
}
