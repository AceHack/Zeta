import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  InitiativeStatus,
  ProjectStatus,
  WorkItemState,
  WorkItemType,
  type AgenticActor,
} from "../../domain/src/index.ts";
import {
  WorkAnchorConflictReason,
  WorkAnchorPersistenceStatus,
  type CreateWorkAnchorInput,
  type PersistedInitiative,
  type PersistedProject,
  type PersistedWorkAnchorTarget,
  type PersistedWorkItem,
  type PersistedWorkStateTransition,
} from "../../state/src/index.ts";
import {
  CockroachWorkAnchorStateStoreStatement,
  createCockroachWorkAnchorStateStore,
  type CockroachWorkAnchorSqlExecutor,
  type CockroachWorkAnchorSqlResult,
  type CockroachWorkAnchorSqlStatement,
} from "../src/cockroach-work-anchor-state-store.ts";

const Actor: AgenticActor = {
  agentId: "agent-work-anchor-cockroach-test",
  hatAssignmentId: "hat-work-anchor-cockroach-test",
};

describe("cockroach work anchor state store", () => {
  test("persists and reads work anchor records behind the generic state port", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachWorkAnchorStateStore({ executor });
    const project = createProjectRecord();
    const initiative = createInitiativeRecord();
    const workItem = createWorkItemRecord();
    const anchorTarget = createWorkAnchorTargetRecord();

    equal((await store.createProject(project)).status, WorkAnchorPersistenceStatus.Committed);
    equal((await store.createInitiative(initiative)).status, WorkAnchorPersistenceStatus.Committed);
    equal((await store.createWorkItem(workItem)).status, WorkAnchorPersistenceStatus.Committed);
    equal((await store.createWorkAnchorTarget(anchorTarget)).status, WorkAnchorPersistenceStatus.Committed);

    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachWorkAnchorStateStoreStatement.InsertProject,
        CockroachWorkAnchorStateStoreStatement.InsertInitiative,
        CockroachWorkAnchorStateStoreStatement.InsertWorkItem,
        CockroachWorkAnchorStateStoreStatement.InsertWorkAnchorTarget,
      ],
    );
    deepEqual(executor.statements[0]?.parameters, [
      project.projectId,
      project.organizationId,
      project.name,
      project.status,
      project.createdAt,
      project.metadata.updatedAt,
      project.metadata.version,
      project.createdBy.agentId,
      project.createdBy.hatAssignmentId,
      project.metadata.correlationId,
      project.metadata.causationId,
      project.metadata.traceId,
    ]);

    Object.assign(executor.queryRows, {
      [CockroachWorkAnchorStateStoreStatement.FindProject]: [createProjectRow(project)],
      [CockroachWorkAnchorStateStoreStatement.FindInitiative]: [createInitiativeRow(initiative)],
      [CockroachWorkAnchorStateStoreStatement.FindWorkItem]: [createWorkItemRow(workItem)],
      [CockroachWorkAnchorStateStoreStatement.FindWorkAnchorTarget]: [createWorkAnchorTargetRow(anchorTarget)],
    });

    deepEqual(await store.findProject(project.projectId), project);
    deepEqual(await store.findInitiative(initiative.initiativeId), initiative);
    deepEqual(await store.findWorkItem(workItem.workItemId), workItem);
    deepEqual(await store.findWorkAnchorTarget(anchorTarget.workAnchorTargetId), anchorTarget);
  });

  test("returns duplicate when inserts lose the primary-key race", async () => {
    const executor = createRecordingExecutor({
      insertedStatements: new Set(),
    });
    const store = createCockroachWorkAnchorStateStore({ executor });

    const result = await store.createWorkItem(createWorkItemRecord());

    equal(result.status, WorkAnchorPersistenceStatus.Conflict);
    ok(result.status === WorkAnchorPersistenceStatus.Conflict);
    equal(result.reason, WorkAnchorConflictReason.DuplicateRecord);
  });

  test("transitions a work item and records state history in one transaction", async () => {
    const currentWorkItem = createWorkItemRecord();
    const nextWorkItem = createNextWorkItem(currentWorkItem);
    const transition = createWorkStateTransition();
    const executor = createRecordingExecutor({
      transitionRows: {
        [CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition]: [createWorkItemRow(currentWorkItem)],
      },
    });
    const store = createCockroachWorkAnchorStateStore({ executor });

    const result = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem,
      transition,
    });

    equal(result.status, WorkAnchorPersistenceStatus.Committed);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition,
        CockroachWorkAnchorStateStoreStatement.FindTransitionId,
        CockroachWorkAnchorStateStoreStatement.FindTransitionSequence,
        CockroachWorkAnchorStateStoreStatement.UpdateWorkItemForTransition,
        CockroachWorkAnchorStateStoreStatement.InsertWorkItemStateHistory,
      ],
    );
    deepEqual(executor.transactionStatements[3]?.parameters, [
      nextWorkItem.title,
      nextWorkItem.description,
      nextWorkItem.state,
      nextWorkItem.initiativeId,
      nextWorkItem.workItemType,
      nextWorkItem.metadata.updatedAt,
      nextWorkItem.metadata.version,
      nextWorkItem.metadata.correlationId,
      nextWorkItem.metadata.causationId,
      nextWorkItem.metadata.traceId,
      nextWorkItem.workItemId,
      1,
    ]);
    equal(executor.transactionStatements[4]?.sql.includes("$8::JSONB"), true);
    equal(executor.transactionStatements[4]?.sql.includes("ON CONFLICT DO NOTHING"), true);
    equal(executor.transactionStatements[4]?.sql.includes("ON CONFLICT (work_state_transition_id)"), false);
    deepEqual(executor.transactionStatements[4]?.parameters, [
      transition.workStateTransitionId,
      transition.organizationId,
      transition.projectId,
      transition.workItemId,
      transition.sequence,
      transition.fromState,
      transition.toState,
      JSON.stringify(transition.evidenceArtifactIds),
      transition.assignedEngineerHatAssignmentId,
      transition.scheduledWorkBlockId,
      transition.transitionedAt,
      transition.transitionedBy.agentId,
      transition.transitionedBy.hatAssignmentId,
      transition.metadata.updatedAt,
      transition.metadata.version,
      transition.metadata.correlationId,
      transition.metadata.causationId,
      transition.metadata.traceId,
    ]);
  });

  test("round-trips transition metadata from Cockroach state history", async () => {
    const transition = createWorkStateTransition();
    const executor = createRecordingExecutor({
      queryRows: {
        [CockroachWorkAnchorStateStoreStatement.ListWorkItemStateHistory]: [createWorkStateTransitionRow(transition)],
      },
    });
    const store = createCockroachWorkAnchorStateStore({ executor });

    deepEqual(await store.listWorkStateTransitions(transition.workItemId), [transition]);
  });

  test("rolls back when state history insert loses a race after the work item update", async () => {
    const currentWorkItem = createWorkItemRecord();
    const executor = createRecordingExecutor({
      insertedStatements: new Set([
        CockroachWorkAnchorStateStoreStatement.InsertProject,
        CockroachWorkAnchorStateStoreStatement.InsertInitiative,
        CockroachWorkAnchorStateStoreStatement.InsertWorkItem,
        CockroachWorkAnchorStateStoreStatement.InsertWorkAnchorTarget,
      ]),
      transitionRows: {
        [CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition]: [createWorkItemRow(currentWorkItem)],
      },
    });
    const store = createCockroachWorkAnchorStateStore({ executor });

    const result = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(currentWorkItem),
      transition: createWorkStateTransition(),
    });

    equal(result.status, WorkAnchorPersistenceStatus.Conflict);
    ok(result.status === WorkAnchorPersistenceStatus.Conflict);
    equal(result.reason, WorkAnchorConflictReason.DuplicateTransitionId);
    equal(executor.rollbackRequested, true);
  });

  test("rolls back and maps late sequence races to duplicate sequence conflicts", async () => {
    const currentWorkItem = createWorkItemRecord();
    const executor = createRecordingExecutor({
      insertedStatements: new Set([
        CockroachWorkAnchorStateStoreStatement.InsertProject,
        CockroachWorkAnchorStateStoreStatement.InsertInitiative,
        CockroachWorkAnchorStateStoreStatement.InsertWorkItem,
        CockroachWorkAnchorStateStoreStatement.InsertWorkAnchorTarget,
      ]),
      lateHistoryConflictReason: WorkAnchorConflictReason.DuplicateTransitionSequence,
      transitionRows: {
        [CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition]: [createWorkItemRow(currentWorkItem)],
      },
    });
    const store = createCockroachWorkAnchorStateStore({ executor });

    const result = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(currentWorkItem),
      transition: createWorkStateTransition(),
    });

    equal(result.status, WorkAnchorPersistenceStatus.Conflict);
    ok(result.status === WorkAnchorPersistenceStatus.Conflict);
    equal(result.reason, WorkAnchorConflictReason.DuplicateTransitionSequence);
    equal(executor.rollbackRequested, true);
  });

  test("preserves duplicate transition id priority for late history insert conflicts", async () => {
    const currentWorkItem = createWorkItemRecord();
    const executor = createRecordingExecutor({
      insertedStatements: new Set([
        CockroachWorkAnchorStateStoreStatement.InsertProject,
        CockroachWorkAnchorStateStoreStatement.InsertInitiative,
        CockroachWorkAnchorStateStoreStatement.InsertWorkItem,
        CockroachWorkAnchorStateStoreStatement.InsertWorkAnchorTarget,
      ]),
      lateHistoryConflictReason: WorkAnchorConflictReason.DuplicateTransitionSequence,
      transitionRows: {
        [CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition]: [createWorkItemRow(currentWorkItem)],
      },
      lateConflictRows: {
        [CockroachWorkAnchorStateStoreStatement.FindTransitionId]: [{ id: "transition-late-id-race" }],
        [CockroachWorkAnchorStateStoreStatement.FindTransitionSequence]: [{ id: "transition-late-sequence-race" }],
      },
    });
    const store = createCockroachWorkAnchorStateStore({ executor });

    const result = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: createNextWorkItem(currentWorkItem),
      transition: createWorkStateTransition(),
    });

    equal(result.status, WorkAnchorPersistenceStatus.Conflict);
    ok(result.status === WorkAnchorPersistenceStatus.Conflict);
    equal(result.reason, WorkAnchorConflictReason.DuplicateTransitionId);
    equal(executor.rollbackRequested, true);
  });

  test("uses shared transition validation before durable mutation statements", async () => {
    const currentWorkItem = createWorkItemRecord();
    const executor = createRecordingExecutor({
      transitionRows: {
        [CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition]: [createWorkItemRow(currentWorkItem)],
      },
    });
    const store = createCockroachWorkAnchorStateStore({ executor });

    const result = await store.transitionWorkItem({
      expectedVersion: 1,
      nextWorkItem: {
        ...createNextWorkItem(currentWorkItem),
        metadata: {
          ...currentWorkItem.metadata,
          version: 1,
        },
      },
      transition: createWorkStateTransition(),
    });

    equal(result.status, WorkAnchorPersistenceStatus.Conflict);
    ok(result.status === WorkAnchorPersistenceStatus.Conflict);
    equal(result.reason, WorkAnchorConflictReason.InvalidNextVersion);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition,
        CockroachWorkAnchorStateStoreStatement.FindTransitionId,
        CockroachWorkAnchorStateStoreStatement.FindTransitionSequence,
      ],
    );
  });
});

type RecordingCockroachWorkAnchorSqlExecutor = CockroachWorkAnchorSqlExecutor & {
  queryRows: Partial<Record<CockroachWorkAnchorStateStoreStatement, readonly Record<string, unknown>[]>>;
  readonly rollbackRequested: boolean;
  statements: CockroachWorkAnchorSqlStatement[];
  transactionStatements: CockroachWorkAnchorSqlStatement[];
};

function createRecordingExecutor(
  input: {
    insertedStatements?: ReadonlySet<CockroachWorkAnchorStateStoreStatement>;
    lateConflictRows?: Partial<Record<CockroachWorkAnchorStateStoreStatement, readonly Record<string, unknown>[]>>;
    lateHistoryConflictReason?: WorkAnchorConflictReason;
    queryRows?: Partial<Record<CockroachWorkAnchorStateStoreStatement, readonly Record<string, unknown>[]>>;
    transitionRows?: Partial<Record<CockroachWorkAnchorStateStoreStatement, readonly Record<string, unknown>[]>>;
  } = {},
): RecordingCockroachWorkAnchorSqlExecutor {
  const statements: CockroachWorkAnchorSqlStatement[] = [];
  const transactionStatements: CockroachWorkAnchorSqlStatement[] = [];
  const insertedStatements = input.insertedStatements ?? DefaultInsertedStatements;
  const queryRows: Partial<Record<CockroachWorkAnchorStateStoreStatement, readonly Record<string, unknown>[]>> = {
    ...(input.queryRows ?? {}),
    ...(input.transitionRows ?? {}),
  };
  let transitionSequenceLookupCount = 0;
  let transitionIdLookupCount = 0;
  let rollbackRequested = false;

  return {
    get rollbackRequested() {
      return rollbackRequested;
    },
    queryRows,
    statements,
    transactionStatements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachWorkAnchorSqlStatement) => {
      statements.push(statement);
      return createResult<Row>(statement, insertedStatements, queryRows);
    },
    executeTransaction: async (operation) => {
      try {
        return await operation({
          execute: async <Row = Record<string, unknown>>(statement: CockroachWorkAnchorSqlStatement) => {
            transactionStatements.push(statement);
            if (
              statement.name === CockroachWorkAnchorStateStoreStatement.FindTransitionId &&
              input.lateConflictRows?.[CockroachWorkAnchorStateStoreStatement.FindTransitionId] !== undefined
            ) {
              transitionIdLookupCount += 1;

              if (transitionIdLookupCount > 1) {
                return {
                  rows: input.lateConflictRows[CockroachWorkAnchorStateStoreStatement.FindTransitionId] as Row[],
                };
              }
            }

            if (
              statement.name === CockroachWorkAnchorStateStoreStatement.FindTransitionSequence &&
              (input.lateHistoryConflictReason === WorkAnchorConflictReason.DuplicateTransitionSequence ||
                input.lateConflictRows?.[CockroachWorkAnchorStateStoreStatement.FindTransitionSequence] !== undefined)
            ) {
              transitionSequenceLookupCount += 1;

              if (transitionSequenceLookupCount > 1) {
                return {
                  rows: (
                    input.lateConflictRows?.[CockroachWorkAnchorStateStoreStatement.FindTransitionSequence] ?? [
                      { id: "transition-late-sequence-race" },
                    ]
                  ) as Row[],
                };
              }
            }

            return createResult<Row>(statement, insertedStatements, queryRows);
          },
        });
      } catch (error) {
        rollbackRequested = true;
        throw error;
      }
    },
  };
}

function createResult<Row>(
  statement: CockroachWorkAnchorSqlStatement,
  insertedStatements: ReadonlySet<CockroachWorkAnchorStateStoreStatement>,
  queryRows: Partial<Record<CockroachWorkAnchorStateStoreStatement, readonly Record<string, unknown>[]>>,
): CockroachWorkAnchorSqlResult<Row> {
  if (InsertStatements.has(statement.name)) {
    return {
      rows: insertedStatements.has(statement.name) ? ([{ id: statement.parameters[0] }] as Row[]) : [],
    };
  }

  if (statement.name === CockroachWorkAnchorStateStoreStatement.UpdateWorkItemForTransition) {
    return {
      rows: [{ work_item_id: statement.parameters[10] }] as Row[],
    };
  }

  return {
    rows: (queryRows[statement.name] ?? []) as Row[],
  };
}

const InsertStatements = new Set<CockroachWorkAnchorStateStoreStatement>([
  CockroachWorkAnchorStateStoreStatement.InsertProject,
  CockroachWorkAnchorStateStoreStatement.InsertInitiative,
  CockroachWorkAnchorStateStoreStatement.InsertWorkItem,
  CockroachWorkAnchorStateStoreStatement.InsertWorkAnchorTarget,
  CockroachWorkAnchorStateStoreStatement.InsertWorkItemStateHistory,
]);

const DefaultInsertedStatements = InsertStatements;

function createProjectRecord(): PersistedProject {
  return {
    projectId: "project-work-anchor-cockroach-test",
    organizationId: "org-work-anchor-cockroach-test",
    name: "Work Anchor Cockroach Project",
    status: ProjectStatus.Active,
    createdAt: "2026-05-28T21:00:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
  };
}

function createInitiativeRecord(): PersistedInitiative {
  return {
    initiativeId: "initiative-work-anchor-cockroach-test",
    organizationId: "org-work-anchor-cockroach-test",
    projectId: "project-work-anchor-cockroach-test",
    title: "Work Anchor Cockroach Initiative",
    status: InitiativeStatus.Active,
    createdAt: "2026-05-28T21:01:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
  };
}

function createWorkItemRecord(): PersistedWorkItem {
  return {
    workItemId: "work-item-work-anchor-cockroach-test",
    organizationId: "org-work-anchor-cockroach-test",
    projectId: "project-work-anchor-cockroach-test",
    initiativeId: "initiative-work-anchor-cockroach-test",
    workItemType: WorkItemType.Task,
    title: "Work Anchor Cockroach Item",
    description: "A work item used by the Cockroach adapter test.",
    state: WorkItemState.Created,
    createdAt: "2026-05-28T21:02:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
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

function createWorkAnchorTargetRecord(): PersistedWorkAnchorTarget {
  return {
    workAnchorTargetId: "anchor-work-anchor-cockroach-test",
    organizationId: "org-work-anchor-cockroach-test",
    projectId: "project-work-anchor-cockroach-test",
    initiativeId: "initiative-work-anchor-cockroach-test",
    workItemId: "work-item-work-anchor-cockroach-test",
    createdAt: "2026-05-28T21:03:00.000Z",
    createdBy: Actor,
    metadata: createMetadata(),
  };
}

function createWorkStateTransition(): PersistedWorkStateTransition {
  return {
    workStateTransitionId: "transition-work-anchor-cockroach-test",
    organizationId: "org-work-anchor-cockroach-test",
    projectId: "project-work-anchor-cockroach-test",
    workItemId: "work-item-work-anchor-cockroach-test",
    fromState: WorkItemState.Created,
    toState: WorkItemState.Intake,
    evidenceArtifactIds: ["artifact-work-anchor-cockroach-test"],
    assignedEngineerHatAssignmentId: "engineer-hat-work-anchor-cockroach-test",
    scheduledWorkBlockId: "schedule-block-work-anchor-cockroach-test",
    transitionedAt: "2026-05-28T21:04:00.000Z",
    transitionedBy: Actor,
    sequence: 1,
    metadata: createTransitionMetadata(),
  };
}

function createMetadata(): CreateWorkAnchorInput["metadata"] {
  return {
    correlationId: "correlation-work-anchor-cockroach-test",
    causationId: "causation-work-anchor-cockroach-test",
    traceId: "trace-work-anchor-cockroach-test",
    updatedAt: "2026-05-28T21:05:00.000Z",
    version: 1,
  };
}

function createTransitionMetadata(): CreateWorkAnchorInput["metadata"] {
  return {
    correlationId: "correlation-transition-cockroach-test",
    causationId: "causation-transition-cockroach-test",
    traceId: "trace-transition-cockroach-test",
    updatedAt: "2026-05-28T21:06:00.000Z",
    version: 1,
  };
}

function createProjectRow(project: PersistedProject): Record<string, unknown> {
  return {
    project_id: project.projectId,
    organization_id: project.organizationId,
    name: project.name,
    status: project.status,
    created_at: project.createdAt,
    updated_at: project.metadata.updatedAt,
    version: project.metadata.version,
    created_by_agent_id: project.createdBy.agentId,
    created_by_hat_assignment_id: project.createdBy.hatAssignmentId,
    correlation_id: project.metadata.correlationId,
    causation_id: project.metadata.causationId,
    trace_id: project.metadata.traceId,
  };
}

function createInitiativeRow(initiative: PersistedInitiative): Record<string, unknown> {
  return {
    initiative_id: initiative.initiativeId,
    organization_id: initiative.organizationId,
    project_id: initiative.projectId,
    title: initiative.title,
    status: initiative.status,
    created_at: initiative.createdAt,
    updated_at: initiative.metadata.updatedAt,
    version: initiative.metadata.version,
    created_by_agent_id: initiative.createdBy.agentId,
    created_by_hat_assignment_id: initiative.createdBy.hatAssignmentId,
    correlation_id: initiative.metadata.correlationId,
    causation_id: initiative.metadata.causationId,
    trace_id: initiative.metadata.traceId,
  };
}

function createWorkItemRow(workItem: PersistedWorkItem): Record<string, unknown> {
  return {
    work_item_id: workItem.workItemId,
    organization_id: workItem.organizationId,
    project_id: workItem.projectId,
    initiative_id: workItem.initiativeId,
    work_item_type: workItem.workItemType,
    title: workItem.title,
    description: workItem.description,
    state: workItem.state,
    created_at: workItem.createdAt,
    updated_at: workItem.metadata.updatedAt,
    version: workItem.metadata.version,
    created_by_agent_id: workItem.createdBy.agentId,
    created_by_hat_assignment_id: workItem.createdBy.hatAssignmentId,
    correlation_id: workItem.metadata.correlationId,
    causation_id: workItem.metadata.causationId,
    trace_id: workItem.metadata.traceId,
  };
}

function createWorkAnchorTargetRow(anchorTarget: PersistedWorkAnchorTarget): Record<string, unknown> {
  return {
    work_anchor_target_id: anchorTarget.workAnchorTargetId,
    organization_id: anchorTarget.organizationId,
    project_id: anchorTarget.projectId,
    initiative_id: anchorTarget.initiativeId,
    work_item_id: anchorTarget.workItemId,
    created_at: anchorTarget.createdAt,
    updated_at: anchorTarget.metadata.updatedAt,
    version: anchorTarget.metadata.version,
    created_by_agent_id: anchorTarget.createdBy.agentId,
    created_by_hat_assignment_id: anchorTarget.createdBy.hatAssignmentId,
    correlation_id: anchorTarget.metadata.correlationId,
    causation_id: anchorTarget.metadata.causationId,
    trace_id: anchorTarget.metadata.traceId,
  };
}

function createWorkStateTransitionRow(transition: PersistedWorkStateTransition): Record<string, unknown> {
  return {
    work_state_transition_id: transition.workStateTransitionId,
    organization_id: transition.organizationId,
    project_id: transition.projectId,
    work_item_id: transition.workItemId,
    sequence: transition.sequence,
    from_state: transition.fromState,
    to_state: transition.toState,
    evidence_artifact_ids: transition.evidenceArtifactIds,
    assigned_engineer_hat_assignment_id: transition.assignedEngineerHatAssignmentId,
    scheduled_work_block_id: transition.scheduledWorkBlockId,
    transitioned_at: transition.transitionedAt,
    transitioned_by_agent_id: transition.transitionedBy.agentId,
    transitioned_by_hat_assignment_id: transition.transitionedBy.hatAssignmentId,
    updated_at: transition.metadata.updatedAt,
    version: transition.metadata.version,
    correlation_id: transition.metadata.correlationId,
    causation_id: transition.metadata.causationId,
    trace_id: transition.metadata.traceId,
  };
}
