import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { MemoryOperation, type MemoryAttribution } from "../../memory/src/index.ts";
import {
  createCockroachMemory,
  type CockroachAnySqlStatement,
  type CockroachGenericSqlExecutor,
} from "../src/index.ts";

function attribution(overrides: Partial<MemoryAttribution> = {}): MemoryAttribution {
  return {
    agentId: "agent-1",
    hatAssignmentId: "hat-1",
    projectId: "proj-1",
    workItemId: "wi-1",
    promptFlowRunId: "pf-1",
    ...overrides,
  };
}

describe("cockroach hindsight memory (durable, scoped, sticky)", () => {
  test("retain inserts a durable memory row attributed to the writing hat", async () => {
    const executor = recordingExecutor([]);
    const memory = createCockroachMemory({ executor, idGenerator: { nextMemoryId: () => "mem-1" }, clock: { now: () => 1000 } });

    const result = await memory.retain(attribution(), "the api needs pagination");

    equal(result.operation, MemoryOperation.Retain);
    equal(result.memory.memoryId, "mem-1");
    equal(result.memory.content, "the api needs pagination");
    const insert = executor.statements[0];
    equal(insert?.sql.includes("INSERT INTO agentic_org_hindsight_memory"), true);
    deepEqual(insert?.parameters, ["mem-1", "agent-1", "hat-1", "proj-1", "wi-1", "pf-1", "the api needs pagination"]);
  });

  test("recall is SCOPED by project (never global) and maps rows to the sticky author", async () => {
    const executor = recordingExecutor([
      {
        memory_id: "mem-1",
        agent_id: "author-agent",
        hat_assignment_id: "author-hat",
        project_id: "proj-1",
        work_item_id: "wi-9",
        prompt_flow_run_id: "pf-9",
        content: "prior lesson",
        retained_at_ms: 500,
      },
    ]);
    const memory = createCockroachMemory({ executor });

    // a DIFFERENT hat recalls; the memory keeps its ORIGINAL (sticky) attribution
    const result = await memory.recall(attribution({ agentId: "reader-agent", hatAssignmentId: "reader-hat" }));

    equal(result.operation, MemoryOperation.Recall);
    equal(executor.statements[0]?.sql.includes("WHERE project_id = $1"), true);
    equal(executor.statements[0]?.parameters[0], "proj-1");
    deepEqual(result.memories, [
      {
        memoryId: "mem-1",
        attribution: {
          agentId: "author-agent",
          hatAssignmentId: "author-hat",
          projectId: "proj-1",
          workItemId: "wi-9",
          promptFlowRunId: "pf-9",
        },
        content: "prior lesson",
        retainedAtMs: 500,
      },
    ]);
  });

  test("reflect summarizes the in-scope memory count", async () => {
    const executor = recordingExecutor([{ considered_count: 3 }]);
    const memory = createCockroachMemory({ executor });

    const result = await memory.reflect(attribution());

    equal(result.operation, MemoryOperation.Reflect);
    equal(result.consideredCount, 3);
    equal(result.summary.includes("3"), true);
    equal(executor.statements[0]?.sql.includes("count(*)"), true);
  });
});

function recordingExecutor(rows: readonly Record<string, unknown>[]): CockroachGenericSqlExecutor & {
  statements: CockroachAnySqlStatement[];
} {
  const statements: CockroachAnySqlStatement[] = [];
  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
      statements.push(statement);
      return { rows: rows as readonly Row[] };
    },
    executeTransaction: async (operation) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
          statements.push(statement);
          return { rows: rows as readonly Row[] };
        },
      }),
  };
}
