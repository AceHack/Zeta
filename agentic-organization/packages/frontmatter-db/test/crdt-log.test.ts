import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { appendEvent, emptyLog, fromEvents, mergeLogs, type EventLog } from "../src/crdt-log.ts";
import { EventOp, zetaIdWithTimestamp, type FrontmatterEvent } from "../src/event.ts";
import { asZetaIdDecimal } from "../src/event.ts";

function ev(ms: number, agg: string, fields: Record<string, string> = {}): FrontmatterEvent {
  return {
    id: zetaIdWithTimestamp(ms),
    table: "task",
    aggregateId: asZetaIdDecimal(agg),
    op: EventOp.Upsert,
    schemaVersion: 1,
    fields,
  };
}

function ids(log: EventLog): string[] {
  return [...log.keys()].sort();
}

const a = ev(100, "1");
const b = ev(200, "1");
const c = ev(300, "2");

test("merge is commutative", () => {
  const ab = mergeLogs(fromEvents([a, b]), fromEvents([c]));
  const ba = mergeLogs(fromEvents([c]), fromEvents([a, b]));
  deepEqual(ids(ab), ids(ba));
});

test("merge is associative", () => {
  const left = mergeLogs(mergeLogs(fromEvents([a]), fromEvents([b])), fromEvents([c]));
  const right = mergeLogs(fromEvents([a]), mergeLogs(fromEvents([b]), fromEvents([c])));
  deepEqual(ids(left), ids(right));
});

test("merge is idempotent (same unique ids dedupe, no conflict)", () => {
  const log = fromEvents([a, b, c]);
  const merged = mergeLogs(log, log);
  equal(merged.size, 3);
  deepEqual(ids(merged), ids(log));
});

test("distinct unique ids never collide on union", () => {
  // two agents each append an event concurrently; union keeps both
  let agent1 = emptyLog();
  agent1 = appendEvent(agent1, ev(400, "3", { status: "ready" }));
  let agent2 = emptyLog();
  agent2 = appendEvent(agent2, ev(500, "3", { status: "done" }));
  const merged = mergeLogs(agent1, agent2);
  equal(merged.size, 2);
});
