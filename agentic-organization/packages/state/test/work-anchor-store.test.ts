import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  InitiativeStatus,
  ProjectStatus,
  WorkItemState,
  WorkItemType,
  type AgenticActor,
  type WorkItem,
  type WorkStateTransition,
} from "../../domain/src/index.ts";
import {
  WorkAnchorConflictReason,
  WorkAnchorPersistenceStatus,
  createInMemoryWorkAnchorStateStore,
  type CreateWorkAnchorInput,
  type PersistedInitiative,
  type PersistedProject,
  type PersistedWorkAnchorTarget,
  type PersistedWorkItem,
  type PersistedWorkStateTransition,
} from "../src/index.ts";

const Actor: AgenticActor = {
  agentId: "agent-work-anchor-test",
  hatAssignmentId: "hat-work-anchor-test",
};
const MutatedTitle = "mutated outside the state port";
const SnapshotMutatedTitle = "mutated through snapshot";

describe("in-memory work anchor state store", () => {
  test("persists projects, initiatives, work items, anchors, and state transitions behind one generic port", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const project = createProjectRecord();
    const initiative = createInitiativeRecord();
    const workItem = createWorkItemRecord();
    const anchorTarget = createWorkAnchorTargetRecord();
    const transition = createWorkStateTransition({
      sequence: 1,
    });

    equal((await store.createProject(project)).status, WorkAnchorPersistenceStatus.Committed);
    equal((await store.createInitiative(initiative)).status, WorkAnchorPersistenceStatus.Committed);
    equal((await store.createWorkItem(workItem)).status, WorkAnchorPersistenceStatus.Committed);
    equal((await store.createWorkAnchorTarget(anchorTarget)).status, WorkAnchorPersistenceStatus.Committed);
    equal(
      (
        await store.transitionWorkItem({
          expectedVersion: workItem.metadata.version,
          nextWorkItem: {
            ...workItem,
            state: WorkItemState.Intake,
            metadata: {
              ...workItem.metadata,
              version: 2,
            },
          },
          transition,
        })
      ).status,
      WorkAnchorPersistenceStatus.Committed,
    );

    deepEqual(await store.findProject(project.projectId), project);
    deepEqual(await store.findInitiative(initiative.initiativeId), initiative);
    deepEqual(await store.findWorkItem(workItem.workItemId), {
      ...workItem,
      state: WorkItemState.Intake,
      metadata: {
        ...workItem.metadata,
        version: 2,
      },
    });
    deepEqual(await store.findWorkAnchorTarget(anchorTarget.workAnchorTargetId), anchorTarget);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), [transition]);
  });

  test("reports duplicate records without mutating existing anchor state", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const workItem = createWorkItemRecord();
    const replacementWorkItem: PersistedWorkItem = {
      ...workItem,
      title: "replacement title",
    };

    equal((await store.createWorkItem(workItem)).status, WorkAnchorPersistenceStatus.Committed);
    equal((await store.createWorkItem(replacementWorkItem)).status, WorkAnchorPersistenceStatus.Conflict);

    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
  });

  test("isolates stored records from caller and snapshot object mutation", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const workItem = createWorkItemRecord();
    const expectedWorkItem = structuredClone(workItem);

    equal((await store.createWorkItem(workItem)).status, WorkAnchorPersistenceStatus.Committed);

    workItem.title = MutatedTitle;
    workItem.metadata.version = 99;
    const firstRead = await store.findWorkItem(expectedWorkItem.workItemId);
    ok(firstRead !== undefined);
    firstRead.title = MutatedTitle;
    firstRead.metadata.version = 100;

    const snapshotRecord = store.snapshot.workItems.get(expectedWorkItem.workItemId);
    ok(snapshotRecord !== undefined);
    snapshotRecord.title = SnapshotMutatedTitle;
    snapshotRecord.metadata.version = 101;

    deepEqual(await store.findWorkItem(expectedWorkItem.workItemId), expectedWorkItem);
  });

  test("atomically rejects stale or duplicate work item transitions", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const workItem = createWorkItemRecord();
    const transition = createWorkStateTransition({
      sequence: 1,
    });
    await store.createWorkItem(workItem);

    const staleResult = await store.transitionWorkItem({
      expectedVersion: 99,
      nextWorkItem: createNextWorkItem(workItem),
      transition,
    });

    equal(staleResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(staleResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(staleResult.reason, WorkAnchorConflictReason.VersionMismatch);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);

    const committedResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(workItem),
      transition,
    });
    equal(committedResult.status, WorkAnchorPersistenceStatus.Committed);

    const duplicateSequenceResult = await store.transitionWorkItem({
      expectedVersion: 2,
      nextWorkItem: {
        ...createNextWorkItem(workItem),
        state: WorkItemState.Triage,
        metadata: {
          ...workItem.metadata,
          version: 3,
        },
      },
      transition: {
        ...transition,
        workStateTransitionId: "transition-duplicate-sequence",
        fromState: WorkItemState.Intake,
        toState: WorkItemState.Triage,
      },
    });

    equal(duplicateSequenceResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(duplicateSequenceResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(duplicateSequenceResult.reason, WorkAnchorConflictReason.DuplicateTransitionSequence);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), [transition]);

    const duplicateTransitionIdResult = await store.transitionWorkItem({
      expectedVersion: 2,
      nextWorkItem: {
        ...createNextWorkItem(workItem),
        state: WorkItemState.Triage,
        metadata: {
          ...workItem.metadata,
          version: 3,
        },
      },
      transition: {
        ...transition,
        sequence: 2,
        fromState: WorkItemState.Intake,
        toState: WorkItemState.Triage,
      },
    });

    equal(duplicateTransitionIdResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(duplicateTransitionIdResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(duplicateTransitionIdResult.reason, WorkAnchorConflictReason.DuplicateTransitionId);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), [transition]);
  });

  test("rejects invalid transition identity and sequence before mutating work item state", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const workItem = createWorkItemRecord();
    await store.createWorkItem(workItem);

    const mismatchedResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(workItem),
      transition: createWorkStateTransition({
        workItemId: "other-work-item",
      }),
    });

    equal(mismatchedResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(mismatchedResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(mismatchedResult.reason, WorkAnchorConflictReason.WorkItemMismatch);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);

    const invalidSequenceResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(workItem),
      transition: createWorkStateTransition({
        sequence: 0,
      }),
    });

    equal(invalidSequenceResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(invalidSequenceResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(invalidSequenceResult.reason, WorkAnchorConflictReason.InvalidTransitionSequence);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);
  });

  test("rejects inconsistent transition scope before mutating state", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const workItem = createWorkItemRecord();
    await store.createWorkItem(workItem);

    const mismatchedNextScopeResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: {
        ...createNextWorkItem(workItem),
        projectId: "other-project",
      },
      transition: createWorkStateTransition(),
    });

    equal(mismatchedNextScopeResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(mismatchedNextScopeResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(mismatchedNextScopeResult.reason, WorkAnchorConflictReason.WorkItemScopeMismatch);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);

    const mismatchedTransitionScopeResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(workItem),
      transition: createWorkStateTransition({
        organizationId: "other-organization",
      }),
    });

    equal(mismatchedTransitionScopeResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(mismatchedTransitionScopeResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(mismatchedTransitionScopeResult.reason, WorkAnchorConflictReason.WorkItemScopeMismatch);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);
  });

  test("rejects non-advancing versions and contradictory state history before mutating", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const workItem = createWorkItemRecord();
    await store.createWorkItem(workItem);

    const nonAdvancingVersionResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: {
        ...createNextWorkItem(workItem),
        metadata: {
          ...workItem.metadata,
          version: 1,
        },
      },
      transition: createWorkStateTransition(),
    });

    equal(nonAdvancingVersionResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(nonAdvancingVersionResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(nonAdvancingVersionResult.reason, WorkAnchorConflictReason.InvalidNextVersion);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);

    const contradictoryFromStateResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(workItem),
      transition: createWorkStateTransition({
        fromState: WorkItemState.Intake,
        toState: WorkItemState.Triage,
      }),
    });

    equal(contradictoryFromStateResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(contradictoryFromStateResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(contradictoryFromStateResult.reason, WorkAnchorConflictReason.StateTransitionMismatch);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);

    const contradictoryToStateResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(workItem),
      transition: createWorkStateTransition({
        toState: WorkItemState.Triage,
      }),
    });

    equal(contradictoryToStateResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(contradictoryToStateResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(contradictoryToStateResult.reason, WorkAnchorConflictReason.StateTransitionMismatch);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);

    const illegalTransitionResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: {
        ...createNextWorkItem(workItem),
        state: WorkItemState.Ready,
      },
      transition: createWorkStateTransition({
        toState: WorkItemState.Ready,
      }),
    });

    equal(illegalTransitionResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(illegalTransitionResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(illegalTransitionResult.reason, WorkAnchorConflictReason.IllegalWorkItemTransition);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.listWorkStateTransitions(workItem.workItemId), []);
  });

  test("uses supplied lifecycle evidence for defect readiness transitions", async () => {
    const store = createInMemoryWorkAnchorStateStore();
    const triagedDefect = createWorkItemRecord({
      state: WorkItemState.Triage,
      workItemType: WorkItemType.Defect,
    });
    await store.createWorkItem(triagedDefect);

    const missingTriageFieldsResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: {
        ...triagedDefect,
        state: WorkItemState.Ready,
        metadata: {
          ...triagedDefect.metadata,
          version: 2,
        },
      },
      transition: createWorkStateTransition({
        fromState: WorkItemState.Triage,
        toState: WorkItemState.Ready,
      }),
    });

    equal(missingTriageFieldsResult.status, WorkAnchorPersistenceStatus.Conflict);
    ok(missingTriageFieldsResult.status === WorkAnchorPersistenceStatus.Conflict);
    equal(missingTriageFieldsResult.reason, WorkAnchorConflictReason.IllegalWorkItemTransition);
    deepEqual(await store.findWorkItem(triagedDefect.workItemId), triagedDefect);
    deepEqual(await store.listWorkStateTransitions(triagedDefect.workItemId), []);

    const readyTransition = createWorkStateTransition({
      fromState: WorkItemState.Triage,
      toState: WorkItemState.Ready,
    });
    const committedResult = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: {
        ...triagedDefect,
        state: WorkItemState.Ready,
        metadata: {
          ...triagedDefect.metadata,
          version: 2,
        },
      },
      transition: readyTransition,
      transitionContext: {
        hasTriageFields: true,
      },
    });

    equal(committedResult.status, WorkAnchorPersistenceStatus.Committed);
    deepEqual(await store.listWorkStateTransitions(triagedDefect.workItemId), [readyTransition]);
  });
});

function createProjectRecord(): PersistedProject {
  return {
    projectId: "project-work-anchor-test",
    organizationId: "org-work-anchor-test",
    name: "Work Anchor Test Project",
    status: ProjectStatus.Active,
    createdAt: "2026-05-28T20:00:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
  };
}

function createInitiativeRecord(): PersistedInitiative {
  return {
    initiativeId: "initiative-work-anchor-test",
    organizationId: "org-work-anchor-test",
    projectId: "project-work-anchor-test",
    title: "Work Anchor Test Initiative",
    status: InitiativeStatus.Active,
    createdAt: "2026-05-28T20:01:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
  };
}

function createWorkItemRecord(input: Partial<WorkItem> = {}): PersistedWorkItem {
  return {
    workItemId: "work-item-work-anchor-test",
    organizationId: "org-work-anchor-test",
    projectId: "project-work-anchor-test",
    initiativeId: "initiative-work-anchor-test",
    workItemType: WorkItemType.Task,
    title: "Work Anchor Test Item",
    description: "A work item used by the state port test.",
    state: WorkItemState.Created,
    createdAt: "2026-05-28T20:02:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
    ...input,
  };
}

function createWorkAnchorTargetRecord(): PersistedWorkAnchorTarget {
  return {
    workAnchorTargetId: "anchor-work-anchor-test",
    organizationId: "org-work-anchor-test",
    projectId: "project-work-anchor-test",
    initiativeId: "initiative-work-anchor-test",
    workItemId: "work-item-work-anchor-test",
    createdAt: "2026-05-28T20:03:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
  };
}

function createWorkStateTransition(
  input: Partial<WorkStateTransition & { sequence: number }> = {},
): PersistedWorkStateTransition {
  return {
    workStateTransitionId: "transition-work-anchor-test",
    organizationId: "org-work-anchor-test",
    projectId: "project-work-anchor-test",
    workItemId: "work-item-work-anchor-test",
    fromState: WorkItemState.Created,
    toState: WorkItemState.Intake,
    evidenceArtifactIds: ["artifact-work-anchor-test"],
    assignedEngineerHatAssignmentId: "engineer-hat-work-anchor-test",
    scheduledWorkBlockId: "schedule-block-work-anchor-test",
    transitionedAt: "2026-05-28T20:04:00.000Z",
    transitionedBy: Actor,
    sequence: 1,
    metadata: createTransitionMetadata(),
    ...input,
  };
}

function createMetadata(): CreateWorkAnchorInput["metadata"] {
  return {
    correlationId: "correlation-work-anchor-test",
    causationId: "causation-work-anchor-test",
    traceId: "trace-work-anchor-test",
    updatedAt: "2026-05-28T20:05:00.000Z",
    version: 1,
  };
}

function createTransitionMetadata(): CreateWorkAnchorInput["metadata"] {
  return {
    correlationId: "correlation-transition-test",
    causationId: "causation-transition-test",
    traceId: "trace-transition-test",
    updatedAt: "2026-05-28T20:06:00.000Z",
    version: 1,
  };
}

function createNextWorkItem(workItem: PersistedWorkItem): PersistedWorkItem {
  return {
    ...workItem,
    state: WorkItemState.Intake,
    metadata: {
      ...workItem.metadata,
      version: 2,
    },
  };
}
