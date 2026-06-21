import type { HatAssignmentAuthorityReaderPort } from "../../application/src/index.ts";
import {
  HatAssignmentAuthorityState,
  type HatAssignmentAuthoritySnapshot,
} from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachHatAssignmentAuthorityReaderStatement = {
  FindHatAssignmentAuthority: "find_hat_assignment_authority",
} as const;

export type CockroachHatAssignmentAuthorityReaderStatement =
  (typeof CockroachHatAssignmentAuthorityReaderStatement)[keyof typeof CockroachHatAssignmentAuthorityReaderStatement];

export type CockroachHatAssignmentAuthoritySqlStatement = {
  // `string` (not the reader-only statement enum) so the same executor type is
  // shared by the reader and the sibling authority WRITER without a circular
  // import; this mirrors the underlying generic Cockroach executor (name: string).
  name: string;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachHatAssignmentAuthoritySqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachHatAssignmentAuthoritySqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachHatAssignmentAuthoritySqlStatement,
  ) => Promise<CockroachHatAssignmentAuthoritySqlResult<Row>>;
};

export type CreateCockroachHatAssignmentAuthorityReaderInput = {
  executor: CockroachHatAssignmentAuthoritySqlExecutor;
};

export function createCockroachHatAssignmentAuthorityReader(
  input: CreateCockroachHatAssignmentAuthorityReaderInput,
): HatAssignmentAuthorityReaderPort {
  return {
    findHatAssignmentAuthority: async (hatAssignmentId) =>
      mapHatAssignmentAuthorityRow((await input.executor.execute<HatAssignmentAuthorityRow>({
        name: CockroachHatAssignmentAuthorityReaderStatement.FindHatAssignmentAuthority,
        sql: CockroachHatAssignmentAuthoritySql.FindHatAssignmentAuthority,
        parameters: [hatAssignmentId],
      })).rows[0]),
  };
}

function mapHatAssignmentAuthorityRow(
  row: HatAssignmentAuthorityRow | undefined,
): HatAssignmentAuthoritySnapshot | undefined {
  if (
    row === undefined ||
    !isHatAssignmentAuthorityState(row.state) ||
    isBlank(row.hat_id) ||
    row.hat_id === "legacy_unknown_hat_assignment"
  ) {
    return undefined;
  }

  return {
    hatAssignmentId: row.hat_assignment_id,
    hatId: row.hat_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    ...(row.team_id == null ? {} : { teamId: row.team_id }),
    assignedAgentId: row.assigned_agent_id,
    state: row.state,
  };
}

function isHatAssignmentAuthorityState(value: unknown): value is HatAssignmentAuthorityState {
  return (
    typeof value === "string" &&
    Object.values(HatAssignmentAuthorityState).includes(value as HatAssignmentAuthorityState)
  );
}

type HatAssignmentAuthorityRow = {
  hat_assignment_id: string;
  hat_id: string;
  organization_id: string;
  project_id: string;
  team_id?: string | null;
  assigned_agent_id: string;
  state: unknown;
};

const CockroachHatAssignmentAuthoritySql = {
  FindHatAssignmentAuthority: `
    SELECT
      hat_assignment_id,
      hat_id,
      organization_id,
      project_id,
      team_id,
      assigned_agent_id,
      state
    FROM ${CockroachTableName.HatAssignmentAuthorities}
    WHERE hat_assignment_id = $1
  `,
} as const;

function isBlank(value: unknown): value is string {
  return typeof value !== "string" || value.trim().length === 0;
}
