import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { HatAssignmentAuthorityState } from "../../domain/src/index.ts";
import {
  CockroachHatAssignmentAuthorityReaderStatement,
  createCockroachHatAssignmentAuthorityReader,
  type CockroachHatAssignmentAuthoritySqlExecutor,
  type CockroachHatAssignmentAuthoritySqlStatement,
} from "../src/index.ts";

describe("cockroach hat assignment authority reader", () => {
  test("reads active hat assignment authority behind the generic application port", async () => {
    const executor = createRecordingExecutor();
    const reader = createCockroachHatAssignmentAuthorityReader({ executor });

    const authority = await reader.findHatAssignmentAuthority("hat-assignment-dev-001");

    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachHatAssignmentAuthorityReaderStatement.FindHatAssignmentAuthority,
    ]);
    deepEqual(executor.statements[0]?.parameters, ["hat-assignment-dev-001"]);
    deepEqual(authority, {
      hatAssignmentId: "hat-assignment-dev-001",
      hatId: "backend_implementer",
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      assignedAgentId: "agent-dev-001",
      state: HatAssignmentAuthorityState.Active,
    });
  });

  test("rejects malformed authority state from durable projection rows", async () => {
    const executor = createRecordingExecutor({ state: "cosplay" });
    const reader = createCockroachHatAssignmentAuthorityReader({ executor });

    equal(await reader.findHatAssignmentAuthority("hat-assignment-dev-001"), undefined);
  });

  test("rejects legacy fail-closed hat placeholders from upgraded durable rows", async () => {
    const executor = createRecordingExecutor({ hatId: "legacy_unknown_hat_assignment" });
    const reader = createCockroachHatAssignmentAuthorityReader({ executor });

    equal(await reader.findHatAssignmentAuthority("hat-assignment-dev-001"), undefined);
  });
});

function createRecordingExecutor(
  input: { hatId?: string; state?: unknown } = {},
): CockroachHatAssignmentAuthoritySqlExecutor & {
  statements: CockroachHatAssignmentAuthoritySqlStatement[];
} {
  const statements: CockroachHatAssignmentAuthoritySqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachHatAssignmentAuthoritySqlStatement) => {
      statements.push(statement);

      return {
        rows: [
          {
            hat_assignment_id: "hat-assignment-dev-001",
            hat_id: input.hatId ?? "backend_implementer",
            organization_id: "org-lfg",
            project_id: "project-agentic-org",
            team_id: "team-runtime",
            assigned_agent_id: "agent-dev-001",
            state: input.state ?? HatAssignmentAuthorityState.Active,
          },
        ] as readonly unknown[] as readonly Row[],
      };
    },
  };
}
