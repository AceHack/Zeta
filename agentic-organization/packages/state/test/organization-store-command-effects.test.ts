import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandOutcomeEffectConflictReason,
  CommandOutcomePersistenceStatus,
  CommandResultArtifactType,
  CommandResultStatus,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  type RecordCommandOutcomeInput,
} from "../../application/src/index.ts";
import {
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  BusinessRuleEvaluationStatus,
  QualityGateKind,
  QualityGateOutcome,
  ScheduleBlockState,
  ScheduleBlockType,
  type DecisionRecord,
  type DiscussionAnchor,
  type ContextPackInboxAnchor,
  type ContextPackInboxAnchorStatusTransition,
  type QualityGateEvaluation,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import { createInMemoryOrganizationStoreFactory } from "../src/index.ts";

describe("in-memory organization command effects", () => {
  test("records discussion anchor effects transactionally with idempotency", async () => {
    const factory = createInMemoryOrganizationStoreFactory();
    const store = factory.createCommandStateStore();
    const outcome = createDiscussionAnchorCommandOutcome();

    const result = await store.recordCommandOutcome(outcome);

    equal(result.status, CommandOutcomePersistenceStatus.Committed);
    deepEqual(factory.snapshot.discussionAnchors, outcome.effects.discussionAnchors);
    deepEqual(factory.snapshot.decisionRecords, outcome.effects.decisionRecords);
    deepEqual(factory.snapshot.qualityGateEvaluations, outcome.effects.qualityGateEvaluations);
    deepEqual(factory.snapshot.workScheduleBlocks, outcome.effects.workScheduleBlocks);

    const replay = await store.recordCommandOutcome(outcome);

    equal(replay.status, CommandOutcomePersistenceStatus.Replayed);
    equal(factory.snapshot.discussionAnchors.length, 1);
    equal(factory.snapshot.decisionRecords.length, 1);
    equal(factory.snapshot.qualityGateEvaluations.length, 1);
    equal(factory.snapshot.workScheduleBlocks.length, 1);
  });

  test("records context-pack inbox anchor effects transactionally with idempotency", async () => {
    const factory = createInMemoryOrganizationStoreFactory();
    const store = factory.createCommandStateStore();
    const outcome = createContextPackInboxAnchorCommandOutcome();

    const result = await store.recordCommandOutcome(outcome);

    equal(result.status, CommandOutcomePersistenceStatus.Committed);
    deepEqual(factory.snapshot.contextPackInboxAnchors, outcome.effects.contextPackInboxAnchors);

    const replay = await store.recordCommandOutcome(outcome);

    equal(replay.status, CommandOutcomePersistenceStatus.Replayed);
    equal(factory.snapshot.contextPackInboxAnchors.length, 1);
  });

  test("applies context-pack inbox anchor status transitions without rewriting the anchor body", async () => {
    const factory = createInMemoryOrganizationStoreFactory();
    const store = factory.createCommandStateStore();
    const createOutcome = createContextPackInboxAnchorCommandOutcome();
    const statusTransitionOutcome = createContextPackInboxAnchorStatusTransitionOutcome();

    await store.recordCommandOutcome(createOutcome);
    const result = await store.recordCommandOutcome(statusTransitionOutcome);

    equal(result.status, CommandOutcomePersistenceStatus.Committed);
    deepEqual(factory.snapshot.contextPackInboxAnchors, [{
      ...createOutcome.effects.contextPackInboxAnchors![0]!,
      status: ContextPackInboxAnchorStatus.Dismissed,
    }]);
  });

  test("rejects context-pack inbox anchor status transitions for missing anchors without mutating state", async () => {
    const factory = createInMemoryOrganizationStoreFactory();
    const store = factory.createCommandStateStore();
    const result = await store.recordCommandOutcome(createContextPackInboxAnchorStatusTransitionOutcome());

    equal(result.status, CommandOutcomePersistenceStatus.EffectConflict);
    if (result.status !== CommandOutcomePersistenceStatus.EffectConflict) {
      throw new Error("expected effect conflict");
    }
    equal(result.reason, CommandOutcomeEffectConflictReason.ContextPackInboxAnchorMissing);
    equal(factory.snapshot.contextPackInboxAnchors.length, 0);
    equal(factory.snapshot.idempotencyRecords.size, 0);
  });

  test("rejects unsupported V0 discussion anchor effect types without mutating state", async () => {
    const factory = createInMemoryOrganizationStoreFactory();
    const store = factory.createCommandStateStore();
    const outcome = createDiscussionAnchorCommandOutcome();

    const result = await store.recordCommandOutcome({
      ...outcome,
      effects: {
        ...outcome.effects,
        discussionAnchors: [
          {
            ...outcome.effects.discussionAnchors[0]!,
            discussionAnchorType: DiscussionAnchorType.Project,
          },
        ],
      },
    });

    equal(result.status, CommandOutcomePersistenceStatus.EffectConflict);
    if (result.status !== CommandOutcomePersistenceStatus.EffectConflict) {
      throw new Error("expected effect conflict");
    }
    equal(result.reason, CommandOutcomeEffectConflictReason.UnsupportedDiscussionAnchorEffectType);
    equal(factory.snapshot.discussionAnchors.length, 0);
    equal(factory.snapshot.idempotencyRecords.size, 0);
  });

  test("rejects overlapping scheduled work blocks for the same hat assignment without mutating state", async () => {
    const factory = createInMemoryOrganizationStoreFactory();
    const store = factory.createCommandStateStore();
    const outcome = createDiscussionAnchorCommandOutcome();

    await store.recordCommandOutcome(outcome);

    const result = await store.recordCommandOutcome({
      idempotencyRecord: {
        idempotencyKey: "idem-overlap-001",
        requestHash: "hash-overlap-001",
        result: {
          status: CommandResultStatus.Accepted,
          idempotency: {
            replayed: false,
          },
        },
      },
      effects: {
        ...outcome.effects,
        supervisorSignals: [],
        discussionAnchors: [],
        decisionRecords: [],
        workScheduleBlocks: [
          {
            ...outcome.effects.workScheduleBlocks[0]!,
            workScheduleBlockId: "work-schedule-block-overlap-001",
            startsAt: "2026-05-28T22:30:00.000Z",
            endsAt: "2026-05-28T23:30:00.000Z",
          },
        ],
        auditEvents: [],
        outboxEvents: [],
      },
    });

    equal(result.status, CommandOutcomePersistenceStatus.EffectConflict);
    if (result.status !== CommandOutcomePersistenceStatus.EffectConflict) {
      throw new Error("expected effect conflict");
    }
    equal(result.reason, CommandOutcomeEffectConflictReason.WorkScheduleBlockOverlap);
    equal(factory.snapshot.workScheduleBlocks.length, 1);
    equal(factory.snapshot.idempotencyRecords.size, 1);
  });
});

function createDiscussionAnchorCommandOutcome(): RecordCommandOutcomeInput {
  const discussionAnchor: DiscussionAnchor = {
    discussionAnchorId: "discussion-anchor-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    discussionAnchorType: DiscussionAnchorType.WorkItem,
    title: "Review gate coordination",
    purpose: "Clarify evidence needed before moving the work item into review.",
    expectedOutputs: [DiscussionExpectedOutput.Decision],
    createdAt: "2026-05-28T22:00:00.000Z",
    createdBy: {
      agentId: "agent-em-001",
      hatAssignmentId: "hat-assignment-em-001",
    },
    metadata: {
      updatedAt: "2026-05-28T22:00:00.000Z",
      version: 1,
      correlationId: "corr-001",
      causationId: "cause-001",
      traceId: "trace-001",
    },
  };
  const decisionRecord: DecisionRecord = {
    decisionRecordId: "decision-record-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    discussionAnchorId: discussionAnchor.discussionAnchorId,
    title: "Review gate decision",
    decision: "Proceed when evidence is attached.",
    rationale: "The implementation is deterministic and anchored.",
    alternativesConsidered: [],
    followUpWorkItemIds: [],
    decidedAt: "2026-05-28T22:05:00.000Z",
    decidedBy: {
      agentId: "agent-em-001",
      hatAssignmentId: "hat-assignment-em-001",
    },
    metadata: {
      updatedAt: "2026-05-28T22:05:00.000Z",
      version: 1,
      correlationId: "corr-001",
      causationId: "cause-001",
      traceId: "trace-001",
    },
  };
  const workScheduleBlock: WorkScheduleBlock = {
    workScheduleBlockId: "work-schedule-block-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    discussionAnchorId: discussionAnchor.discussionAnchorId,
    assignedAgentId: "agent-dev-001",
    assignedHatAssignmentId: "hat-assignment-dev-001",
    blockType: ScheduleBlockType.PrioritizedWork,
    state: ScheduleBlockState.Scheduled,
    title: "Focused implementation block",
    purpose: "Allocate focused implementation time.",
    startsAt: "2026-05-28T22:10:00.000Z",
    endsAt: "2026-05-28T23:00:00.000Z",
    scheduledAt: "2026-05-28T22:05:00.000Z",
    scheduledBy: {
      agentId: "agent-em-001",
      hatAssignmentId: "hat-assignment-em-001",
    },
    metadata: {
      updatedAt: "2026-05-28T22:05:00.000Z",
      version: 1,
      correlationId: "corr-001",
      causationId: "cause-001",
      traceId: "trace-001",
    },
  };
  const qualityGateEvaluation: QualityGateEvaluation = {
    qualityGateEvaluationId: "quality-gate-evaluation-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    discussionAnchorId: discussionAnchor.discussionAnchorId,
    gateKind: QualityGateKind.FinalBusinessValidation,
    outcome: QualityGateOutcome.Approved,
    summary: "Business rules are satisfied for release.",
    evaluatedArtifactIds: ["brd-001", "qa-report-001"],
    businessRuleResults: [
      {
        ruleId: "BRD-001",
        status: BusinessRuleEvaluationStatus.Satisfied,
        evidenceArtifactIds: ["qa-report-001"],
        notes: "Validated against the business rule.",
      },
    ],
    evaluatedAt: "2026-05-28T22:06:00.000Z",
    evaluatedBy: {
      agentId: "agent-em-001",
      hatAssignmentId: "hat-assignment-em-001",
    },
    metadata: {
      updatedAt: "2026-05-28T22:06:00.000Z",
      version: 1,
      correlationId: "corr-001",
      causationId: "cause-001",
      traceId: "trace-001",
    },
  };

  return {
    idempotencyRecord: {
      idempotencyKey: "idem-001",
      requestHash: "hash-001",
      result: {
        status: CommandResultStatus.Accepted,
        artifacts: [
          {
            artifactType: CommandResultArtifactType.DiscussionAnchor,
            artifactId: discussionAnchor.discussionAnchorId,
          },
        ],
        idempotency: {
          replayed: false,
        },
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [discussionAnchor],
      decisionRecords: [decisionRecord],
      qualityGateEvaluations: [qualityGateEvaluation],
      workScheduleBlocks: [workScheduleBlock],
      auditEvents: [],
      outboxEvents: [],
      workAnchors: {
        projects: [],
        initiatives: [],
        workItems: [],
        workAnchorTargets: [],
        workItemTransitions: [],
      },
    },
  };
}

function createContextPackInboxAnchorCommandOutcome(): RecordCommandOutcomeInput {
  const inboxAnchor: ContextPackInboxAnchor = {
    inboxAnchorId: "context-pack-inbox-anchor-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    targetHatAssignmentId: "hat-assignment-director-001",
    title: "Director context pack is stale",
    summary: "Wake the director hat because the blocker briefing needs refreshed context.",
    priority: ContextPackInboxAnchorPriority.Urgent,
    status: ContextPackInboxAnchorStatus.Unread,
    deliveredAt: "2026-06-03T14:00:00.000Z",
    traceId: "trace-001",
  };

  return {
    idempotencyRecord: {
      idempotencyKey: "idem-inbox-anchor-001",
      requestHash: "hash-inbox-anchor-001",
      result: {
        status: CommandResultStatus.Accepted,
        artifacts: [{
          artifactType: CommandResultArtifactType.ContextPackInboxAnchor,
          artifactId: inboxAnchor.inboxAnchorId,
        }],
        idempotency: {
          replayed: false,
        },
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      contextPackInboxAnchors: [inboxAnchor],
      auditEvents: [],
      outboxEvents: [],
      workAnchors: {
        projects: [],
        initiatives: [],
        workItems: [],
        workAnchorTargets: [],
        workItemTransitions: [],
      },
    },
  };
}

function createContextPackInboxAnchorStatusTransitionOutcome(): RecordCommandOutcomeInput {
  const statusTransition: ContextPackInboxAnchorStatusTransition = {
    inboxAnchorId: "context-pack-inbox-anchor-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    targetHatAssignmentId: "hat-assignment-director-001",
    status: ContextPackInboxAnchorStatus.Dismissed,
    changedAt: "2026-06-03T16:00:00.000Z",
    traceId: "trace-001",
  };

  return {
    idempotencyRecord: {
      idempotencyKey: "idem-inbox-anchor-status-001",
      requestHash: "hash-inbox-anchor-status-001",
      result: {
        status: CommandResultStatus.Accepted,
        artifacts: [{
          artifactType: CommandResultArtifactType.ContextPackInboxAnchor,
          artifactId: statusTransition.inboxAnchorId,
        }],
        idempotency: {
          replayed: false,
        },
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      contextPackInboxAnchorStatusTransitions: [statusTransition],
      auditEvents: [],
      outboxEvents: [],
      workAnchors: {
        projects: [],
        initiatives: [],
        workItems: [],
        workAnchorTargets: [],
        workItemTransitions: [],
      },
    },
  };
}
