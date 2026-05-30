import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  HermesRunState,
  createInProcessHermesRuntime,
  type HermesRunBinding,
} from "../src/hermes-runtime.ts";

function binding(overrides: Partial<HermesRunBinding> = {}): HermesRunBinding {
  return {
    workItemId: "wi-1",
    agentId: "agent-1",
    sessionId: "sess-1",
    hatAssignmentId: "hat-1",
    promptFlowRunId: "pf-1",
    ...overrides,
  };
}

test("launching a run binds the work item/agent/session and returns Running", async () => {
  const runtime = createInProcessHermesRuntime();
  const launched = await runtime.launchRun(binding());
  equal(launched.outcome, "ok");
  if (launched.outcome !== "ok") return;
  equal(launched.run.state, HermesRunState.Running);
  equal(launched.run.binding.workItemId, "wi-1");
  // a fresh run produces a fresh heartbeat
  equal(launched.run.lastHeartbeatMs >= 0, true);
});

test("a launched run is observable by id and its heartbeat can be refreshed", async () => {
  const runtime = createInProcessHermesRuntime();
  const launched = await runtime.launchRun(binding());
  if (launched.outcome !== "ok") return;
  const runId = launched.run.runId;

  const before = (await runtime.getRun(runId))?.lastHeartbeatMs ?? -1;
  await runtime.heartbeat(runId);
  const after = (await runtime.getRun(runId))?.lastHeartbeatMs ?? -1;
  equal(after >= before, true);
});

test("completing a run moves it to Completed and records the outcome", async () => {
  const runtime = createInProcessHermesRuntime();
  const launched = await runtime.launchRun(binding());
  if (launched.outcome !== "ok") return;
  const done = await runtime.completeRun(launched.run.runId, { summary: "did the work", evidenceRefs: ["log-1"] });
  equal(done.outcome, "ok");
  if (done.outcome !== "ok") return;
  equal(done.run.state, HermesRunState.Completed);
  equal(done.run.outcome?.summary, "did the work");
});

test("failing a run moves it to Failed with a reason", async () => {
  const runtime = createInProcessHermesRuntime();
  const launched = await runtime.launchRun(binding());
  if (launched.outcome !== "ok") return;
  const failed = await runtime.failRun(launched.run.runId, "sandbox denied network");
  equal(failed.outcome, "ok");
  if (failed.outcome !== "ok") return;
  equal(failed.run.state, HermesRunState.Failed);
  equal(failed.run.failureReason, "sandbox denied network");
});

test("operating on an unknown run returns feedback, not a throw", async () => {
  const runtime = createInProcessHermesRuntime();
  const result = await runtime.completeRun("nope", { summary: "x", evidenceRefs: [] });
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, "unknown_run");
});

test("a completed run cannot be completed again (terminal-state guard)", async () => {
  const runtime = createInProcessHermesRuntime();
  const launched = await runtime.launchRun(binding());
  if (launched.outcome !== "ok") return;
  await runtime.completeRun(launched.run.runId, { summary: "x", evidenceRefs: [] });
  const again = await runtime.completeRun(launched.run.runId, { summary: "y", evidenceRefs: [] });
  equal(again.outcome, "feedback");
  if (again.outcome !== "feedback") return;
  equal(again.feedback.reason, "run_not_running");
});
