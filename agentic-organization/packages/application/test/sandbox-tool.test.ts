import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  type ReactionPlanAction,
} from "../../domain/src/index.ts";
import {
  SandboxVerificationEvidencePrefix,
  buildVerificationToolRequest,
  verificationEvidenceRef,
  type SandboxToolResult,
} from "../src/sandbox-tool.ts";

function action(): ReactionPlanAction {
  return {
    actionType: ReactionPlanActionType.CreateSupervisorTriage,
    triggerEventId: "evt-1",
    organizationId: "org-1",
    projectId: "proj-1",
    teamId: "team-1",
    workItemId: "wi-sandbox-1",
    requiredHat: RequiredHat.EngineeringManager,
    reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    supervisorSignalId: "sig-1",
    targetLevel: "manager",
  } as ReactionPlanAction;
}

test("builds a bounded verification-tool request over the work item id", () => {
  const request = buildVerificationToolRequest(action(), "/usr/bin/node");
  equal(request.command, "/usr/bin/node");
  equal(request.args[0], "-e");
  // the work item id is the program argument the tool hashes
  ok(request.args.includes("wi-sandbox-1"));
  ok(request.timeoutMs > 0 && request.timeoutMs <= 10_000);
});

test("turns a valid sha256 tool result into an evidence ref", () => {
  const result: SandboxToolResult = { ok: true, stdout: "a".repeat(64) + "\n" };
  const ref = verificationEvidenceRef(result);
  equal(ref, `${SandboxVerificationEvidencePrefix}${"a".repeat(64)}`);
});

test("yields no evidence ref on tool failure (supplementary, never fatal)", () => {
  equal(verificationEvidenceRef({ ok: false, reason: "timeout" }), undefined);
});

test("rejects non-sha256 tool output (does not fabricate evidence)", () => {
  equal(verificationEvidenceRef({ ok: true, stdout: "not a digest" }), undefined);
});
