import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { describe, test } from "node:test";

import { HermesRunState } from "../../../packages/hermes/src/index.ts";
import {
  createCockroachHermesRuntime,
  createCockroachHindsightMemoryMigration,
  createCockroachHermesRunMigration,
  createCockroachMemory,
  splitSqlStatements,
  type CockroachAnySqlStatement,
} from "../../../packages/state-cockroach/src/index.ts";
import {
  createCockroachSqlExecutor,
  createCockroachWorkerShutdownPort,
  createCockroachWorkerSqlClient,
  createPgCockroachWorkerPool,
} from "../src/index.ts";

const EnvName = { DatabaseUrl: "AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL" } as const;

describe("durable Hermes runtime + Hindsight memory — live Cockroach", () => {
  test(
    "a run launches, heartbeats, completes with JSON evidence; two runs get unique ids; memory retains/recalls scoped",
    {
      skip:
        env[EnvName.DatabaseUrl] === undefined ? `${EnvName.DatabaseUrl} is not set` : false,
    },
    async () => {
      const databaseUrl = readDatabaseUrl();
      const projectId = `proj-${randomUUID()}`;
      const pool = await createPgCockroachWorkerPool({ databaseUrl });
      const sqlClient = createCockroachWorkerSqlClient({ pool, maxTransactionAttempts: 2 });
      const executor = createCockroachSqlExecutor({ client: sqlClient });
      const runIds: string[] = [];

      try {
        await applyMigrations(executor);

        const hermes = createCockroachHermesRuntime({ executor });
        const memory = createCockroachMemory({ executor });

        // --- Hermes run lifecycle (proves uniqueness + JSONB evidence) ---
        const binding = {
          workItemId: `wi-${randomUUID()}`,
          agentId: `agent-${randomUUID()}`,
          sessionId: `sess-${randomUUID()}`,
          hatAssignmentId: `hat-${randomUUID()}`,
          promptFlowRunId: `pf-${randomUUID()}`,
        };

        const launched = await hermes.launchRun(binding);
        equal(launched.outcome, "ok");
        if (launched.outcome !== "ok") return;
        runIds.push(launched.run.runId);
        equal(launched.run.state, HermesRunState.Running);

        const beat = await hermes.heartbeat(launched.run.runId);
        equal(beat.outcome, "ok");

        const completed = await hermes.completeRun(launched.run.runId, {
          summary: "triaged",
          evidenceRefs: ["pr-1", "pr-2"],
        });
        equal(completed.outcome, "ok");
        if (completed.outcome !== "ok") return;
        equal(completed.run.state, HermesRunState.Completed);

        // read back the durable run — completed, with the JSON evidence round-tripped
        const fetched = await hermes.getRun(launched.run.runId);
        equal(fetched?.state, HermesRunState.Completed);
        equal(fetched?.outcome?.summary, "triaged");
        equal(fetched?.outcome?.evidenceRefs.length, 2);

        // a SECOND run must get a UNIQUE id (the PK-collision bug the live cluster caught)
        const second = await hermes.launchRun(binding);
        equal(second.outcome, "ok");
        if (second.outcome !== "ok") return;
        runIds.push(second.run.runId);
        equal(second.run.runId !== launched.run.runId, true);

        // completing an already-completed run is feedback, not a crash
        const recomplete = await hermes.completeRun(launched.run.runId, { summary: "x", evidenceRefs: [] });
        equal(recomplete.outcome, "feedback");

        // --- Hindsight memory (proves unique ids + scoped recall) ---
        const attribution = {
          agentId: binding.agentId,
          hatAssignmentId: binding.hatAssignmentId,
          projectId,
          workItemId: binding.workItemId,
          promptFlowRunId: binding.promptFlowRunId,
        };
        await memory.retain(attribution, "lesson one");
        await memory.retain(attribution, "lesson two"); // second retain must not collide on memory_id

        const recalled = await memory.recall(attribution);
        equal(recalled.memories.length, 2);
        // recall is scoped to THIS project only
        ok(recalled.memories.every((m) => m.attribution.projectId === projectId));

        const reflected = await memory.reflect(attribution);
        equal(reflected.consideredCount, 2);
      } finally {
        await cleanUp(executor, projectId, runIds);
        await createCockroachWorkerShutdownPort({ pool }).shutdown();
      }
    },
  );
});

function readDatabaseUrl(): string {
  const url = env[EnvName.DatabaseUrl];
  if (url === undefined) {
    throw new Error(`${EnvName.DatabaseUrl} is not set`);
  }
  return url;
}

type Exec = { execute: <Row = Record<string, unknown>>(s: CockroachAnySqlStatement) => Promise<{ rows: readonly Row[] }> };

async function applyMigrations(executor: Exec): Promise<void> {
  for (const migration of [createCockroachHindsightMemoryMigration(), createCockroachHermesRunMigration()]) {
    for (const statement of splitSqlStatements(migration.sql)) {
      await executor.execute({ name: "hermes_memory_live_migration", sql: statement, parameters: [] });
    }
  }
}

async function cleanUp(executor: Exec, projectId: string, runIds: readonly string[]): Promise<void> {
  await executor
    .execute({
      name: "hermes_memory_live_cleanup_memory",
      sql: `DELETE FROM agentic_org_hindsight_memory WHERE project_id = $1`,
      parameters: [projectId],
    })
    .catch(() => undefined);
  for (const runId of runIds) {
    await executor
      .execute({
        name: "hermes_memory_live_cleanup_run",
        sql: `DELETE FROM agentic_org_hermes_run WHERE run_id = $1`,
        parameters: [runId],
      })
      .catch(() => undefined);
  }
}
