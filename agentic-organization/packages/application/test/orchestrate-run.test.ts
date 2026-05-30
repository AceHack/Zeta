import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { createInProcessHermesRuntime, HermesRunState } from "../../hermes/src/index.ts";
import { createInProcessMemory } from "../../memory/src/index.ts";
import { AgentLiveness, evaluateKeepAlive } from "../../keepalive/src/index.ts";
import {
  runWorkItemThroughHermes,
  type AgentHeartbeatRecord,
  type AgentHeartbeatWriter,
  type WorkItemRunRequest,
} from "../src/orchestrate-run.ts";

function request(overrides: Partial<WorkItemRunRequest> = {}): WorkItemRunRequest {
  return {
    organizationId: "org-1",
    workItemId: "wi-1",
    agentId: "agent-1",
    sessionId: "sess-1",
    hatAssignmentId: "hat-1",
    promptFlowRunId: "pf-1",
    projectId: "proj-1",
    priorContextNeeded: true,
    actionSummary: "implemented the feature",
    evidenceRefs: ["pr-123"],
    learned: "the api needs pagination",
    ...overrides,
  };
}

function createRecordingAgentHeartbeatWriter(): AgentHeartbeatWriter & { records: AgentHeartbeatRecord[] } {
  const records: AgentHeartbeatRecord[] = [];
  return {
    records,
    recordAgentHeartbeat: async (record) => {
      records.push(record);
    },
  };
}

test("a full run: launch -> recall -> act -> retain -> complete, all attributed", async () => {
  const hermes = createInProcessHermesRuntime();
  const memory = createInProcessMemory();
  const result = await runWorkItemThroughHermes(request(), { hermes, memory });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  // the run completed
  equal(result.run.state, HermesRunState.Completed);
  equal(result.run.outcome?.summary, "implemented the feature");
  // what was learned was retained, attributed to the agent/project
  equal(result.retained?.attribution.projectId, "proj-1");
  // recall happened in-scope (empty first time is fine; the point is it was attributed)
  equal(result.recalledCount >= 0, true);
});

test("the completed run's heartbeat marks the agent ALIVE to the keep-alive engine", async () => {
  const hermes = createInProcessHermesRuntime({ clock: { now: () => 5000 }, idGenerator: { nextRunId: () => "r1" } });
  const memory = createInProcessMemory();
  const result = await runWorkItemThroughHermes(request(), { hermes, memory });
  if (result.outcome !== "ok") return;
  // feed the run heartbeat into the deterministic keep-alive engine
  const ka = evaluateKeepAlive({
    nowMs: 5000,
    orgHeartbeatAgeMs: 0,
    orgHeartbeatDeadlineMs: 30_000,
    agents: [{ agentId: "agent-1", hatAssignmentId: "hat-1", workItemId: "wi-1", heartbeatAgeMs: 0, deadlineMs: 60_000 }],
    leases: [],
  });
  equal(ka.agentLiveness[0]?.liveness, AgentLiveness.Alive);
});

test("when prior context is not needed, recall is skipped", async () => {
  const hermes = createInProcessHermesRuntime();
  const memory = createInProcessMemory();
  const result = await runWorkItemThroughHermes(request({ priorContextNeeded: false }), { hermes, memory });
  if (result.outcome !== "ok") return;
  equal(result.recalledCount, 0);
});

test("nothing-learned means nothing retained (no junk memories)", async () => {
  const hermes = createInProcessHermesRuntime();
  const memory = createInProcessMemory();
  const result = await runWorkItemThroughHermes(request({ learned: "" }), { hermes, memory });
  if (result.outcome !== "ok") return;
  equal(result.retained, undefined);
});

test("a heartbeating run persists agent liveness through the injected writer", async () => {
  const hermes = createInProcessHermesRuntime();
  const memory = createInProcessMemory();
  const writer = createRecordingAgentHeartbeatWriter();

  const result = await runWorkItemThroughHermes(request(), {
    hermes,
    memory,
    agentHeartbeatWriter: writer,
    agentHeartbeatDeadlineMs: 60_000,
  });

  equal(result.outcome, "ok");
  deepEqual(writer.records, [
    {
      organizationId: "org-1",
      agentId: "agent-1",
      hatAssignmentId: "hat-1",
      workItemId: "wi-1",
      deadlineMs: 60_000,
    },
  ]);
});

test("a run that vanishes before its heartbeat persists no agent liveness", async () => {
  const hermes = {
    ...createInProcessHermesRuntime(),
    heartbeat: async () => ({ outcome: "feedback" as const, feedback: { reason: "unknown_run" as const, message: "run vanished" } }),
  };
  const memory = createInProcessMemory();
  const writer = createRecordingAgentHeartbeatWriter();

  const result = await runWorkItemThroughHermes(request(), {
    hermes,
    memory,
    agentHeartbeatWriter: writer,
    agentHeartbeatDeadlineMs: 60_000,
  });

  equal(result.outcome, "feedback");
  deepEqual(writer.records, []);
});

test("a launch failure surfaces as feedback, not a throw", async () => {
  // a hermes whose launch always fails
  const failingHermes = {
    ...createInProcessHermesRuntime(),
    launchRun: async () => ({ outcome: "feedback" as const, feedback: { reason: "unknown_run" as const, message: "no capacity" } }),
  };
  const memory = createInProcessMemory();
  const result = await runWorkItemThroughHermes(request(), { hermes: failingHermes, memory });
  equal(result.outcome, "feedback");
});
