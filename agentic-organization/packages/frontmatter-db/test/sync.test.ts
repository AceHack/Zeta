import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  SyncDirection,
  syncGitToIndex,
  syncIndexToGit,
  type GitEventSource,
  type IndexRowSink,
  type IndexRowSource,
  type GitEventSink,
  type IdGenerator,
} from "../src/sync.ts";
import {
  EventOp,
  asZetaIdDecimal,
  type FrontmatterEvent,
  type ZetaIdDecimal,
} from "../src/event.ts";
import type { FrontmatterRow } from "../src/schema.ts";

const TABLE = "task";

function upsertEvent(
  eventId: string,
  aggregateId: string,
  fields: Record<string, string>,
): FrontmatterEvent {
  return {
    id: asZetaIdDecimal(eventId),
    table: TABLE,
    aggregateId: asZetaIdDecimal(aggregateId),
    op: EventOp.Upsert,
    schemaVersion: 1,
    fields,
  };
}

function retractEvent(eventId: string, aggregateId: string): FrontmatterEvent {
  return {
    id: asZetaIdDecimal(eventId),
    table: TABLE,
    aggregateId: asZetaIdDecimal(aggregateId),
    op: EventOp.Retract,
    schemaVersion: 1,
    fields: {},
  };
}

class FakeGitSource implements GitEventSource {
  private readonly events: readonly FrontmatterEvent[];
  constructor(events: readonly FrontmatterEvent[]) {
    this.events = events;
  }
  readEvents(table: string): readonly FrontmatterEvent[] {
    return this.events.filter((e) => e.table === table);
  }
}

class FakeIndexSink implements IndexRowSink {
  readonly rows = new Map<ZetaIdDecimal, FrontmatterRow>();
  upsertRow(row: FrontmatterRow): void {
    const id = String(row.values["id"]);
    this.rows.set(asZetaIdDecimal(id), row);
  }
  deleteRow(_table: string, id: ZetaIdDecimal): void {
    this.rows.delete(id);
  }
  currentRows(_table: string): ReadonlyMap<ZetaIdDecimal, FrontmatterRow> {
    return this.rows;
  }
  seed(id: string, fields: Record<string, string>): void {
    this.rows.set(asZetaIdDecimal(id), { table: TABLE, values: fields });
  }
}

class FakeIndexSource implements IndexRowSource {
  private readonly rows: readonly FrontmatterRow[];
  constructor(rows: readonly FrontmatterRow[]) {
    this.rows = rows;
  }
  changedRows(table: string): readonly FrontmatterRow[] {
    return this.rows.filter((r) => r.table === table);
  }
}

class FakeGitSink implements GitEventSink {
  readonly appended: FrontmatterEvent[] = [];
  appendEvent(event: FrontmatterEvent): void {
    this.appended.push(event);
  }
}

class FakeIdGenerator implements IdGenerator {
  private n = 0;
  nextEventId(): ZetaIdDecimal {
    this.n += 1;
    return asZetaIdDecimal(String(9_000_000_000_000 + this.n));
  }
}

test("syncGitToIndex upserts projected rows", () => {
  const source = new FakeGitSource([
    upsertEvent("1000000000001000000", "100", { id: "100", title: "a" }),
    upsertEvent("1000000000002000000", "200", { id: "200", title: "b" }),
  ]);
  const sink = new FakeIndexSink();
  const result = syncGitToIndex(TABLE, { source, sink });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.direction, SyncDirection.GitToIndex);
  equal(result.applied.upserted, 2);
  equal(result.applied.deleted, 0);
  equal(sink.rows.size, 2);
  deepEqual(sink.rows.get(asZetaIdDecimal("100"))?.values, {
    id: "100",
    title: "a",
  });
});

test("syncGitToIndex tombstone-deletes rows missing from projection", () => {
  // Aggregate 300 was retracted in git; its index row must be deleted.
  const source = new FakeGitSource([
    upsertEvent("1000000000001000000", "100", { id: "100", title: "keep" }),
    upsertEvent("1000000000002000000", "300", { id: "300", title: "old" }),
    retractEvent("1000000000003000000", "300"),
  ]);
  const sink = new FakeIndexSink();
  // Index already holds both 100 and 300 (and a stale 999 absent from git).
  sink.seed("100", { id: "100", title: "stale" });
  sink.seed("300", { id: "300", title: "stale" });
  sink.seed("999", { id: "999", title: "orphan" });

  const result = syncGitToIndex(TABLE, { source, sink });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  // Projection has only 100 -> 1 upsert; 300 and 999 are tombstoned.
  equal(result.applied.upserted, 1);
  equal(result.applied.deleted, 2);
  equal(sink.rows.has(asZetaIdDecimal("100")), true);
  equal(sink.rows.has(asZetaIdDecimal("300")), false);
  equal(sink.rows.has(asZetaIdDecimal("999")), false);
});

test("syncIndexToGit emits an Upsert event per changed row", () => {
  const source = new FakeIndexSource([
    { table: TABLE, values: { id: "100", title: "a" } },
    { table: TABLE, values: { id: "200", title: "b" } },
  ]);
  const sink = new FakeGitSink();
  const ids = new FakeIdGenerator();
  const result = syncIndexToGit(TABLE, { source, sink, ids });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok") return;
  equal(result.direction, SyncDirection.IndexToGit);
  equal(result.emitted, 2);
  equal(sink.appended.length, 2);
  equal(sink.appended[0]!.op, EventOp.Upsert);
  equal(sink.appended[0]!.aggregateId, asZetaIdDecimal("100"));
  equal(sink.appended[0]!.table, TABLE);
  deepEqual(sink.appended[1]!.fields, { id: "200", title: "b" });
});

test("syncIndexToGit returns row_missing_id feedback for a row without id", () => {
  const source = new FakeIndexSource([
    { table: TABLE, values: { title: "no-id" } },
  ]);
  const sink = new FakeGitSink();
  const ids = new FakeIdGenerator();
  const result = syncIndexToGit(TABLE, { source, sink, ids });
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, "row_missing_id");
  equal(sink.appended.length, 0);
});

test("syncIndexToGit returns row_missing_id feedback for an empty id", () => {
  const source = new FakeIndexSource([
    { table: TABLE, values: { id: "", title: "empty-id" } },
  ]);
  const sink = new FakeGitSink();
  const ids = new FakeIdGenerator();
  const result = syncIndexToGit(TABLE, { source, sink, ids });
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, "row_missing_id");
});
