import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { HatAssignmentAuthorityState } from "../../domain/src/index.ts";
import type { HatAssignmentAuthorityGrant } from "../../application/src/index.ts";
import {
  CockroachHatAssignmentAuthorityWriterStatement,
  createCockroachHatAssignmentAuthorityReader,
  createCockroachHatAssignmentAuthorityWriter,
  type CockroachHatAssignmentAuthoritySqlExecutor,
  type CockroachHatAssignmentAuthoritySqlStatement,
} from "../src/index.ts";

describe("cockroach hat assignment authority writer", () => {
  test("upserts a grant the reader then resolves as Active behind the generic ports", async () => {
    const executor = createInMemoryAuthorityExecutor();
    const writer = createCockroachHatAssignmentAuthorityWriter({ executor });
    const reader = createCockroachHatAssignmentAuthorityReader({ executor });

    await writer.grantHatAssignmentAuthority(grant());

    equal(executor.statements[0]?.name, CockroachHatAssignmentAuthorityWriterStatement.GrantHatAssignmentAuthority);
    deepEqual(await reader.findHatAssignmentAuthority("hat-assignment-reaction-engineering_manager"), {
      hatAssignmentId: "hat-assignment-reaction-engineering_manager",
      hatId: "engineering_manager",
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      assignedAgentId: "agent-reaction-engineering_manager",
      state: HatAssignmentAuthorityState.Active,
    });
  });

  test("persists a null team scope for org/project-scoped grants", async () => {
    const executor = createInMemoryAuthorityExecutor();
    const writer = createCockroachHatAssignmentAuthorityWriter({ executor });
    const reader = createCockroachHatAssignmentAuthorityReader({ executor });

    const { teamId: _omitted, ...orgScopedGrant } = grant();
    await writer.grantHatAssignmentAuthority(orgScopedGrant);

    const stored = await reader.findHatAssignmentAuthority("hat-assignment-reaction-engineering_manager");
    equal(stored?.teamId, undefined);
  });
});

function grant(): HatAssignmentAuthorityGrant {
  return {
    hatAssignmentId: "hat-assignment-reaction-engineering_manager",
    hatId: "engineering_manager",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    assignedAgentId: "agent-reaction-engineering_manager",
    state: HatAssignmentAuthorityState.Active,
    updatedAt: "2026-05-30T00:00:00.000Z",
    version: 1,
    correlationId: "evt-supervisor-signal-001",
    causationId: "evt-supervisor-signal-001",
    traceId: "evt-supervisor-signal-001",
  };
}

function createInMemoryAuthorityExecutor(): CockroachHatAssignmentAuthoritySqlExecutor & {
  statements: CockroachHatAssignmentAuthoritySqlStatement[];
} {
  const statements: CockroachHatAssignmentAuthoritySqlStatement[] = [];
  const rows = new Map<string, Record<string, unknown>>();

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachHatAssignmentAuthoritySqlStatement) => {
      statements.push(statement);
      const parameters = statement.parameters;

      if (statement.name === CockroachHatAssignmentAuthorityWriterStatement.GrantHatAssignmentAuthority) {
        rows.set(String(parameters[0]), {
          hat_assignment_id: parameters[0],
          hat_id: parameters[1],
          organization_id: parameters[2],
          project_id: parameters[3],
          team_id: parameters[4],
          assigned_agent_id: parameters[5],
          state: parameters[6],
        });
        return { rows: [] as readonly Row[] };
      }

      const row = rows.get(String(parameters[0]));
      return { rows: (row === undefined ? [] : [row]) as readonly unknown[] as readonly Row[] };
    },
  };
}
