import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  HatAssignmentAuthorityState,
  type HatAssignmentAuthoritySnapshot,
} from "../../domain/src/index.ts";
import {
  HatAuthorityDecisionStatus,
  type HatAuthorityRequest,
} from "../../policy/src/index.ts";
import {
  buildHatDefinitions,
  createHatAuthorityPort,
  type HatAssignmentAuthorityReaderPort,
} from "../src/index.ts";

describe("real hat authority port", () => {
  test("allows an active delivery hat to run a write-code tool", async () => {
    const port = createHatAuthorityPort({
      hatAssignmentAuthorityReader: readerFor(authority({ hatId: "release_operator" })),
      hatDefinitions: buildHatDefinitions(),
      createId,
      policyVersion: "hat-policy-test",
    });

    const decision = await port.evaluateHatAuthority(request({ toolType: "write_code" }));

    equal(decision.status, HatAuthorityDecisionStatus.Active);
    equal(decision.policyVersion, "hat-policy-test");
  });

  test("denies a TPM hat that attempts a write-code tool", async () => {
    const port = createHatAuthorityPort({
      hatAssignmentAuthorityReader: readerFor(authority({ hatId: "program_director" })),
      hatDefinitions: buildHatDefinitions(),
      createId,
    });

    const decision = await port.evaluateHatAuthority(request({ toolType: "write_code" }));

    equal(decision.status, HatAuthorityDecisionStatus.ToolDenied);
  });

  test("denies missing hat assignments", async () => {
    const port = createHatAuthorityPort({
      hatAssignmentAuthorityReader: readerFor(undefined),
      hatDefinitions: buildHatDefinitions(),
      createId,
    });

    const decision = await port.evaluateHatAuthority(request({ toolType: "write_code" }));

    equal(decision.status, HatAuthorityDecisionStatus.Missing);
  });

  test("denies actor and scope mismatches", async () => {
    const port = createHatAuthorityPort({
      hatAssignmentAuthorityReader: readerFor(authority({ assignedAgentId: "agent-other" })),
      hatDefinitions: buildHatDefinitions(),
      createId,
    });

    const decision = await port.evaluateHatAuthority(request({ toolType: "write_code" }));

    equal(decision.status, HatAuthorityDecisionStatus.ScopeDenied);
  });

  test("does not widen team-scoped authority to project-wide commands", async () => {
    const port = createHatAuthorityPort({
      hatAssignmentAuthorityReader: readerFor(authority({ teamId: "team-1" })),
      hatDefinitions: buildHatDefinitions(),
      createId,
    });

    const decision = await port.evaluateHatAuthority(request({ toolType: "write_code", omitTeamId: true }));

    equal(decision.status, HatAuthorityDecisionStatus.ScopeDenied);
  });

  test("maps inactive durable authority states to policy denials", async () => {
    const revokedPort = createHatAuthorityPort({
      hatAssignmentAuthorityReader: readerFor(authority({ state: HatAssignmentAuthorityState.Revoked })),
      hatDefinitions: buildHatDefinitions(),
      createId,
    });
    const expiredPort = createHatAuthorityPort({
      hatAssignmentAuthorityReader: readerFor(authority({ state: HatAssignmentAuthorityState.Expired })),
      hatDefinitions: buildHatDefinitions(),
      createId,
    });

    equal((await revokedPort.evaluateHatAuthority(request({ toolType: "write_code" }))).status, HatAuthorityDecisionStatus.Revoked);
    equal((await expiredPort.evaluateHatAuthority(request({ toolType: "write_code" }))).status, HatAuthorityDecisionStatus.Expired);
  });
});

function request(input: { toolType?: string; omitTeamId?: boolean } = {}): HatAuthorityRequest {
  return {
    commandId: "cmd-1",
    commandType: "test.command",
    actor: {
      agentId: "agent-1",
      hatAssignmentId: "hat-assignment-1",
    },
    agentId: "agent-1",
    hatAssignmentId: "hat-assignment-1",
    scope: {
      organizationId: "org-lfg",
      projectId: "project-1",
      ...(input.omitTeamId ? {} : { teamId: "team-1" }),
    },
    ...(input.toolType === undefined ? {} : { toolType: input.toolType }),
    trace: {
      correlationId: "corr-1",
      causationId: "cause-1",
      traceId: "trace-1",
      idempotencyKey: "idem-1",
    },
  };
}

function authority(input: Partial<HatAssignmentAuthoritySnapshot> = {}): HatAssignmentAuthoritySnapshot {
  return {
    hatAssignmentId: "hat-assignment-1",
    hatId: "release_operator",
    organizationId: "org-lfg",
    projectId: "project-1",
    teamId: "team-1",
    assignedAgentId: "agent-1",
    state: HatAssignmentAuthorityState.Active,
    ...input,
  };
}

function readerFor(authoritySnapshot: HatAssignmentAuthoritySnapshot | undefined): HatAssignmentAuthorityReaderPort {
  return {
    findHatAssignmentAuthority: async () => authoritySnapshot,
  };
}

function createId(prefix: string): string {
  return `${prefix}-1`;
}
