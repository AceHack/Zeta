import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  CommandType,
  ProjectStatus,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
  SupervisorTriageActionType,
  WorkItemState,
  WorkItemType,
  type AgenticActor,
  type SupervisorSignal,
} from "../../domain/src/index.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
} from "../src/command-result.ts";
import {
  SupervisorSignalTriageValidationErrorMessage,
  triageSupervisorSignal,
  type TriageSupervisorSignalCommand,
} from "../src/handlers/triage-supervisor-signal.ts";
import type { WorkAnchorStateReaderPort } from "../src/ports.ts";

const actor: AgenticActor = {
  agentId: "agent-manager-001",
  hatAssignmentId: "hat-manager-001",
};

const command: TriageSupervisorSignalCommand = {
  commandId: "cmd-triage-001",
  type: CommandType.TriageSupervisorSignal,
  idempotencyKey: "idem-triage-001",
  requestHash: "hash-triage-001",
  correlationId: "corr-triage-001",
  causationId: "supervisor-signal-001",
  traceId: "trace-triage-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  teamId: "team-runtime",
  workItemId: "work-runtime-001",
  actor,
  supervisorSignalId: "supervisor-signal-001",
  actionType: SupervisorTriageActionType.OpenWorkItem,
  followUpWorkItemType: WorkItemType.Task,
  followUpTitle: "Add durable runtime telemetry dashboard",
  followUpDescription: "The team needs a visible dashboard for reaction executor retry and lease health.",
};

describe("triage supervisor signal handler", () => {
  test("turns a supervisor signal into a follow-up work item through command effects", async () => {
    const outcome = await triageSupervisorSignal(command, {
      now: () => "2026-05-29T14:45:00.000Z",
      createId: createDeterministicId,
      supervisorSignalStateReader: createSupervisorSignalStateReader(createSupervisorSignal()),
      workAnchorStateReader: createWorkAnchorStateReader(),
    });

    equal(outcome.result.status, CommandResultStatus.Accepted);
    deepEqual(outcome.result.artifacts, [
      {
        artifactType: CommandResultArtifactType.WorkItem,
        artifactId: "work-item-001",
        label: "Add durable runtime telemetry dashboard",
      },
    ]);
    deepEqual(outcome.effects.workAnchors?.workItems, [
      {
        workItemId: "work-item-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        workItemType: WorkItemType.Task,
        title: "Add durable runtime telemetry dashboard",
        description: "The team needs a visible dashboard for reaction executor retry and lease health.",
        state: WorkItemState.Created,
        createdAt: "2026-05-29T14:45:00.000Z",
        createdBy: actor,
        metadata: {
          updatedAt: "2026-05-29T14:45:00.000Z",
          version: 1,
          correlationId: "corr-triage-001",
          causationId: "supervisor-signal-001",
          traceId: "trace-triage-001",
        },
      },
    ]);
    deepEqual(outcome.effects.outboxEvents.map((event) => event.envelope), [
      {
        eventId: "evt-001",
        eventType: AgenticEventType.WorkItemChanged,
        schemaVersion: "agentic.org.event.v1",
        occurredAt: "2026-05-29T14:45:00.000Z",
        actor,
        scope: {
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          workItemId: "work-item-001",
        },
        aggregate: {
          aggregateId: "work-item-001",
          aggregateType: AgenticAggregateType.WorkItem,
          aggregateVersion: 1,
        },
        trace: {
          commandId: "cmd-triage-001",
          correlationId: "corr-triage-001",
          causationId: "supervisor-signal-001",
          traceId: "trace-triage-001",
          idempotencyKey: "idem-triage-001",
        },
        replay: {
          isReplay: false,
        },
        payload: {
          state: WorkItemState.Created,
          title: "Add durable runtime telemetry dashboard",
          workItemType: WorkItemType.Task,
          triagedSupervisorSignalId: "supervisor-signal-001",
          triageActionType: SupervisorTriageActionType.OpenWorkItem,
        },
      },
    ]);
  });

  test("rejects triage when the supervisor signal cannot be found", async () => {
    const outcome = await triageSupervisorSignal(command, {
      now: () => "2026-05-29T14:45:00.000Z",
      createId: createDeterministicId,
      supervisorSignalStateReader: createSupervisorSignalStateReader(undefined),
      workAnchorStateReader: createWorkAnchorStateReader(),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, SupervisorSignalTriageValidationErrorMessage.MissingSupervisorSignal);
    deepEqual(outcome.effects.workAnchors?.workItems, []);
  });

  test("rejects triage by a hat other than the signal target supervisor", async () => {
    const outcome = await triageSupervisorSignal(
      {
        ...command,
        actor: {
          agentId: "agent-other-manager",
          hatAssignmentId: "hat-other-manager",
        },
      },
      {
        now: () => "2026-05-29T14:45:00.000Z",
        createId: createDeterministicId,
        supervisorSignalStateReader: createSupervisorSignalStateReader(createSupervisorSignal()),
        workAnchorStateReader: createWorkAnchorStateReader(),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, SupervisorSignalTriageValidationErrorMessage.TargetSupervisorRequired);
  });

  test("rejects triage when the command scope does not match the signal work item", async () => {
    const outcome = await triageSupervisorSignal(
      {
        ...command,
        workItemId: "work-other-001",
      },
      {
        now: () => "2026-05-29T14:45:00.000Z",
        createId: createDeterministicId,
        supervisorSignalStateReader: createSupervisorSignalStateReader(createSupervisorSignal()),
        workAnchorStateReader: createWorkAnchorStateReader(),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, SupervisorSignalTriageValidationErrorMessage.SignalScopeMismatch);
  });
});

function createDeterministicId(prefix: string): string {
  if (prefix === "work-item") {
    return "work-item-001";
  }

  if (prefix === "audit") {
    return "audit-001";
  }

  if (prefix === "outbox") {
    return "outbox-001";
  }

  if (prefix === "evt") {
    return "evt-001";
  }

  return `${prefix}-001`;
}

function createSupervisorSignalStateReader(signal: SupervisorSignal | undefined) {
  return {
    findSupervisorSignal: async () => signal,
  };
}

function createWorkAnchorStateReader(): WorkAnchorStateReaderPort {
  return {
    findProject: async () => ({
      projectId: "project-agentic-org",
      organizationId: "org-lfg",
      name: "Agentic Organization",
      status: ProjectStatus.Active,
      createdAt: "2026-05-29T13:00:00.000Z",
      createdBy: actor,
      metadata: {
        updatedAt: "2026-05-29T13:00:00.000Z",
        version: 1,
        correlationId: "project-corr-001",
        causationId: "project-cause-001",
        traceId: "project-trace-001",
      },
    }),
    findInitiative: async () => undefined,
    findWorkItem: async () => undefined,
  };
}

function createSupervisorSignal(): SupervisorSignal {
  return {
    supervisorSignalId: "supervisor-signal-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    sourceLevel: SupervisorChainLevel.TeamMember,
    targetLevel: SupervisorChainLevel.Manager,
    targetHatAssignmentId: actor.hatAssignmentId,
    sender: {
      agentId: "agent-implementer-001",
      hatAssignmentId: "hat-implementer-001",
    },
    toolType: SupervisorSignalToolType.ReportBlocker,
    status: SupervisorSignalStatus.Sent,
    title: "Need telemetry visibility",
    message: "The team cannot tell which reactions are retrying.",
    relatedWorkItemId: "work-runtime-001",
    createdAt: "2026-05-29T14:15:00.000Z",
  };
}
