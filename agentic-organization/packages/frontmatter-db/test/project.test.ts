import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { fromEvents, mergeLogs } from "../src/crdt-log.ts";
import { EventOp, asZetaIdDecimal, zetaIdWithTimestamp, type FrontmatterEvent } from "../src/event.ts";
import { project, type Projection } from "../src/project.ts";

function ev(ms: number, agg: string, op: FrontmatterEvent["op"], fields: Record<string, string> = {}): FrontmatterEvent {
  return { id: zetaIdWithTimestamp(ms), table: "task", aggregateId: asZetaIdDecimal(agg), op, schemaVersion: 1, fields };
}

function comparable(p: Projection): Array<[string, Record<string, unknown>]> {
  return [...p.entries()].map(([id, row]) => [id, row.values] as [string, Record<string, unknown>]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
}

test("fold applies last-writer-wins by ZetaId timestamp", () => {
  const log = fromEvents([
    ev(100, "1", EventOp.Upsert, { status: "ready", title: "t" }),
    ev(200, "1", EventOp.Upsert, { status: "done" }),
  ]);
  const p = project(log, "task");
  equal(p.get(asZetaIdDecimal("1"))?.values.status, "done");
  equal(p.get(asZetaIdDecimal("1"))?.values.title, "t");
});

test("retract tombstones the aggregate; later upsert revives it", () => {
  const dropped = project(fromEvents([
    ev(100, "1", EventOp.Upsert, { status: "ready" }),
    ev(200, "1", EventOp.Retract),
  ]), "task");
  equal(dropped.has(asZetaIdDecimal("1")), false);

  const revived = project(fromEvents([
    ev(100, "1", EventOp.Upsert, { status: "ready" }),
    ev(200, "1", EventOp.Retract),
    ev(300, "1", EventOp.Upsert, { status: "reopened" }),
  ]), "task");
  equal(revived.get(asZetaIdDecimal("1"))?.values.status, "reopened");
});

test("projection converges regardless of merge order (CRDT property)", () => {
  const e1 = ev(100, "1", EventOp.Upsert, { status: "ready" });
  const e2 = ev(200, "1", EventOp.Upsert, { status: "done" });
  const shared = ev(150, "2", EventOp.Upsert, { title: "x" });

  const logA = fromEvents([e1, shared]);
  const logB = fromEvents([e2, shared]);

  const ab = project(mergeLogs(logA, logB), "task");
  const ba = project(mergeLogs(logB, logA), "task");

  deepEqual(comparable(ab), comparable(ba));
  equal(ab.get(asZetaIdDecimal("1"))?.values.status, "done");
  equal(ab.get(asZetaIdDecimal("2"))?.values.title, "x");
});

test("only the requested table projects", () => {
  const log = fromEvents([
    ev(100, "1", EventOp.Upsert, { status: "ready" }),
    { id: zetaIdWithTimestamp(110), table: "project", aggregateId: asZetaIdDecimal("9"), op: EventOp.Upsert, schemaVersion: 1, fields: { name: "p" } },
  ]);
  equal(project(log, "task").size, 1);
  equal(project(log, "project").size, 1);
});
