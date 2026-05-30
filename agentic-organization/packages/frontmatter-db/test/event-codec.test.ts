import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { EventOp, asZetaIdDecimal, zetaIdWithTimestamp, type FrontmatterEvent } from "../src/event.ts";
import { EventCodecFeedbackReason, parseEvent, serializeEvent } from "../src/event-codec.ts";

test("serializeEvent rejects a field key in the reserved $ namespace (no metadata spoofing)", () => {
  const event: FrontmatterEvent = {
    id: zetaIdWithTimestamp(1000),
    table: "task",
    aggregateId: asZetaIdDecimal("7"),
    op: EventOp.Upsert,
    schemaVersion: 1,
    fields: { $id: "999", title: "spoof attempt" },
  };
  throws(() => serializeEvent(event), /reserved '\$' namespace/);
});

function sampleEvent(): FrontmatterEvent {
  return {
    id: zetaIdWithTimestamp(1000),
    table: "task",
    aggregateId: asZetaIdDecimal("7"),
    op: EventOp.Upsert,
    schemaVersion: 2,
    fields: { status: "ready", title: "fix the thing", estimate: 3, blocked: false, reviewer_ids: ["8", "9"], code: "42" },
  };
}

test("event round-trips through serialize/parse", () => {
  const event = sampleEvent();
  const text = serializeEvent(event);
  const parsed = parseEvent(text);
  equal(parsed.outcome, "ok");
  if (parsed.outcome !== "ok") return;
  deepEqual(parsed.event, event);
});

test("reserved metadata keys are separated from field columns", () => {
  const parsed = parseEvent(serializeEvent(sampleEvent()));
  if (parsed.outcome !== "ok") throw new Error("expected ok");
  // no $-prefixed key leaks into fields
  equal(Object.keys(parsed.event.fields).some((k) => k.startsWith("$")), false);
  // number-looking string field survives as a string
  equal(parsed.event.fields.code, "42");
  equal(parsed.event.fields.estimate, 3);
});

test("retract event needs no fields", () => {
  const event: FrontmatterEvent = { id: zetaIdWithTimestamp(2000), table: "task", aggregateId: asZetaIdDecimal("7"), op: EventOp.Retract, schemaVersion: 1, fields: {} };
  const parsed = parseEvent(serializeEvent(event));
  if (parsed.outcome !== "ok") throw new Error("expected ok");
  deepEqual(parsed.event, event);
});

test("missing reserved keys yields feedback", () => {
  const parsed = parseEvent("---\nstatus: ready\n---\n");
  equal(parsed.outcome, "feedback");
  if (parsed.outcome !== "feedback") return;
  equal(parsed.feedback.reason, EventCodecFeedbackReason.MissingReserved);
});

test("unknown op yields feedback", () => {
  // build a real serialized event then tamper only the op line so quoting/keys
  // match the serializer exactly (the bad_op check is what we want to exercise)
  const valid = serializeEvent(sampleEvent());
  const tampered = valid.replace(`$op: ${EventOp.Upsert}`, "$op: explode");
  const parsed = parseEvent(tampered);
  equal(parsed.outcome, "feedback");
  if (parsed.outcome !== "feedback") return;
  equal(parsed.feedback.reason, EventCodecFeedbackReason.BadOp);
});
