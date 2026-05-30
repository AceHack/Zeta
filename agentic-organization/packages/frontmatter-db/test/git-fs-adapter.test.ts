import { equal } from "node:assert/strict";
import { test } from "node:test";
import { EventOp, asZetaIdDecimal, zetaIdWithTimestamp, type FrontmatterEvent } from "../src/event.ts";
import { serializeEvent } from "../src/event-codec.ts";
import { createGitFsAdapter, eventFilePath, type EventFileSystem } from "../src/git-fs-adapter.ts";

function fakeFs(seed: Record<string, string> = {}): EventFileSystem & { files: Map<string, string> } {
  const files = new Map<string, string>(Object.entries(seed));
  return {
    files,
    async listEventFiles(table: string): Promise<readonly string[]> {
      const prefix = `events/${table}/`;
      return [...files.keys()].filter((p) => p.startsWith(prefix));
    },
    async readEventFile(path: string): Promise<string> {
      const contents = files.get(path);
      if (contents === undefined) throw new Error(`no such file ${path}`);
      return contents;
    },
    async writeEventFile(path: string, contents: string): Promise<void> {
      files.set(path, contents);
    },
  };
}

function ev(ms: number, agg: string, status: string): FrontmatterEvent {
  return { id: zetaIdWithTimestamp(ms), table: "task", aggregateId: asZetaIdDecimal(agg), op: EventOp.Upsert, schemaVersion: 1, fields: { id: agg, status } };
}

test("load reads existing event files into the snapshot", async () => {
  const a = ev(100, "1", "ready");
  const fs = fakeFs({ [eventFilePath("task", a.id)]: serializeEvent(a) });
  const adapter = createGitFsAdapter(fs);
  const result = await adapter.load("task");
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.loaded, 1);
  equal(adapter.readEvents("task").length, 1);
});

test("appendEvent buffers then flush writes the file", async () => {
  const fs = fakeFs();
  const adapter = createGitFsAdapter(fs);
  await adapter.load("task");
  const e = ev(200, "2", "done");
  adapter.appendEvent(e);
  equal(adapter.pendingCount(), 1);
  equal(fs.files.has(eventFilePath("task", e.id)), false);
  const flushed = await adapter.flush();
  equal(flushed.written, 1);
  equal(adapter.pendingCount(), 0);
  equal(fs.files.has(eventFilePath("task", e.id)), true);
});

test("an unparseable event file yields feedback", async () => {
  const fs = fakeFs({ "events/task/123.md": "not even frontmatter" });
  const adapter = createGitFsAdapter(fs);
  const result = await adapter.load("task");
  equal(result.outcome, "feedback");
});

test("appended events are visible to readEvents before flush", async () => {
  const adapter = createGitFsAdapter(fakeFs());
  await adapter.load("task");
  adapter.appendEvent(ev(300, "3", "ready"));
  equal(adapter.readEvents("task").length, 1);
});
