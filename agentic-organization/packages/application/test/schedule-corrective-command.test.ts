import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  CommandType,
  HatBindingPhase,
  SupervisorChainLevel,
  SupervisorSignalToolType,
  WorkItemState,
  WorkItemType,
  type HatBinding,
} from "../../domain/src/index.ts";
import {
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  type CommandAuthorizationPort,
  type PolicyDecisionObservationPort,
} from "../../policy/src/index.ts";
import { createInMemoryOrganizationStoreFactory } from "../../state/src/index.ts";
import {
  CommandResultStatus,
  ScheduleCorrectiveActionKind,
  createCommandHandlerRegistry,
  createCommandPipeline,
  createReassignAfterExpirySupervisorSignalCommand,
  createSendSupervisorSignalHandler,
  type CommandResult,
} from "../src/index.ts";
import type { CommandWorkAnchorWorkItem, WorkAnchorStateReaderPort } from "../src/ports.ts";

const NOW = "2026-05-31T21:00:00.000Z";

test("reassign_after_expiry corrective action executes as a real supervisor signal command", async () => {
  const created = createReassignAfterExpirySupervisorSignalCommand({
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-capacity",
    actor: { agentId: "agent-manager-1", hatAssignmentId: "hat-assignment-manager-1" },
    targetHatAssignmentId: "hat-assignment-rmo-1",
    sourceLevel: SupervisorChainLevel.Manager,
    targetLevel: SupervisorChainLevel.Director,
    correctiveAction: {
      actionId: "schedule.reassign_after_expiry.backend_implementer",
      kind: ScheduleCorrectiveActionKind.ReassignAfterExpiry,
      hatId: "backend_implementer",
      label: "Reassign expired hat",
      rationale: "expired hat capacity must return to supervisor/RMO assignment",
    },
    expiredBinding: expiredBinding(),
    commandId: "cmd-reassign-expired-backend",
    idempotencyKey: "idem-reassign-expired-backend",
    requestHash: "hash-reassign-expired-backend",
    correlationId: "corr-reassign-expired-backend",
    causationId: "claim-runtime-stale",
    traceId: "trace-reassign-expired-backend",
  });
  equal(created.outcome, "created");
  if (created.outcome !== "created") throw new Error("expected corrective command");
  equal(created.command.type, CommandType.SendSupervisorSignal);
  equal(created.command.policyContext.toolType, SupervisorSignalToolType.RequestResource);
  ok(created.command.message.includes("binding-backend-expired"));
  ok(created.command.message.includes("backend_implementer"));

  const store = createInMemoryOrganizationStoreFactory<CommandResult>();
  const pipeline = createCommandPipeline({
    stateStoreFactory: store,
    commandAuthorizationPort: allowingAuthorization(),
    policyDecisionObservationPort: recordingPolicyDecisionObservation(),
    handlerRegistry: createCommandHandlerRegistry([createSendSupervisorSignalHandler()]),
    workAnchorStateReader: workAnchorReader(created.command),
    now: () => NOW,
    createId: (prefix) => `${prefix}-reassign-expired`,
  });

  const result = await pipeline.execute(created.command);

  equal(result.status, CommandResultStatus.Accepted);
  equal(store.snapshot.supervisorSignals.length, 1);
  equal(store.snapshot.supervisorSignals[0]?.title, "Reassign expired backend_implementer capacity");
  equal(store.snapshot.supervisorSignals[0]?.relatedWorkItemId, "work-runtime-capacity");
  equal(store.snapshot.supervisorSignals[0]?.targetHatAssignmentId, "hat-assignment-rmo-1");
  equal(store.snapshot.outboxEvents[0]?.envelope.eventType, "supervisor_signal.sent");
});

test("reassign_after_expiry command creation rejects non-expired or mismatched corrective actions", () => {
  const base = {
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-capacity",
    actor: { agentId: "agent-manager-1", hatAssignmentId: "hat-assignment-manager-1" },
    targetHatAssignmentId: "hat-assignment-rmo-1",
    sourceLevel: SupervisorChainLevel.Manager,
    targetLevel: SupervisorChainLevel.Director,
    commandId: "cmd-reassign-expired-backend",
    idempotencyKey: "idem-reassign-expired-backend",
    requestHash: "hash-reassign-expired-backend",
    correlationId: "corr-reassign-expired-backend",
    causationId: "claim-runtime-stale",
    traceId: "trace-reassign-expired-backend",
  } as const;

  const nonExpired = createReassignAfterExpirySupervisorSignalCommand({
    ...base,
    correctiveAction: action(ScheduleCorrectiveActionKind.ReassignAfterExpiry, "backend_implementer"),
    expiredBinding: { ...expiredBinding(), phase: HatBindingPhase.Active },
  });
  const mismatchedHat = createReassignAfterExpirySupervisorSignalCommand({
    ...base,
    correctiveAction: action(ScheduleCorrectiveActionKind.ReassignAfterExpiry, "qa_verifier"),
    expiredBinding: expiredBinding(),
  });
  const wrongAction = createReassignAfterExpirySupervisorSignalCommand({
    ...base,
    correctiveAction: action(ScheduleCorrectiveActionKind.RequestRmoExpand, "backend_implementer"),
    expiredBinding: expiredBinding(),
  });
  const wrongOrganization = createReassignAfterExpirySupervisorSignalCommand({
    ...base,
    correctiveAction: action(ScheduleCorrectiveActionKind.ReassignAfterExpiry, "backend_implementer"),
    expiredBinding: { ...expiredBinding(), organizationId: "org-other" },
  });

  deepEqual(nonExpired, { outcome: "rejected", reason: "binding_not_expired" });
  deepEqual(mismatchedHat, { outcome: "rejected", reason: "hat_mismatch" });
  deepEqual(wrongAction, { outcome: "rejected", reason: "unsupported_corrective_action" });
  deepEqual(wrongOrganization, { outcome: "rejected", reason: "organization_mismatch" });
});

function expiredBinding(): HatBinding {
  return {
    id: "binding-backend-expired",
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    wearerAgentId: "agent-backend-1",
    phase: HatBindingPhase.Expired,
    boundAt: "2026-05-31T18:00:00.000Z",
    warmupEndsAt: "2026-05-31T18:05:00.000Z",
    expiresAt: "2026-05-31T20:00:00.000Z",
    activatedAt: "2026-05-31T18:05:00.000Z",
    endedAt: "2026-05-31T20:00:00.000Z",
    cooldownUntil: "2026-05-31T20:30:00.000Z",
  };
}

function action(kind: ScheduleCorrectiveActionKind, hatId: string) {
  return {
    actionId: `schedule.${kind}.${hatId}`,
    kind,
    hatId,
    label: kind,
    rationale: "test action",
  };
}

function workAnchorReader(command: {
  organizationId: string;
  projectId: string;
  actor: { agentId: string; hatAssignmentId: string };
  correlationId: string;
  causationId: string;
  traceId: string;
  policyContext: { scope: { workItemId: string } };
}): WorkAnchorStateReaderPort {
  const workItem: CommandWorkAnchorWorkItem = {
    workItemId: command.policyContext.scope.workItemId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    workItemType: WorkItemType.Task,
    title: "Runtime capacity reassignment anchor",
    description: "Anchor proving the corrective signal is scoped to real work.",
    state: WorkItemState.Ready,
    createdAt: NOW,
    createdBy: command.actor,
    metadata: {
      updatedAt: NOW,
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
  return {
    findProject: async () => undefined,
    findInitiative: async () => undefined,
    findWorkItem: async (workItemId: string) => workItemId === workItem.workItemId ? workItem : undefined,
  };
}

function allowingAuthorization(): CommandAuthorizationPort {
  return {
    authorizeCommand: async () => ({
      status: PolicyDecisionStatus.Allowed,
      decisionId: "policy-allow",
      policyVersion: "policy-v1",
    }),
  };
}

function recordingPolicyDecisionObservation(): PolicyDecisionObservationPort {
  return {
    observePolicyDecision: async () => ({ status: PolicyDecisionObservationPersistenceStatus.Recorded }),
  };
}
