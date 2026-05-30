import { equal, ok } from "node:assert/strict";
import { execPath } from "node:process";
import { test } from "node:test";

import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  type ReactionPlanAction,
} from "../../../packages/domain/src/index.ts";
import { buildVerificationToolRequest, verificationEvidenceRef } from "../../../packages/application/src/index.ts";
import { createSubprocessSandbox } from "../src/adapters/subprocess-sandbox.ts";

function action(): ReactionPlanAction {
  return {
    actionType: ReactionPlanActionType.CreateSupervisorTriage,
    triggerEventId: "evt-1",
    organizationId: "org-1",
    projectId: "proj-1",
    teamId: "team-1",
    workItemId: "wi-sandbox-live",
    requiredHat: RequiredHat.EngineeringManager,
    reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    supervisorSignalId: "sig-1",
    targetLevel: "manager",
  } as ReactionPlanAction;
}

test("the agent really executes a sandboxed subprocess and produces sha256 evidence", async () => {
  const sandbox = createSubprocessSandbox();
  const result = await sandbox.run(buildVerificationToolRequest(action(), execPath));

  equal(result.ok, true);
  const ref = verificationEvidenceRef(result);
  ok(ref !== undefined);
  ok(ref?.startsWith("sandbox:sha256:"));
});

test("a tool that exceeds its timeout fails as Result, never hangs the agent", async () => {
  const sandbox = createSubprocessSandbox();
  // a node program that sleeps far longer than the 50ms budget
  const result = await sandbox.run({
    command: execPath,
    args: ["-e", "setTimeout(() => {}, 60000)"],
    timeoutMs: 50,
  });

  equal(result.ok, false);
});

test("rejects a relative command path as a Result (never PATH-resolves a binary)", async () => {
  const sandbox = createSubprocessSandbox();
  const result = await sandbox.run({ command: "node", args: ["-e", "1"], timeoutMs: 5_000 });

  equal(result.ok, false);
  if (result.ok) return;
  ok(result.reason.includes("absolute"));
});

test("the sandbox strips the environment (the tool cannot read worker secrets)", async () => {
  process.env["WORKER_SECRET_TEST"] = "top-secret";
  try {
    const sandbox = createSubprocessSandbox();
    const result = await sandbox.run({
      command: execPath,
      args: ["-e", "process.stdout.write(String(process.env.WORKER_SECRET_TEST))"],
      timeoutMs: 5_000,
    });
    equal(result.ok, true);
    if (!result.ok) return;
    // the secret is NOT visible inside the sandbox
    equal(result.stdout.trim(), "undefined");
  } finally {
    delete process.env["WORKER_SECRET_TEST"];
  }
});
