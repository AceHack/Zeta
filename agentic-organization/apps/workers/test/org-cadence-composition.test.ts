import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { RunLifecyclePhase, RunScope } from "../../../packages/application/src/index.ts";
import type { CockroachGenericSqlExecutor } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import { composeOrgCadenceLoops } from "../src/org-cadence-composition.ts";
import type { CadenceLaneTickRecord } from "../src/cadence-lane.ts";

test("org cadence composition can disable legacy work-os and run the observe-act work-item lane", async () => {
  const records: CadenceLaneTickRecord[] = [];
  let observeActCommands = 0;
  let legacyIntakeCalls = 0;

  const handle = composeOrgCadenceLoops({
    executor: createEmptyCockroachExecutor(),
    organizationId: "org-lfg",
    now: () => Date.parse("2026-05-31T12:00:00.000Z"),
    createId: (prefix) => `${prefix}-composition-test`,
    sleep: async () => {},
    maxTicksPerLane: 1,
    observer: { record: (record) => records.push(record) },
    workOsDriver: "observe-act",
    intake: async () => {
      legacyIntakeCalls += 1;
      throw new Error("legacy work-os intake should be disabled");
    },
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "project-1",
      workItemId: "work-1",
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "release_operator",
      hatAssignmentId: "99",
      agentId: "agent-release-1",
    }),
    observeActRunCommand: async () => {
      observeActCommands += 1;
      return { status: "accepted" };
    },
    observeActDispatchTool: async () => {
      throw new Error("observe-act composition test should not dispatch MCP");
    },
  });

  await handle.done;

  ok(records.some((record) => record.lane === "observe-act-work-item"));
  equal(records.some((record) => record.lane === "work-os"), false);
  equal(legacyIntakeCalls, 0);
  equal(observeActCommands, 1);
});

function createEmptyCockroachExecutor(): CockroachGenericSqlExecutor {
  return {
    execute: async () => ({ rows: [] }),
    executeTransaction: async (operation) =>
      await operation({
        execute: async () => ({ rows: [] }),
      }),
  };
}
