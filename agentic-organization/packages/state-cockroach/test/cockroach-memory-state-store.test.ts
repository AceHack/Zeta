import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  MemoryPhase,
  MemoryTier,
} from "../../domain/src/index.ts";
import {
  CockroachMemoryStateStoreStatement,
  createCockroachContextPackMemoryEnvelopeReader,
  type CockroachAnySqlStatement,
  type CockroachGenericSqlExecutor,
} from "../src/index.ts";

test("Cockroach context-pack memory envelope reader lists durable envelopes by scoped memory ids", async () => {
  const executor = recordingExecutor([
    memoryStateRow("mem-high", {
      confidence: "0.95",
      outcome: JSON.stringify({
        successCount: 5,
        failureCount: 0,
        inconclusiveCount: 0,
        workItemsObserved: ["work-1"],
      }),
      utility: JSON.stringify({
        injectedCount: 10,
        citedCount: 8,
      }),
    }),
  ]);
  const reader = createCockroachContextPackMemoryEnvelopeReader({ executor });

  const envelopes = await reader.listByMemoryIds({
    organizationId: "org-1",
    memoryIds: ["mem-high", "mem-archived"],
  });

  equal(executor.statements[0]?.name, CockroachMemoryStateStoreStatement.ListByMemoryIds);
  equal(executor.statements[0]?.sql.includes("memory_id IN ($2, $3)"), true);
  deepEqual(executor.statements[0]?.parameters, ["org-1", "mem-high", "mem-archived"]);
  equal(envelopes.length, 1);
  equal(envelopes[0]?.memoryId, "mem-high");
  equal(envelopes[0]?.tier, MemoryTier.Work);
  equal(envelopes[0]?.state.phase, MemoryPhase.Active);
  equal(envelopes[0]?.state.confidence, 0.95);
  deepEqual(envelopes[0]?.state.utility, {
    injectedCount: 10,
    citedCount: 8,
  });
});

test("Cockroach context-pack memory envelope reader avoids invalid empty memory-id lookups", async () => {
  const executor = recordingExecutor([]);
  const reader = createCockroachContextPackMemoryEnvelopeReader({ executor });

  const envelopes = await reader.listByMemoryIds({
    organizationId: "org-1",
    memoryIds: [],
  });

  deepEqual(envelopes, []);
  deepEqual(executor.statements, []);
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

function memoryStateRow(
  memoryId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    memory_id: memoryId,
    organization_id: "org-1",
    tier: MemoryTier.Work,
    scope: "work-1",
    key: `memory:${memoryId}`,
    phase: MemoryPhase.Active,
    confidence: 1,
    weight: 0.9,
    freshness_at: new Date("2026-05-31T00:00:00.000Z"),
    reinforcement_count: "2",
    protected: false,
    written_by: "memory_curator",
    written_at: new Date("2026-05-30T00:00:00.000Z"),
    context_hint: null,
    outcome: {
      successCount: 3,
      failureCount: 0,
      inconclusiveCount: 0,
      workItemsObserved: ["work-1"],
    },
    utility: {
      injectedCount: 6,
      citedCount: 6,
    },
    cross_scope: {
      distinctScopes: ["work-1"],
      firstObservedAt: "2026-05-30T00:00:00.000Z",
      lastObservedAt: "2026-05-31T00:00:00.000Z",
    },
    archived_at: null,
    ...overrides,
  };
}
