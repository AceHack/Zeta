import { createHash } from "node:crypto";

import {
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  type PolicyDecisionObservation,
  type PolicyDecisionObservationQuery,
  type PolicyDecisionObservationReader,
  type PolicyDecisionObservationStore,
  type RecordPolicyDecisionObservationResult,
} from "../../policy/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachPolicyDecisionObservationStoreStatement = {
  RecordPolicyDecisionObservation: "record_policy_decision_observation",
  FindPolicyDecisionObservationHash: "find_policy_decision_observation_hash",
  FindPolicyDecisionObservations: "find_policy_decision_observations",
} as const;

export type CockroachPolicyDecisionObservationStoreStatement =
  (typeof CockroachPolicyDecisionObservationStoreStatement)[keyof typeof CockroachPolicyDecisionObservationStoreStatement];

export type CockroachPolicyDecisionObservationSqlStatement = {
  name: CockroachPolicyDecisionObservationStoreStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachPolicyDecisionObservationSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachPolicyDecisionObservationSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachPolicyDecisionObservationSqlStatement,
  ) => Promise<CockroachPolicyDecisionObservationSqlResult<Row>>;
};

export type CockroachPolicyDecisionObservationStore = PolicyDecisionObservationStore & PolicyDecisionObservationReader;

export type CreateCockroachPolicyDecisionObservationStoreInput = {
  executor: CockroachPolicyDecisionObservationSqlExecutor;
};

export function createCockroachPolicyDecisionObservationStore(
  input: CreateCockroachPolicyDecisionObservationStoreInput,
): CockroachPolicyDecisionObservationStore {
  return {
    recordPolicyDecisionObservation: async (observation) =>
      await recordPolicyDecisionObservation(input.executor, observation),
    findPolicyDecisionObservations: async (query) => await findPolicyDecisionObservations(input.executor, query),
  };
}

async function recordPolicyDecisionObservation(
  executor: CockroachPolicyDecisionObservationSqlExecutor,
  observation: PolicyDecisionObservation,
): Promise<RecordPolicyDecisionObservationResult> {
  const observationHash = createPolicyDecisionObservationHash(observation);
  const result = await executor.execute<{ policy_decision_id: string }>(
    createRecordPolicyDecisionObservationStatement(observation, observationHash),
  );

  if (result.rows[0] === undefined) {
    const existingHash = await findExistingPolicyDecisionObservationHash(executor, observation.decision.decisionId);

    if (existingHash !== observationHash) {
      return {
        status: PolicyDecisionObservationPersistenceStatus.Conflict,
      };
    }

    return {
      status: PolicyDecisionObservationPersistenceStatus.Duplicate,
    };
  }

  return {
    status: PolicyDecisionObservationPersistenceStatus.Recorded,
  };
}

async function findExistingPolicyDecisionObservationHash(
  executor: CockroachPolicyDecisionObservationSqlExecutor,
  policyDecisionId: string,
): Promise<string | undefined> {
  const result = await executor.execute<CockroachPolicyDecisionObservationHashRow>({
    name: CockroachPolicyDecisionObservationStoreStatement.FindPolicyDecisionObservationHash,
    sql: `
      SELECT observation_hash
      FROM ${CockroachTableName.PolicyObservations}
      WHERE policy_decision_id = $1
    `,
    parameters: [policyDecisionId],
  });

  return result.rows[0]?.observation_hash;
}

async function findPolicyDecisionObservations(
  executor: CockroachPolicyDecisionObservationSqlExecutor,
  query: PolicyDecisionObservationQuery,
): Promise<readonly PolicyDecisionObservation[]> {
  const result = await executor.execute<CockroachPolicyDecisionObservationRow>(
    createFindPolicyDecisionObservationsStatement(query),
  );

  return result.rows.map((row) => row.observation_json);
}

function createRecordPolicyDecisionObservationStatement(
  observation: PolicyDecisionObservation,
  observationHash: string,
): CockroachPolicyDecisionObservationSqlStatement {
  return {
    name: CockroachPolicyDecisionObservationStoreStatement.RecordPolicyDecisionObservation,
    sql: CockroachPolicyDecisionObservationSql.RecordPolicyDecisionObservation,
    parameters: [
      observation.decision.decisionId,
      observation.decision.policyVersion,
      observation.decision.status,
      observation.decision.status === PolicyDecisionStatus.Denied ? observation.decision.reason : null,
      observation.commandId,
      observation.commandType,
      observation.scope.organizationId,
      observation.scope.projectId,
      observation.scope.teamId ?? null,
      observation.scope.workItemId ?? null,
      observation.actor.agentId,
      observation.actor.hatAssignmentId,
      observation.toolType ?? null,
      observation.supervisorChain?.sourceLevel ?? null,
      observation.supervisorChain?.targetLevel ?? null,
      observation.trace.correlationId,
      observation.trace.causationId,
      observation.trace.traceId,
      observation.trace.idempotencyKey,
      observationHash,
      observation,
      observation.observedAt,
    ],
  };
}

function createPolicyDecisionObservationHash(observation: PolicyDecisionObservation): string {
  return `sha256:${createHash("sha256").update(stringifyCanonicalJson(createHashableObservation(observation))).digest("hex")}`;
}

function createHashableObservation(observation: PolicyDecisionObservation): Omit<PolicyDecisionObservation, "observedAt"> {
  const hashableObservation: Omit<PolicyDecisionObservation, "observedAt"> = {
    commandId: observation.commandId,
    commandType: observation.commandType,
    actor: observation.actor,
    scope: observation.scope,
    trace: observation.trace,
    decision: observation.decision,
  };

  if (observation.toolType !== undefined) {
    hashableObservation.toolType = observation.toolType;
  }

  if (observation.supervisorChain !== undefined) {
    hashableObservation.supervisorChain = observation.supervisorChain;
  }

  if (observation.resource !== undefined) {
    hashableObservation.resource = observation.resource;
  }

  return hashableObservation;
}

function stringifyCanonicalJson(value: unknown): string {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonicalJson(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const properties = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stringifyCanonicalJson(record[key])}`);

  return `{${properties.join(",")}}`;
}

function createFindPolicyDecisionObservationsStatement(
  query: PolicyDecisionObservationQuery,
): CockroachPolicyDecisionObservationSqlStatement {
  const conditions: string[] = [];
  const parameters: unknown[] = [];

  addCondition(conditions, parameters, "organization_id", query.organizationId);
  addOptionalCondition(conditions, parameters, "project_id", query.projectId);
  addOptionalCondition(conditions, parameters, "team_id", query.teamId);
  addOptionalCondition(conditions, parameters, "work_item_id", query.workItemId);
  addOptionalCondition(conditions, parameters, "actor_agent_id", query.agentId);
  addOptionalCondition(conditions, parameters, "actor_hat_assignment_id", query.hatAssignmentId);
  addOptionalCondition(conditions, parameters, "decision_status", query.decisionStatus);

  const limitParameter = parameters.length + 1;
  parameters.push(query.limit);

  return {
    name: CockroachPolicyDecisionObservationStoreStatement.FindPolicyDecisionObservations,
    sql: `
      SELECT observation_json
      FROM ${CockroachTableName.PolicyObservations}
      WHERE ${conditions.join(" AND ")}
      ORDER BY observed_at DESC
      LIMIT $${limitParameter}
    `,
    parameters,
  };
}

function addCondition(conditions: string[], parameters: unknown[], columnName: string, value: unknown): void {
  parameters.push(value);
  conditions.push(`${columnName} = $${parameters.length}`);
}

function addOptionalCondition(
  conditions: string[],
  parameters: unknown[],
  columnName: string,
  value: unknown | undefined,
): void {
  if (value === undefined) {
    return;
  }

  addCondition(conditions, parameters, columnName, value);
}

type CockroachPolicyDecisionObservationRow = {
  observation_json: PolicyDecisionObservation;
};

type CockroachPolicyDecisionObservationHashRow = {
  observation_hash: string;
};

const CockroachPolicyDecisionObservationSql = {
  RecordPolicyDecisionObservation: `
    INSERT INTO ${CockroachTableName.PolicyObservations} (
      policy_decision_id,
      policy_version,
      decision_status,
      denial_reason,
      command_id,
      command_type,
      organization_id,
      project_id,
      team_id,
      work_item_id,
      actor_agent_id,
      actor_hat_assignment_id,
      tool_type,
      source_level,
      target_level,
      correlation_id,
      causation_id,
      trace_id,
      idempotency_key,
      observation_hash,
      observation_json,
      observed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    ON CONFLICT (policy_decision_id) DO NOTHING
    RETURNING policy_decision_id
  `,
} as const;
