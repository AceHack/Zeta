// tools/accelerator/event-store-schema.test.ts
//
// Tests for the git-event-store schema @1 (Action Item 2). Verifies the schema
// composes with state-machine.ts's DUs + the invariants hold by construction.

import { describe, expect, test } from "bun:test";
import type { AgentContext, AgentState, MenuOption } from "../agent-loop/state-machine.ts";
import { transition } from "../agent-loop/state-machine.ts";
import {
  CURRENT_SCHEMA,
  eventPath,
  isUlid,
  isZetaIdHex,
  makeRetractionEvent,
  makeTransitionEvent,
  type BuildDeps,
  type ZetaIdHex,
  validateEnvelope,
} from "./event-store-schema.ts";

// Deterministic deps (DST-style): monotonic fake ZetaIdHex ids + fixed clock.
function makeDeps(seed = 0): BuildDeps {
  let n = seed;
  return {
    newId: (_sem) => (n++).toString(16).padStart(32, "0") as ZetaIdHex,
    nowIso: () => "2026-05-29T19:55:00.000Z",
  };
}

const ctx: AgentContext = { agent: "otto", cycle: 42, sessionStartIso: "2026-05-29T19:00:00.000Z" };
const idle: AgentState = { tag: "Idle", context: ctx };

describe("ZetaIdHex (@2 event key)", () => {
  test("accepts a valid 32-char lowercase-hex ZetaId", () => {
    expect(isZetaIdHex("0000000000000000000000000000007b")).toBe(true);
    expect(isZetaIdHex("deadbeefdeadbeefdeadbeefdeadbeef")).toBe(true);
  });
  test("rejects wrong length / uppercase / non-hex", () => {
    expect(isZetaIdHex("nope")).toBe(false);
    expect(isZetaIdHex("DEADBEEFDEADBEEFDEADBEEFDEADBEEF")).toBe(false); // uppercase
    expect(isZetaIdHex("0000000000000000000000000000007")).toBe(false); // 31 chars
  });
});

describe("ULID (@1 legacy back-compat)", () => {
  test("accepts a valid 26-char Crockford-base32 ULID", () => {
    expect(isUlid("01J8XQ7M0Z0000000000000000")).toBe(true);
  });
  test("rejects wrong length / illegal chars", () => {
    expect(isUlid("nope")).toBe(false);
    expect(isUlid("01J8XQ7M0Z000000000000000I")).toBe(false); // I is excluded in Crockford
  });
});

describe("makeTransitionEvent", () => {
  test("persists transition(from, option) = to with weight +1 + current schema", () => {
    const deps = makeDeps();
    const option: MenuOption = {
      tag: "PickWork",
      work: {
        id: "B-0867",
        lane: "tooling-or-ci",
        estimatedDoraContribution: 0.5,
        uncertainty: 0.2,
        trajectoryPhase: "execution",
        agentInterest: 0.9,
      },
    };
    const to = transition(idle, option); // the move-next core
    const ev = makeTransitionEvent(deps, { context: ctx, prev: null, from: idle, option, to });

    expect(ev.kind).toBe("transition");
    expect(ev.weight).toBe(1);
    expect(ev.schema).toBe(CURRENT_SCHEMA);
    expect(ev.agent).toBe("otto");
    expect(ev.cycle).toBe(42);
    expect(ev.to.tag).toBe("ExecutingWork");
    expect(validateEnvelope(ev).ok).toBe(true);
  });
});

describe("makeRetractionEvent (logical forgiveness)", () => {
  test("negates a prior event with weight -1", () => {
    const deps = makeDeps();
    const target = makeTransitionEvent(deps, {
      context: ctx,
      prev: null,
      from: idle,
      option: { tag: "EnterFreeTime", reason: "chosen rest" },
      to: transition(idle, { tag: "EnterFreeTime", reason: "chosen rest" }),
    });
    const retraction = makeRetractionEvent(deps, { context: ctx, prev: target.id, retracts: target.id });

    expect(retraction.kind).toBe("retraction");
    expect(retraction.weight).toBe(-1);
    expect(retraction.retracts).toBe(target.id);
    expect(validateEnvelope(retraction).ok).toBe(true);
  });
});

describe("eventPath is conflict-free by construction", () => {
  test("per-agent dir + unique id → distinct paths per agent", () => {
    const id = "0000000000000000000000000000007b" as ZetaIdHex;
    expect(eventPath("otto", id)).toBe("events/otto/0000000000000000000000000000007b.json");
    expect(eventPath("alexa", id)).toBe("events/alexa/0000000000000000000000000000007b.json");
    // Same id, different agent → different path → no merge collision.
    expect(eventPath("otto", id)).not.toBe(eventPath("alexa", id));
  });
});

describe("validateEnvelope catches malformed events", () => {
  test("flags invalid id, bad schema, bad weight", () => {
    const bad = {
      kind: "transition",
      id: "not-a-valid-id" as ZetaIdHex,
      schema: "bogus",
      ts: "not-a-date",
      agent: "otto",
      cycle: 1,
      prev: null,
      weight: 2,
      from: idle,
      option: { tag: "EnterFreeTime", reason: "x" },
      to: idle,
    } as unknown as Parameters<typeof validateEnvelope>[0];
    const res = validateEnvelope(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.length).toBeGreaterThanOrEqual(4);
  });

  test("accepts a legacy @1 ULID id (back-compat) but new events use ZetaIdHex", () => {
    const legacy = {
      kind: "transition",
      id: "01J8XQ7M0Z0000000000000000",
      schema: CURRENT_SCHEMA,
      ts: "2026-05-30T04:43:57.530Z",
      agent: "otto",
      cycle: 0,
      prev: null,
      weight: 1,
      from: idle,
      option: { tag: "EnterFreeTime", reason: "x" },
      to: idle,
    } as unknown as Parameters<typeof validateEnvelope>[0];
    expect(validateEnvelope(legacy).ok).toBe(true); // isEventId accepts the legacy ULID
  });
});
