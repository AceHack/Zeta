import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandOutcomeEffectConflictReason,
  CommandOutcomePersistenceStatus,
  CommandResultArtifactType,
  CommandResultStatus,
  type RecordCommandOutcomeInput,
} from "../../application/src/index.ts";
import {
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  ScheduleBlockState,
  ScheduleBlockType,
  type DecisionRecord,
  type DiscussionAnchor,
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
    deepEqual(factory.snapshot.workScheduleBlocks, outcome.effects.workScheduleBlocks);

    const replay = await store.recordCommandOutcome(outcome);

    equal(replay.status, CommandOutcomePersistenceStatus.Replayed);
    equal(factory.snapshot.discussionAnchors.length, 1);
    equal(factory.snapshot.decisionRecords.length, 1);
    equal(factory.snapshot.workScheduleBlocks.length, 1);
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
