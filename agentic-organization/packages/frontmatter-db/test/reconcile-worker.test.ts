import { equal } from "node:assert/strict";
import { test } from "node:test";
import { createInMemoryCockroachRowSink } from "../src/cockroach-row-sink.ts";
import { EventOp, asZetaIdDecimal, zetaIdWithTimestamp, type FrontmatterEvent, type ZetaIdDecimal } from "../src/event.ts";
import { serializeEvent } from "../src/event-codec.ts";
import { createGitFsAdapter, eventFilePath, type EventFileSystem } from "../src/git-fs-adapter.ts";
import { ReconcileCycleStatus, createReconcileWorker } from "../src/reconcile-worker.ts";
import type { IdGenerator } from "../src/sync.ts";

function fakeFs(seed: Record<string, string> = {}): EventFileSystem & { files: Map<string, string> } {
  const files = new Map<string, string>(Object.entries(seed));
  return {
    files,
    async listEventFiles(table) {
      const prefix = `events/${table}/`;
      return [...files.keys()].filter((p) => p.startsWith(prefix));
    },
    async readEventFile(path) {
      const c = files.get(path);
      if (c === undefined) throw new Error(`no such file ${path}`);
      return c;
    },
    async writeEventFile(path, contents) {
      files.set(path, contents);
    },
  };
}

function ev(ms: number, agg: string, status: string): FrontmatterEvent {
  return { id: zetaIdWithTimestamp(ms), table: "task", aggregateId: asZetaIdDecimal(agg), op: EventOp.Upsert, schemaVersion: 1, fields: { id: agg, status } };
}

function counterIds(start: number): IdGenerator {
  let n = start;
  return { nextEventId: (): ZetaIdDecimal => zetaIdWithTimestamp(n++) };
}

test("git->index projects rows into the index on a cycle", async () => {
  const a = ev(100, "1", "ready");
  const fs = fakeFs({ [eventFilePath("task", a.id)]: serializeEvent(a) });
  const sink = createInMemoryCockroachRowSink();
  const worker = createReconcileWorker({ tables: ["task"], gitAdapter: createGitFsAdapter(fs), indexSink: sink, ids: counterIds(5000) });

  // clear the change-set created by git->index upsert so we measure only that direction
  const result = await worker.runOnce();
  equal(result.status, ReconcileCycleStatus.Worked);
  const taskSummary = result.tables.find((t) => t.table === "task");
  equal(taskSummary?.upserted, 1);
  equal(sink.currentRows("task").get(asZetaIdDecimal("1"))?.values.status, "ready");
});

test("index->git emits an event file for a row the index added locally", async () => {
  const fs = fakeFs();
  const sink = createInMemoryCockroachRowSink();
  // a row exists only in the index (e.g. written by the command pipeline)
  sink.upsertRow({ table: "task", values: { id: "42", status: "in_progress" } });

  const worker = createReconcileWorker({ tables: ["task"], gitAdapter: createGitFsAdapter(fs), indexSink: sink, ids: counterIds(6000) });
  const result = await worker.runOnce();

  equal(result.status, ReconcileCycleStatus.Worked);
  // one event file written to the working tree for aggregate 42
  const written = [...fs.files.keys()];
  equal(written.length, 1);
  equal(result.written, 1);
});

test("a second cycle does not re-emit already-reconciled rows", async () => {
  const fs = fakeFs();
  const sink = createInMemoryCockroachRowSink();
  sink.upsertRow({ table: "task", values: { id: "42", status: "in_progress" } });
  const worker = createReconcileWorker({ tables: ["task"], gitAdapter: createGitFsAdapter(fs), indexSink: sink, ids: counterIds(7000) });

  await worker.runOnce();
  const filesAfterFirst = fs.files.size;
  const second = await worker.runOnce();

  equal(fs.files.size, filesAfterFirst, "no new event files on the second cycle");
  equal(second.tables.find((t) => t.table === "task")?.emitted, 0);
});

test("an unparseable event file degrades the cycle on the load lane", async () => {
  const fs = fakeFs({ "events/task/9.md": "garbage" });
  const sink = createInMemoryCockroachRowSink();
  const worker = createReconcileWorker({ tables: ["task"], gitAdapter: createGitFsAdapter(fs), indexSink: sink, ids: counterIds(8000) });
  const result = await worker.runOnce();
  equal(result.status, ReconcileCycleStatus.Degraded);
  equal(result.failures[0]?.lane, "load");
});
