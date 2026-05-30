/**
 * Cockroach-backed Hermes runtime — the durable HermesRuntime adapter behind the
 * same port the in-process fake implements. Every agent run is a durable,
 * auditable row: the Organization binding, the run state, the last heartbeat, and
 * the outcome/failure. State transitions are conditional (heartbeat/complete/fail
 * only apply to a Running run); an unknown run returns feedback, never throws.
 * Persists across restarts so the org keeps a history of who ran on what.
 */

import { randomUUID } from "node:crypto";

import {
  HermesRunState,
  HermesRuntimeFeedbackReason,
  type HermesRun,
  type HermesRunBinding,
  type HermesRunOutcome,
  type HermesRunResult,
  type HermesRuntime,
} from "../../hermes/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export const CockroachHermesRuntimeStatement = {
  LaunchRun: "launch_hermes_run",
  GetRun: "get_hermes_run",
  HeartbeatRun: "heartbeat_hermes_run",
  CompleteRun: "complete_hermes_run",
  FailRun: "fail_hermes_run",
} as const;
export type CockroachHermesRuntimeStatement =
  (typeof CockroachHermesRuntimeStatement)[keyof typeof CockroachHermesRuntimeStatement];

export type CockroachHermesRuntimeDeps = {
  executor: CockroachGenericSqlExecutor;
  idGenerator?: { nextRunId: () => string };
  clock?: { now: () => number };
};

type HermesRunRow = {
  run_id: string;
  work_item_id: string;
  agent_id: string;
  session_id: string;
  hat_assignment_id: string;
  prompt_flow_run_id: string;
  state: string;
  last_heartbeat_ms: number | string;
  outcome_summary: string | null;
  outcome_evidence_refs: readonly string[] | string | null;
  failure_reason: string | null;
};

export function createCockroachHermesRuntime(deps: CockroachHermesRuntimeDeps): HermesRuntime {
  // default to globally-unique ids (NOT a per-instance counter): a fresh runtime
  // is created per execution, so a counter would collide on retry / across runs
  const nextRunId = deps.idGenerator?.nextRunId ?? (() => `hermes-run-${randomUUID()}`);
  const now = deps.clock?.now ?? (() => Date.now());

  async function readRun(runId: string): Promise<HermesRun | undefined> {
    const result = await deps.executor.execute<HermesRunRow>({
      name: CockroachHermesRuntimeStatement.GetRun,
      sql: `
        SELECT run_id, work_item_id, agent_id, session_id, hat_assignment_id, prompt_flow_run_id, state,
          (EXTRACT(EPOCH FROM last_heartbeat_at) * 1000)::INT8 AS last_heartbeat_ms,
          outcome_summary, outcome_evidence_refs, failure_reason
        FROM agentic_org_hermes_run
        WHERE run_id = $1
      `,
      parameters: [runId],
    });
    const row = result.rows[0];
    return row === undefined ? undefined : toHermesRun(row);
  }

  return {
    async launchRun(binding: HermesRunBinding): Promise<HermesRunResult> {
      const runId = nextRunId();
      const lastHeartbeatMs = now();
      await deps.executor.execute({
        name: CockroachHermesRuntimeStatement.LaunchRun,
        sql: `
          INSERT INTO agentic_org_hermes_run (
            run_id, work_item_id, agent_id, session_id, hat_assignment_id, prompt_flow_run_id,
            state, last_heartbeat_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        `,
        parameters: [
          runId,
          binding.workItemId,
          binding.agentId,
          binding.sessionId,
          binding.hatAssignmentId,
          binding.promptFlowRunId,
          HermesRunState.Running,
        ],
      });
      return { outcome: "ok", run: { runId, binding: { ...binding }, state: HermesRunState.Running, lastHeartbeatMs } };
    },

    async getRun(runId: string): Promise<HermesRun | undefined> {
      return await readRun(runId);
    },

    async heartbeat(runId: string): Promise<HermesRunResult> {
      const run = await readRun(runId);
      const guard = requireRunning(runId, run);
      if (guard.outcome === "feedback") {
        return guard;
      }
      await deps.executor.execute({
        name: CockroachHermesRuntimeStatement.HeartbeatRun,
        sql: `UPDATE agentic_org_hermes_run SET last_heartbeat_at = now() WHERE run_id = $1 AND state = $2`,
        parameters: [runId, HermesRunState.Running],
      });
      return { outcome: "ok", run: { ...guard.run, lastHeartbeatMs: now() } };
    },

    async completeRun(runId: string, outcome: HermesRunOutcome): Promise<HermesRunResult> {
      const run = await readRun(runId);
      const guard = requireRunning(runId, run);
      if (guard.outcome === "feedback") {
        return guard;
      }
      await deps.executor.execute({
        name: CockroachHermesRuntimeStatement.CompleteRun,
        sql: `
          UPDATE agentic_org_hermes_run
          SET state = $2, outcome_summary = $3, outcome_evidence_refs = $4::JSONB, last_heartbeat_at = now()
          WHERE run_id = $1 AND state = $5
        `,
        parameters: [
          runId,
          HermesRunState.Completed,
          outcome.summary,
          JSON.stringify(outcome.evidenceRefs),
          HermesRunState.Running,
        ],
      });
      return {
        outcome: "ok",
        run: {
          ...guard.run,
          state: HermesRunState.Completed,
          outcome: { summary: outcome.summary, evidenceRefs: [...outcome.evidenceRefs] },
        },
      };
    },

    async failRun(runId: string, reason: string): Promise<HermesRunResult> {
      const run = await readRun(runId);
      const guard = requireRunning(runId, run);
      if (guard.outcome === "feedback") {
        return guard;
      }
      await deps.executor.execute({
        name: CockroachHermesRuntimeStatement.FailRun,
        sql: `
          UPDATE agentic_org_hermes_run
          SET state = $2, failure_reason = $3, last_heartbeat_at = now()
          WHERE run_id = $1 AND state = $4
        `,
        parameters: [runId, HermesRunState.Failed, reason, HermesRunState.Running],
      });
      return { outcome: "ok", run: { ...guard.run, state: HermesRunState.Failed, failureReason: reason } };
    },
  };
}

type RunningGuard = { outcome: "ok"; run: HermesRun } | HermesRunResult;

function requireRunning(runId: string, run: HermesRun | undefined): RunningGuard {
  if (run === undefined) {
    return {
      outcome: "feedback",
      feedback: { reason: HermesRuntimeFeedbackReason.UnknownRun, message: `no hermes run '${runId}'` },
    };
  }
  if (run.state !== HermesRunState.Running) {
    return {
      outcome: "feedback",
      feedback: { reason: HermesRuntimeFeedbackReason.RunNotRunning, message: `hermes run '${runId}' is ${run.state}` },
    };
  }
  return { outcome: "ok", run };
}

function toHermesRun(row: HermesRunRow): HermesRun {
  const run: HermesRun = {
    runId: row.run_id,
    binding: {
      workItemId: row.work_item_id,
      agentId: row.agent_id,
      sessionId: row.session_id,
      hatAssignmentId: row.hat_assignment_id,
      promptFlowRunId: row.prompt_flow_run_id,
    },
    state: row.state as HermesRunState,
    lastHeartbeatMs: Number(row.last_heartbeat_ms),
  };
  if (row.outcome_summary !== null) {
    run.outcome = { summary: row.outcome_summary, evidenceRefs: parseEvidenceRefs(row.outcome_evidence_refs) };
  }
  if (row.failure_reason !== null) {
    run.failureReason = row.failure_reason;
  }
  return run;
}

function parseEvidenceRefs(value: readonly string[] | string | null): readonly string[] {
  if (value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed: unknown = JSON.parse(value as string);
    return Array.isArray(parsed) ? (parsed as readonly string[]) : [];
  } catch {
    return [];
  }
}
