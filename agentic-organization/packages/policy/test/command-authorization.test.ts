import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType, SupervisorChainLevel, SupervisorSignalToolType } from "../../domain/src/index.ts";
import {
  HatAuthorityDecisionStatus,
  PolicyDecisionStatus,
  createCommandAuthorizationPort,
  type HatAuthorityPort,
} from "../src/index.ts";

describe("command authorization policy", () => {
  test("allows a command when the active hat authority allows the requested tool and scope", async () => {
    const hatAuthorityPort = createRecordingHatAuthorityPort({
      status: HatAuthorityDecisionStatus.Active,
      decisionId: "hat-decision-001",
      policyVersion: "policy-v1",
    });
    const authorizationPort = createCommandAuthorizationPort({
      hatAuthorityPort,
    });

    const request = createCommandAuthorizationRequest();
    const decision = await authorizationPort.authorizeCommand(request);

    equal(decision.status, PolicyDecisionStatus.Allowed);
    equal(decision.decisionId, "hat-decision-001");
    equal(decision.policyVersion, "policy-v1");
    deepEqual(hatAuthorityPort.requests, [
      {
        ...request,
        agentId: "agent-developer-001",
        hatAssignmentId: "hat-assignment-dev-001",
      },
    ]);
  });

  test("denies a command when hat authority is inactive", async () => {
    const authorizationPort = createCommandAuthorizationPort({
      hatAuthorityPort: createRecordingHatAuthorityPort({
        status: HatAuthorityDecisionStatus.Expired,
        decisionId: "hat-decision-expired-001",
        policyVersion: "policy-v1",
      }),
    });

    const decision = await authorizationPort.authorizeCommand(createCommandAuthorizationRequest());

    equal(decision.status, PolicyDecisionStatus.Denied);
    if (decision.status !== PolicyDecisionStatus.Denied) {
      throw new Error("expected denied policy decision");
    }
    equal(decision.decisionId, "hat-decision-expired-001");
    equal(decision.reason, HatAuthorityDecisionStatus.Expired);
  });

  test("maps every inactive hat authority status to a policy denial reason", async () => {
    const denialReasons = [
      HatAuthorityDecisionStatus.Expired,
      HatAuthorityDecisionStatus.Missing,
      HatAuthorityDecisionStatus.Revoked,
      HatAuthorityDecisionStatus.ScopeDenied,
      HatAuthorityDecisionStatus.ToolDenied,
    ] as const;

    for (const denialReason of denialReasons) {
      const authorizationPort = createCommandAuthorizationPort({
        hatAuthorityPort: createRecordingHatAuthorityPort({
          status: denialReason,
          decisionId: `hat-decision-${denialReason}`,
          policyVersion: "policy-v1",
        }),
      });

      const decision = await authorizationPort.authorizeCommand(createCommandAuthorizationRequest());

      equal(decision.status, PolicyDecisionStatus.Denied);
      if (decision.status !== PolicyDecisionStatus.Denied) {
        throw new Error("expected denied policy decision");
      }
      equal(decision.reason, denialReason);
    }
  });
});

function createCommandAuthorizationRequest() {
  return {
    commandId: "cmd-supervisor-signal-001",
    commandType: CommandType.SendSupervisorSignal,
    actor: {
      agentId: "agent-developer-001",
      hatAssignmentId: "hat-assignment-dev-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-outbox-001",
    },
    toolType: SupervisorSignalToolType.ReportBlocker,
    supervisorChain: {
      sourceLevel: SupervisorChainLevel.TeamMember,
      targetLevel: SupervisorChainLevel.Manager,
    },
    trace: {
      correlationId: "corr-supervisor-signal-001",
      causationId: "cause-team-work-001",
      traceId: "trace-supervisor-signal-001",
      idempotencyKey: "idem-supervisor-signal-001",
    },
  };
}

function createRecordingHatAuthorityPort(
  decision: Awaited<ReturnType<HatAuthorityPort["evaluateHatAuthority"]>>,
): HatAuthorityPort & {
  requests: Parameters<HatAuthorityPort["evaluateHatAuthority"]>[0][];
} {
  const requests: Parameters<HatAuthorityPort["evaluateHatAuthority"]>[0][] = [];

  return {
    requests,
    evaluateHatAuthority: async (input) => {
      requests.push(input);
      return decision;
    },
  };
}
