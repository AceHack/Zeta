import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import type { AgentHeartbeatRecord, CockroachControlPlaneStateStore } from "../src/index.ts";
import { createCockroachKeepAliveSnapshotSource } from "../src/index.ts";

describe("cockroach keep-alive snapshot source", () => {
  test("loads the org heartbeat age, deadline, and clock into a deterministic snapshot", async () => {
    const source = createCockroachKeepAliveSnapshotSource({
      store: createStubStore(1500),
      organizationId: "org-1",
      orgHeartbeatDeadlineMs: 5000,
      clock: { now: () => 1_000 },
    });

    const snapshot = await source.loadSnapshot();

    deepEqual(snapshot, {
      nowMs: 1_000,
      orgHeartbeatAgeMs: 1500,
      orgHeartbeatDeadlineMs: 5000,
      agents: [],
      leases: [],
    });
  });

  test("treats a never-ticked org as age 0 (just born, alive) so the first tick registers it", async () => {
    const source = createCockroachKeepAliveSnapshotSource({
      store: createStubStore(undefined),
      organizationId: "org-1",
      orgHeartbeatDeadlineMs: 5000,
      clock: { now: () => 2_000 },
    });

    const snapshot = await source.loadSnapshot();

    deepEqual(snapshot, {
      nowMs: 2_000,
      orgHeartbeatAgeMs: 0,
      orgHeartbeatDeadlineMs: 5000,
      agents: [],
      leases: [],
    });
  });

  test("loads real agent heartbeats into the snapshot so stale agents are detected", async () => {
    const agents: AgentHeartbeatRecord[] = [
      { agentId: "agent-7", hatAssignmentId: "hat-3", workItemId: "work-9", heartbeatAgeMs: 1200, deadlineMs: 8000 },
      { agentId: "agent-8", hatAssignmentId: "hat-4", workItemId: "work-10", heartbeatAgeMs: 9999, deadlineMs: 8000 },
    ];
    const source = createCockroachKeepAliveSnapshotSource({
      store: createStubStore(1500, agents),
      organizationId: "org-1",
      orgHeartbeatDeadlineMs: 5000,
      clock: { now: () => 1_000 },
    });

    const snapshot = await source.loadSnapshot();

    deepEqual(snapshot.agents, agents);
  });
});

function createStubStore(
  ageMs: number | undefined,
  agents: readonly AgentHeartbeatRecord[] = [],
): CockroachControlPlaneStateStore {
  return {
    readOrgHeartbeatAgeMs: async () => ageMs,
    tickOrgHeartbeat: async () => {},
    appendAlert: async () => {},
    recordAgentHeartbeat: async () => {},
    readAgentHeartbeats: async () => agents,
  };
}
