import { equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType, SupervisorChainLevel, SupervisorSignalToolType } from "../../domain/src/index.ts";
import {
  HatAuthorityDecisionStatus,
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  createPolicyDecisionObservationPort,
  type PolicyDecisionObservation,
  type PolicyDecisionObservationStore,
} from "../src/index.ts";

describe("policy decision observation port", () => {
  test("records denied policy observations through a generic store", async () => {
    const store = createRecordingPolicyDecisionObservationStore();
    const port = createPolicyDecisionObservationPort({ store });
    const observation = createDeniedPolicyDecisionObservation();

    const result = await port.observePolicyDecision(observation);

    equal(result.status, PolicyDecisionObservationPersistenceStatus.Recorded);
    equal(store.recordedObservations.length, 1);
    equal(store.recordedObservations[0], observation);
  });

  test("treats duplicate observations as already durable", async () => {
    const store = createRecordingPolicyDecisionObservationStore({
      status: PolicyDecisionObservationPersistenceStatus.Duplicate,
    });
    const port = createPolicyDecisionObservationPort({ store });

    const result = await port.observePolicyDecision(createDeniedPolicyDecisionObservation());

    equal(result.status, PolicyDecisionObservationPersistenceStatus.Duplicate);
    equal(store.recordedObservations.length, 1);
  });

  test("returns conflicting observations instead of hiding contradictory governance evidence", async () => {
    const store = createRecordingPolicyDecisionObservationStore({
      status: PolicyDecisionObservationPersistenceStatus.Conflict,
    });
    const port = createPolicyDecisionObservationPort({ store });

    const result = await port.observePolicyDecision(createDeniedPolicyDecisionObservation());

    equal(result.status, PolicyDecisionObservationPersistenceStatus.Conflict);
  });
});

function createRecordingPolicyDecisionObservationStore(
  input: { status?: PolicyDecisionObservationPersistenceStatus } = {},
): PolicyDecisionObservationStore & {
  recordedObservations: PolicyDecisionObservation[];
} {
  const recordedObservations: PolicyDecisionObservation[] = [];

  return {
    recordedObservations,
    recordPolicyDecisionObservation: async (observation) => {
      recordedObservations.push(observation);
      return {
        status: input.status ?? PolicyDecisionObservationPersistenceStatus.Recorded,
      };
    },
  };
}

function createDeniedPolicyDecisionObservation(): PolicyDecisionObservation {
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
    decision: {
      status: PolicyDecisionStatus.Denied,
      decisionId: "policy-decision-denied-001",
      policyVersion: "policy-v1",
      reason: HatAuthorityDecisionStatus.ToolDenied,
    },
    observedAt: "2026-05-25T20:00:00.000Z",
  };
}
