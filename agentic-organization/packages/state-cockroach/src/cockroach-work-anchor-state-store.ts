import {
  WorkAnchorConflictReason,
  WorkAnchorPersistenceStatus,
  validateWorkItemTransitionInput,
  type PersistedInitiative,
  type PersistedProject,
  type PersistedWorkAnchorTarget,
  type PersistedWorkItem,
  type PersistedWorkStateTransition,
  type TransitionWorkItemInput,
  type WorkAnchorPersistenceResult,
  type WorkAnchorRecordMetadata,
  type WorkAnchorStateStore,
} from "../../state/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachWorkAnchorStateStoreStatement = {
  FindProject: "find_project",
  FindInitiative: "find_initiative",
  FindWorkItem: "find_work_item",
  FindWorkAnchorTarget: "find_work_anchor_target",
  ListWorkItemStateHistory: "list_work_item_state_history",
  InsertProject: "insert_project",
  InsertInitiative: "insert_initiative",
  InsertWorkItem: "insert_work_item",
  InsertWorkAnchorTarget: "insert_work_anchor_target",
  FindWorkItemForTransition: "find_work_item_for_transition",
  FindTransitionId: "find_transition_id",
  FindTransitionSequence: "find_transition_sequence",
  UpdateWorkItemForTransition: "update_work_item_for_transition",
  InsertWorkItemStateHistory: "insert_work_item_state_history",
} as const;

export type CockroachWorkAnchorStateStoreStatement =
  (typeof CockroachWorkAnchorStateStoreStatement)[keyof typeof CockroachWorkAnchorStateStoreStatement];

export type CockroachWorkAnchorSqlStatement = {
  name: CockroachWorkAnchorStateStoreStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachWorkAnchorSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachWorkAnchorSqlTransactionExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachWorkAnchorSqlStatement,
  ) => Promise<CockroachWorkAnchorSqlResult<Row>>;
};

export type CockroachWorkAnchorSqlExecutor = CockroachWorkAnchorSqlTransactionExecutor & {
  executeTransaction: <Result>(
    operation: (executor: CockroachWorkAnchorSqlTransactionExecutor) => Promise<Result>,
  ) => Promise<Result>;
};

export type CreateCockroachWorkAnchorStateStoreInput = {
  executor: CockroachWorkAnchorSqlExecutor;
};

type CockroachCreateResultRow = {
  id: string;
};

type CockroachWorkTransitionLookupRow = {
  id: string;
};

export function createCockroachWorkAnchorStateStore(
  input: CreateCockroachWorkAnchorStateStoreInput,
): WorkAnchorStateStore {
  return {
    findProject: async (projectId) => mapProjectRow((await input.executor.execute<ProjectRow>({
      name: CockroachWorkAnchorStateStoreStatement.FindProject,
      sql: CockroachWorkAnchorSql.FindProject,
      parameters: [projectId],
    })).rows[0]),
    findInitiative: async (initiativeId) => mapInitiativeRow((await input.executor.execute<InitiativeRow>({
      name: CockroachWorkAnchorStateStoreStatement.FindInitiative,
      sql: CockroachWorkAnchorSql.FindInitiative,
      parameters: [initiativeId],
    })).rows[0]),
    findWorkItem: async (workItemId) => mapWorkItemRow((await input.executor.execute<WorkItemRow>({
      name: CockroachWorkAnchorStateStoreStatement.FindWorkItem,
      sql: CockroachWorkAnchorSql.FindWorkItem,
      parameters: [workItemId],
    })).rows[0]),
    findWorkAnchorTarget: async (workAnchorTargetId) =>
      mapWorkAnchorTargetRow((await input.executor.execute<WorkAnchorTargetRow>({
        name: CockroachWorkAnchorStateStoreStatement.FindWorkAnchorTarget,
        sql: CockroachWorkAnchorSql.FindWorkAnchorTarget,
        parameters: [workAnchorTargetId],
      })).rows[0]),
    listWorkStateTransitions: async (workItemId) =>
      (await input.executor.execute<WorkStateTransitionRow>({
        name: CockroachWorkAnchorStateStoreStatement.ListWorkItemStateHistory,
        sql: CockroachWorkAnchorSql.ListWorkItemStateHistory,
        parameters: [workItemId],
      })).rows.map(mapWorkStateTransitionRow),
    createProject: async (project) =>
      await insertRecord(input.executor, createInsertProjectStatement(project)),
    createInitiative: async (initiative) =>
      await insertRecord(input.executor, createInsertInitiativeStatement(initiative)),
    createWorkItem: async (workItem) =>
      await insertRecord(input.executor, createInsertWorkItemStatement(workItem)),
    createWorkAnchorTarget: async (workAnchorTarget) =>
      await insertRecord(input.executor, createInsertWorkAnchorTargetStatement(workAnchorTarget)),
    transitionWorkItem: async (transitionInput) =>
      await transitionWorkItem(input.executor, transitionInput),
  };
}

async function insertRecord(
  executor: CockroachWorkAnchorSqlTransactionExecutor,
  statement: CockroachWorkAnchorSqlStatement,
  duplicateReason: WorkAnchorConflictReason = WorkAnchorConflictReason.DuplicateRecord,
): Promise<WorkAnchorPersistenceResult> {
  const result = await executor.execute<CockroachCreateResultRow>(statement);

  if (result.rows[0] === undefined) {
    return createConflictResult(duplicateReason);
  }

  return createCommittedResult();
}

async function transitionWorkItem(
  executor: CockroachWorkAnchorSqlExecutor,
  transitionInput: TransitionWorkItemInput,
): Promise<WorkAnchorPersistenceResult> {
  try {
    return await executor.executeTransaction(async (transaction) => {
      const currentWorkItem = mapWorkItemRow((await transaction.execute<WorkItemRow>({
        name: CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition,
        sql: CockroachWorkAnchorSql.FindWorkItemForTransition,
        parameters: [transitionInput.nextWorkItem.workItemId],
      })).rows[0]);

      if (currentWorkItem === undefined) {
        return createConflictResult(WorkAnchorConflictReason.MissingWorkItem);
      }

      const transitionIdExists = await hasTransitionId(transaction, transitionInput.transition.workStateTransitionId);
      const transitionSequenceExists = await hasTransitionSequence(
        transaction,
        transitionInput.transition.workItemId,
        transitionInput.transition.sequence,
      );
      const validationConflict = validateWorkItemTransitionInput({
        currentWorkItem,
        transitionInput,
        hasTransitionId: () => transitionIdExists,
        hasTransitionSequence: () => transitionSequenceExists,
      });

      if (validationConflict !== undefined) {
        return validationConflict;
      }

      const updateResult = await transaction.execute<CockroachCreateResultRow>(
        createUpdateWorkItemForTransitionStatement(transitionInput),
      );

      if (updateResult.rows[0] === undefined) {
        return createConflictResult(WorkAnchorConflictReason.VersionMismatch);
      }

      const historyResult = await insertRecord(
        transaction,
        createInsertWorkItemStateHistoryStatement(transitionInput.transition),
        WorkAnchorConflictReason.DuplicateTransitionId,
      );

      if (historyResult.status === WorkAnchorPersistenceStatus.Conflict) {
        const lateTransitionIdConflict = await hasTransitionId(
          transaction,
          transitionInput.transition.workStateTransitionId,
        );
        const lateSequenceConflict = await hasTransitionSequence(
          transaction,
          transitionInput.transition.workItemId,
          transitionInput.transition.sequence,
        );
        throw new CockroachWorkAnchorRollbackConflict(
          lateTransitionIdConflict
            ? historyResult
            : lateSequenceConflict
              ? createConflictResult(WorkAnchorConflictReason.DuplicateTransitionSequence)
              : historyResult,
        );
      }

      return historyResult;
    });
  } catch (error) {
    if (error instanceof CockroachWorkAnchorRollbackConflict) {
      return error.result;
    }

    throw error;
  }
}

async function hasTransitionId(
  executor: CockroachWorkAnchorSqlTransactionExecutor,
  workStateTransitionId: string,
): Promise<boolean> {
  const result = await executor.execute<CockroachWorkTransitionLookupRow>({
    name: CockroachWorkAnchorStateStoreStatement.FindTransitionId,
    sql: CockroachWorkAnchorSql.FindTransitionId,
    parameters: [workStateTransitionId],
  });

  return result.rows[0] !== undefined;
}

async function hasTransitionSequence(
  executor: CockroachWorkAnchorSqlTransactionExecutor,
  workItemId: string,
  sequence: number,
): Promise<boolean> {
  const result = await executor.execute<CockroachWorkTransitionLookupRow>({
    name: CockroachWorkAnchorStateStoreStatement.FindTransitionSequence,
    sql: CockroachWorkAnchorSql.FindTransitionSequence,
    parameters: [workItemId, sequence],
  });

  return result.rows[0] !== undefined;
}

function createInsertProjectStatement(project: PersistedProject): CockroachWorkAnchorSqlStatement {
  return {
    name: CockroachWorkAnchorStateStoreStatement.InsertProject,
    sql: CockroachWorkAnchorSql.InsertProject,
    parameters: [
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
    ],
  };
}

function createInsertInitiativeStatement(initiative: PersistedInitiative): CockroachWorkAnchorSqlStatement {
  return {
    name: CockroachWorkAnchorStateStoreStatement.InsertInitiative,
    sql: CockroachWorkAnchorSql.InsertInitiative,
    parameters: [
      initiative.initiativeId,
      initiative.organizationId,
      initiative.projectId,
      initiative.title,
      initiative.status,
      initiative.createdAt,
      initiative.metadata.updatedAt,
      initiative.metadata.version,
      initiative.createdBy.agentId,
      initiative.createdBy.hatAssignmentId,
      initiative.metadata.correlationId,
      initiative.metadata.causationId,
      initiative.metadata.traceId,
    ],
  };
}

function createInsertWorkItemStatement(workItem: PersistedWorkItem): CockroachWorkAnchorSqlStatement {
  return {
    name: CockroachWorkAnchorStateStoreStatement.InsertWorkItem,
    sql: CockroachWorkAnchorSql.InsertWorkItem,
    parameters: [
      workItem.workItemId,
      workItem.organizationId,
      workItem.projectId,
      workItem.initiativeId ?? null,
      workItem.workItemType,
      workItem.title,
      workItem.description,
      workItem.state,
      workItem.createdAt,
      workItem.metadata.updatedAt,
      workItem.metadata.version,
      workItem.createdBy.agentId,
      workItem.createdBy.hatAssignmentId,
      workItem.metadata.correlationId,
      workItem.metadata.causationId,
      workItem.metadata.traceId,
    ],
  };
}

function createInsertWorkAnchorTargetStatement(
  workAnchorTarget: PersistedWorkAnchorTarget,
): CockroachWorkAnchorSqlStatement {
  return {
    name: CockroachWorkAnchorStateStoreStatement.InsertWorkAnchorTarget,
    sql: CockroachWorkAnchorSql.InsertWorkAnchorTarget,
    parameters: [
      workAnchorTarget.workAnchorTargetId,
      workAnchorTarget.organizationId,
      workAnchorTarget.projectId,
      workAnchorTarget.initiativeId ?? null,
      workAnchorTarget.workItemId,
      workAnchorTarget.createdAt,
      workAnchorTarget.metadata.updatedAt,
      workAnchorTarget.metadata.version,
      workAnchorTarget.createdBy.agentId,
      workAnchorTarget.createdBy.hatAssignmentId,
      workAnchorTarget.metadata.correlationId,
      workAnchorTarget.metadata.causationId,
      workAnchorTarget.metadata.traceId,
    ],
  };
}

function createUpdateWorkItemForTransitionStatement(input: TransitionWorkItemInput): CockroachWorkAnchorSqlStatement {
  return {
    name: CockroachWorkAnchorStateStoreStatement.UpdateWorkItemForTransition,
    sql: CockroachWorkAnchorSql.UpdateWorkItemForTransition,
    parameters: [
      input.nextWorkItem.title,
      input.nextWorkItem.description,
      input.nextWorkItem.state,
      input.nextWorkItem.initiativeId ?? null,
      input.nextWorkItem.workItemType,
      input.nextWorkItem.metadata.updatedAt,
      input.nextWorkItem.metadata.version,
      input.nextWorkItem.metadata.correlationId,
      input.nextWorkItem.metadata.causationId,
      input.nextWorkItem.metadata.traceId,
      input.nextWorkItem.workItemId,
      input.expectedVersion,
    ],
  };
}

function createInsertWorkItemStateHistoryStatement(
  transition: PersistedWorkStateTransition,
): CockroachWorkAnchorSqlStatement {
  return {
    name: CockroachWorkAnchorStateStoreStatement.InsertWorkItemStateHistory,
    sql: CockroachWorkAnchorSql.InsertWorkItemStateHistory,
    parameters: [
      transition.workStateTransitionId,
      transition.organizationId,
      transition.projectId,
      transition.workItemId,
      transition.sequence,
      transition.fromState,
      transition.toState,
      JSON.stringify(transition.evidenceArtifactIds),
      transition.assignedEngineerHatAssignmentId ?? null,
      transition.scheduledWorkBlockId ?? null,
      transition.transitionedAt,
      transition.transitionedBy.agentId,
      transition.transitionedBy.hatAssignmentId,
      transition.metadata.updatedAt,
      transition.metadata.version,
      transition.metadata.correlationId,
      transition.metadata.causationId,
      transition.metadata.traceId,
    ],
  };
}

function mapProjectRow(row: ProjectRow | undefined): PersistedProject | undefined {
  if (row === undefined) {
    return undefined;
  }

  return {
    projectId: row.project_id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status,
    createdAt: stringifyTimestamp(row.created_at),
    createdBy: {
      agentId: row.created_by_agent_id,
      hatAssignmentId: row.created_by_hat_assignment_id,
    },
    metadata: mapMetadata(row),
  };
}

function mapInitiativeRow(row: InitiativeRow | undefined): PersistedInitiative | undefined {
  if (row === undefined) {
    return undefined;
  }

  return {
    initiativeId: row.initiative_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    createdAt: stringifyTimestamp(row.created_at),
    createdBy: {
      agentId: row.created_by_agent_id,
      hatAssignmentId: row.created_by_hat_assignment_id,
    },
    metadata: mapMetadata(row),
  };
}

function mapWorkItemRow(row: WorkItemRow | undefined): PersistedWorkItem | undefined {
  if (row === undefined) {
    return undefined;
  }

  const workItem: PersistedWorkItem = {
    workItemId: row.work_item_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    workItemType: row.work_item_type,
    title: row.title,
    description: row.description,
    state: row.state,
    createdAt: stringifyTimestamp(row.created_at),
    createdBy: {
      agentId: row.created_by_agent_id,
      hatAssignmentId: row.created_by_hat_assignment_id,
    },
    metadata: mapMetadata(row),
  };

  if (row.initiative_id !== undefined && row.initiative_id !== null) {
    workItem.initiativeId = row.initiative_id;
  }

  return workItem;
}

function mapWorkAnchorTargetRow(row: WorkAnchorTargetRow | undefined): PersistedWorkAnchorTarget | undefined {
  if (row === undefined) {
    return undefined;
  }

  const workAnchorTarget: PersistedWorkAnchorTarget = {
    workAnchorTargetId: row.work_anchor_target_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    workItemId: row.work_item_id,
    createdAt: stringifyTimestamp(row.created_at),
    createdBy: {
      agentId: row.created_by_agent_id,
      hatAssignmentId: row.created_by_hat_assignment_id,
    },
    metadata: mapMetadata(row),
  };

  if (row.initiative_id !== undefined && row.initiative_id !== null) {
    workAnchorTarget.initiativeId = row.initiative_id;
  }

  return workAnchorTarget;
}

function mapWorkStateTransitionRow(row: WorkStateTransitionRow): PersistedWorkStateTransition {
  const transition: PersistedWorkStateTransition = {
    workStateTransitionId: row.work_state_transition_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    workItemId: row.work_item_id,
    sequence: Number(row.sequence),
    fromState: row.from_state,
    toState: row.to_state,
    evidenceArtifactIds: row.evidence_artifact_ids,
    transitionedAt: stringifyTimestamp(row.transitioned_at),
    transitionedBy: {
      agentId: row.transitioned_by_agent_id,
      hatAssignmentId: row.transitioned_by_hat_assignment_id,
    },
    metadata: {
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      traceId: row.trace_id,
      updatedAt: stringifyTimestamp(row.updated_at),
      version: Number(row.version),
    },
  };

  if (row.assigned_engineer_hat_assignment_id !== undefined && row.assigned_engineer_hat_assignment_id !== null) {
    transition.assignedEngineerHatAssignmentId = row.assigned_engineer_hat_assignment_id;
  }

  if (row.scheduled_work_block_id !== undefined && row.scheduled_work_block_id !== null) {
    transition.scheduledWorkBlockId = row.scheduled_work_block_id;
  }

  return transition;
}

function mapMetadata(row: MetadataRow): WorkAnchorRecordMetadata {
  return {
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    traceId: row.trace_id,
    updatedAt: stringifyTimestamp(row.updated_at),
    version: Number(row.version),
  };
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function createConflictResult(reason: WorkAnchorConflictReason): WorkAnchorPersistenceResult {
  return {
    status: WorkAnchorPersistenceStatus.Conflict,
    reason,
  };
}

function createCommittedResult(): WorkAnchorPersistenceResult {
  return {
    status: WorkAnchorPersistenceStatus.Committed,
  };
}

type MetadataRow = {
  updated_at: string | Date;
  version: number | string;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
};

type ProjectRow = MetadataRow & {
  project_id: string;
  organization_id: string;
  name: string;
  status: PersistedProject["status"];
  created_at: string | Date;
  created_by_agent_id: string;
  created_by_hat_assignment_id: string;
};

type InitiativeRow = MetadataRow & {
  initiative_id: string;
  organization_id: string;
  project_id: string;
  title: string;
  status: PersistedInitiative["status"];
  created_at: string | Date;
  created_by_agent_id: string;
  created_by_hat_assignment_id: string;
};

type WorkItemRow = MetadataRow & {
  work_item_id: string;
  organization_id: string;
  project_id: string;
  initiative_id?: string | null;
  work_item_type: PersistedWorkItem["workItemType"];
  title: string;
  description: string;
  state: PersistedWorkItem["state"];
  created_at: string | Date;
  created_by_agent_id: string;
  created_by_hat_assignment_id: string;
};

type WorkAnchorTargetRow = MetadataRow & {
  work_anchor_target_id: string;
  organization_id: string;
  project_id: string;
  initiative_id?: string | null;
  work_item_id: string;
  created_at: string | Date;
  created_by_agent_id: string;
  created_by_hat_assignment_id: string;
};

type WorkStateTransitionRow = {
  work_state_transition_id: string;
  organization_id: string;
  project_id: string;
  work_item_id: string;
  sequence: number | string;
  from_state: PersistedWorkStateTransition["fromState"];
  to_state: PersistedWorkStateTransition["toState"];
  evidence_artifact_ids: readonly string[];
  assigned_engineer_hat_assignment_id?: string | null;
  scheduled_work_block_id?: string | null;
  transitioned_at: string | Date;
  transitioned_by_agent_id: string;
  transitioned_by_hat_assignment_id: string;
  updated_at: string | Date;
  version: number | string;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
};

class CockroachWorkAnchorRollbackConflict extends Error {
  readonly result: WorkAnchorPersistenceResult;

  constructor(result: WorkAnchorPersistenceResult) {
    super("cockroach work anchor transition rollback requested");
    this.result = result;
  }
}

const WorkAnchorSelectColumns = `
  organization_id,
  project_id,
  created_at,
  updated_at,
  version,
  created_by_agent_id,
  created_by_hat_assignment_id,
  correlation_id,
  causation_id,
  trace_id
`;

const CockroachWorkAnchorSql = {
  FindProject: `
    SELECT project_id, name, status, ${WorkAnchorSelectColumns}
    FROM ${CockroachTableName.Projects}
    WHERE project_id = $1
  `,
  FindInitiative: `
    SELECT initiative_id, title, status, ${WorkAnchorSelectColumns}
    FROM ${CockroachTableName.Initiatives}
    WHERE initiative_id = $1
  `,
  FindWorkItem: `
    SELECT
      work_item_id,
      organization_id,
      project_id,
      initiative_id,
      work_item_type,
      title,
      description,
      state,
      created_at,
      updated_at,
      version,
      created_by_agent_id,
      created_by_hat_assignment_id,
      correlation_id,
      causation_id,
      trace_id
    FROM ${CockroachTableName.WorkItems}
    WHERE work_item_id = $1
  `,
  FindWorkAnchorTarget: `
    SELECT work_anchor_target_id, initiative_id, work_item_id, ${WorkAnchorSelectColumns}
    FROM ${CockroachTableName.WorkAnchorTargets}
    WHERE work_anchor_target_id = $1
  `,
  ListWorkItemStateHistory: `
    SELECT
      work_state_transition_id,
      organization_id,
      project_id,
      work_item_id,
      sequence,
      from_state,
      to_state,
      evidence_artifact_ids,
      assigned_engineer_hat_assignment_id,
      scheduled_work_block_id,
      transitioned_at,
      transitioned_by_agent_id,
      transitioned_by_hat_assignment_id,
      updated_at,
      version,
      correlation_id,
      causation_id,
      trace_id
    FROM ${CockroachTableName.WorkItemStateHistory}
    WHERE work_item_id = $1
    ORDER BY sequence ASC, work_state_transition_id ASC
  `,
  InsertProject: `
    INSERT INTO ${CockroachTableName.Projects} (
      project_id,
      organization_id,
      name,
      status,
      created_at,
      updated_at,
      version,
      created_by_agent_id,
      created_by_hat_assignment_id,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (project_id) DO NOTHING
    RETURNING project_id AS id
  `,
  InsertInitiative: `
    INSERT INTO ${CockroachTableName.Initiatives} (
      initiative_id,
      organization_id,
      project_id,
      title,
      status,
      created_at,
      updated_at,
      version,
      created_by_agent_id,
      created_by_hat_assignment_id,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (initiative_id) DO NOTHING
    RETURNING initiative_id AS id
  `,
  InsertWorkItem: `
    INSERT INTO ${CockroachTableName.WorkItems} (
      work_item_id,
      organization_id,
      project_id,
      initiative_id,
      work_item_type,
      title,
      description,
      state,
      created_at,
      updated_at,
      version,
      created_by_agent_id,
      created_by_hat_assignment_id,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (work_item_id) DO NOTHING
    RETURNING work_item_id AS id
  `,
  InsertWorkAnchorTarget: `
    INSERT INTO ${CockroachTableName.WorkAnchorTargets} (
      work_anchor_target_id,
      organization_id,
      project_id,
      initiative_id,
      work_item_id,
      created_at,
      updated_at,
      version,
      created_by_agent_id,
      created_by_hat_assignment_id,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (work_anchor_target_id) DO NOTHING
    RETURNING work_anchor_target_id AS id
  `,
  FindWorkItemForTransition: `
    SELECT
      work_item_id,
      organization_id,
      project_id,
      initiative_id,
      work_item_type,
      title,
      description,
      state,
      created_at,
      updated_at,
      version,
      created_by_agent_id,
      created_by_hat_assignment_id,
      correlation_id,
      causation_id,
      trace_id
    FROM ${CockroachTableName.WorkItems}
    WHERE work_item_id = $1
    FOR UPDATE
  `,
  FindTransitionId: `
    SELECT work_state_transition_id AS id
    FROM ${CockroachTableName.WorkItemStateHistory}
    WHERE work_state_transition_id = $1
  `,
  FindTransitionSequence: `
    SELECT work_state_transition_id AS id
    FROM ${CockroachTableName.WorkItemStateHistory}
    WHERE work_item_id = $1 AND sequence = $2
  `,
  UpdateWorkItemForTransition: `
    UPDATE ${CockroachTableName.WorkItems}
    SET
      title = $1,
      description = $2,
      state = $3,
      initiative_id = $4,
      work_item_type = $5,
      updated_at = $6,
      version = $7,
      correlation_id = $8,
      causation_id = $9,
      trace_id = $10
    WHERE work_item_id = $11 AND version = $12
    RETURNING work_item_id AS id
  `,
  InsertWorkItemStateHistory: `
    INSERT INTO ${CockroachTableName.WorkItemStateHistory} (
      work_state_transition_id,
      organization_id,
      project_id,
      work_item_id,
      sequence,
      from_state,
      to_state,
      evidence_artifact_ids,
      assigned_engineer_hat_assignment_id,
      scheduled_work_block_id,
      transitioned_at,
      transitioned_by_agent_id,
      transitioned_by_hat_assignment_id,
      updated_at,
      version,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::JSONB, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    ON CONFLICT DO NOTHING
    RETURNING work_state_transition_id AS id
  `,
} as const;
