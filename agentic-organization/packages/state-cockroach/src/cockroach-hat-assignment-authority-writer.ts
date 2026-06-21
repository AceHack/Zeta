import type {
  HatAssignmentAuthorityGrant,
  HatAssignmentAuthorityWriterPort,
} from "../../application/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachHatAssignmentAuthoritySqlExecutor } from "./cockroach-hat-assignment-authority-reader.ts";

export const CockroachHatAssignmentAuthorityWriterStatement = {
  GrantHatAssignmentAuthority: "grant_hat_assignment_authority",
} as const;

export type CockroachHatAssignmentAuthorityWriterStatement =
  (typeof CockroachHatAssignmentAuthorityWriterStatement)[keyof typeof CockroachHatAssignmentAuthorityWriterStatement];

export type CreateCockroachHatAssignmentAuthorityWriterInput = {
  executor: CockroachHatAssignmentAuthoritySqlExecutor;
};

export function createCockroachHatAssignmentAuthorityWriter(
  input: CreateCockroachHatAssignmentAuthorityWriterInput,
): HatAssignmentAuthorityWriterPort {
  return {
    grantHatAssignmentAuthority: async (grant: HatAssignmentAuthorityGrant) => {
      await input.executor.execute({
        name: CockroachHatAssignmentAuthorityWriterStatement.GrantHatAssignmentAuthority,
        sql: CockroachHatAssignmentAuthorityWriterSql.GrantHatAssignmentAuthority,
        parameters: [
          grant.hatAssignmentId,
          grant.hatId,
          grant.organizationId,
          grant.projectId,
          grant.teamId ?? null,
          grant.assignedAgentId,
          grant.state,
          grant.updatedAt,
          grant.version,
          grant.correlationId,
          grant.causationId,
          grant.traceId,
        ],
      });
    },
  };
}

const CockroachHatAssignmentAuthorityWriterSql = {
  GrantHatAssignmentAuthority: `
    UPSERT INTO ${CockroachTableName.HatAssignmentAuthorities} (
      hat_assignment_id,
      hat_id,
      organization_id,
      project_id,
      team_id,
      assigned_agent_id,
      state,
      updated_at,
      version,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `,
} as const;
