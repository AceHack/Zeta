import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { HermesRunState, type HermesRunBinding } from "../../hermes/src/index.ts";
import {
  createCockroachHermesRuntime,
  type CockroachAnySqlStatement,
  type CockroachGenericSqlExecutor,
} from "../src/index.ts";

function binding(): HermesRunBinding {
  return {
    workItemId: "wi-1",
    agentId: "agent-1",
    sessionId: "sess-1",
    hatAssignmentId: "hat-1",
    promptFlowRunId: "pf-1",
  };
}

function runRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    run_id: "run-1",
    work_item_id: "wi-1",
    agent_id: "agent-1",
    session_id: "sess-1",
    hat_assignment_id: "hat-1",
    prompt_flow_run_id: "pf-1",
    state: HermesRunState.Running,
    last_heartbeat_ms: 1000,
    outcome_summary: null,
    outcome_evidence_refs: null,
    failure_reason: null,
    ...overrides,
  };
}

describe("cockroach hermes runtime (durable agent runs)", () => {
  test("launchRun inserts a Running run bound to the org facts", async () => {
    const executor = recordingExecutor([]);
    const runtime = createCockroachHermesRuntime({ executor, idGenerator: { nextRunId: () => "run-1" } });

    const result = await runtime.launchRun(binding());

    equal(result.outcome, "ok");
    if (result.outcome !== "ok") return;
    equal(result.run.runId, "run-1");
    equal(result.run.state, HermesRunState.Running);
    const insert = executor.statements[0];
    equal(insert?.sql.includes("INSERT INTO agentic_org_hermes_run"), true);
    equal(insert?.parameters[0], "run-1");
    equal(insert?.parameters[6], HermesRunState.Running);
  });

  test("heartbeat on a Running run advances last_heartbeat_at", async () => {
    const executor = recordingExecutor([runRow()]);
    const runtime = createCockroachHermesRuntime({ executor });

    const result = await runtime.heartbeat("run-1");

    equal(result.outcome, "ok");
    const update = executor.statements.find((s) => s.sql.includes("UPDATE agentic_org_hermes_run"));
    equal(update?.sql.includes("last_heartbeat_at = now()"), true);
  });

  test("heartbeat on an unknown run returns unknown_run feedback (never throws)", async () => {
    const executor = recordingExecutor([]); // no row
    const runtime = createCockroachHermesRuntime({ executor });

    const result = await runtime.heartbeat("missing");

    equal(result.outcome, "feedback");
    if (result.outcome !== "feedback") return;
    equal(result.feedback.reason, "unknown_run");
  });

  test("completeRun on a Running run sets Completed + outcome", async () => {
    const executor = recordingExecutor([runRow()]);
    const runtime = createCockroachHermesRuntime({ executor });

    const result = await runtime.completeRun("run-1", { summary: "done", evidenceRefs: ["pr-1"] });

    equal(result.outcome, "ok");
    if (result.outcome !== "ok") return;
    equal(result.run.state, HermesRunState.Completed);
    equal(result.run.outcome?.summary, "done");
    const update = executor.statements.find((s) => s.sql.includes("SET state ="));
    equal(update?.sql.includes(HermesRunState.Completed) || update?.parameters.includes(HermesRunState.Completed), true);
  });

  test("completeRun on a non-Running run returns run_not_running feedback", async () => {
    const executor = recordingExecutor([runRow({ state: HermesRunState.Completed })]);
    const runtime = createCockroachHermesRuntime({ executor });

    const result = await runtime.completeRun("run-1", { summary: "x", evidenceRefs: [] });

    equal(result.outcome, "feedback");
    if (result.outcome !== "feedback") return;
    equal(result.feedback.reason, "run_not_running");
  });
});

function recordingExecutor(rows: readonly Record<string, unknown>[]): CockroachGenericSqlExecutor & {
  statements: CockroachAnySqlStatement[];
} {
  const statements: CockroachAnySqlStatement[] = [];
  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
      statements.push(statement);
      return { rows: rows as readonly Row[] };
    },
    executeTransaction: async (operation) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
          statements.push(statement);
          return { rows: rows as readonly Row[] };
        },
      }),
  };
}
