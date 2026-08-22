import { describe, expect, test } from "bun:test";
import { deriveEntry } from "./export-cb-snapshot.ts";
import type { MessageEnvelope, SenderAgentId } from "./types.ts";

// 081M0148RV6087G0R001BN31P0 — "no traffic" must not render as "no errors".
//
// The defect these tests pin: `deriveEntry` returned CLOSED / "assuming healthy" for an
// identity with zero envelopes. That inverts the instrument — an agent still emitting idle
// heartbeats reads HALF_OPEN or OPEN, while an agent that has gone completely silent reads
// green. Deeper outage, healthier reading.

const META = { model: "Otto", harness: "Claude Code" };

let seq = 0;
function envelope(
  from: SenderAgentId,
  body: Pick<MessageEnvelope, "topic" | "payload">,
  minutesAgo = 1,
): MessageEnvelope {
  const t = new Date(Date.UTC(2026, 7, 14, 12, 0, 0) - minutesAgo * 60_000).toISOString();
  return {
    id: `test-${seq++}`,
    from,
    to: "*",
    timestamp: t,
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...body,
  } as MessageEnvelope;
}

const idle = (m: number) => envelope("otto", { topic: "heartbeat", payload: { status: "idle" } }, m);
const working = (m: number) => envelope("otto", { topic: "heartbeat", payload: { status: "working" } }, m);

describe("zero observations is UNKNOWN, never CLOSED", () => {
  test("an identity with no envelopes reads UNKNOWN, not healthy", () => {
    const entry = deriveEntry("otto", META, []);
    expect(entry.state).toBe("UNKNOWN");
    expect(entry.observations).toBe(0);
    expect(entry.note).not.toContain("assuming healthy");
    expect(entry.note).toContain("UNKNOWN");
  });

  test("a silent agent does NOT read healthier than a merely idle one", () => {
    // The inversion, stated as a property. Before the fix this failed: silent === "CLOSED",
    // idle-past-threshold === "OPEN", so total silence outranked partial liveness.
    const silent = deriveEntry("otto", META, []);
    const idling = deriveEntry("otto", META, [idle(1), idle(2), idle(3), idle(4), idle(5), idle(6)]);
    expect(idling.state).toBe("OPEN");
    expect(silent.state).not.toBe("CLOSED");
  });

  test("lastCheck is null when never observed — not a fabricated 'now'", () => {
    // The old code wrote `new Date().toISOString()`, so an agent never seen reported having
    // been checked at this instant. A timestamp for a check that observed nothing is a lie
    // whichever way the state field reads.
    expect(deriveEntry("otto", META, []).lastCheck).toBeNull();
  });

  test("traffic without health evidence is UNKNOWN, not CLOSED", () => {
    // Envelopes exist, but none carries health information. The old `else` branch called
    // this "Bus activity present; no idle pattern detected" and returned CLOSED.
    const chatter = [
      envelope("otto", { topic: "shadow-catch", payload: { content: "note" } }, 1),
      envelope("otto", { topic: "claim", payload: { action: "release", itemId: "X" } }, 2),
    ];
    const entry = deriveEntry("otto", META, chatter);
    expect(entry.state).toBe("UNKNOWN");
    expect(entry.observations).toBe(0);
    expect(entry.lastCheck).not.toBeNull();
  });
});

describe("measured states still work", () => {
  test("a working heartbeat reads CLOSED and carries its observation count", () => {
    const entry = deriveEntry("otto", META, [working(1), working(2)]);
    expect(entry.state).toBe("CLOSED");
    expect(entry.observations).toBe(2);
  });

  test("idle below threshold is HALF_OPEN", () => {
    const entry = deriveEntry("otto", META, [idle(1), idle(2), working(3)]);
    expect(entry.state).toBe("HALF_OPEN");
    expect(entry.consecutiveFailures).toBe(2);
  });

  test("idle at threshold trips OPEN", () => {
    const entry = deriveEntry("otto", META, [1, 2, 3, 4, 5].map(idle));
    expect(entry.state).toBe("OPEN");
  });

  test("a work signal resets the idle streak", () => {
    const entry = deriveEntry("otto", META, [idle(1), idle(2), working(3), idle(4), idle(5)]);
    expect(entry.consecutiveFailures).toBe(2);
    expect(entry.state).toBe("HALF_OPEN");
  });

  test("surface-tagged senders fold into one identity", () => {
    const entry = deriveEntry("otto", META, [
      envelope("otto-cli", { topic: "heartbeat", payload: { status: "working" } }, 1),
    ]);
    expect(entry.observations).toBe(1);
    expect(entry.state).toBe("CLOSED");
  });

  test("another agent's envelopes never count as this one's observations", () => {
    const entry = deriveEntry("otto", META, [
      envelope("vera-codex", { topic: "heartbeat", payload: { status: "working" } }, 1),
    ]);
    expect(entry.state).toBe("UNKNOWN");
    expect(entry.observations).toBe(0);
  });
});

describe("every CLOSED reading is a measured one", () => {
  test("no input produces CLOSED with zero observations", () => {
    // The invariant in one line: CLOSED implies observations > 0. Exhaustive over the small
    // envelope shapes the deriver can see, so it is a check that could fail, not a slogan.
    const shapes: MessageEnvelope[][] = [
      [],
      [idle(1)],
      [working(1)],
      [idle(1), idle(2), idle(3), idle(4), idle(5)],
      [envelope("otto", { topic: "shadow-catch", payload: { content: "x" } }, 1)],
      [envelope("otto", { topic: "claim", payload: { action: "claim", itemId: "X" } }, 1)],
      [envelope("otto", { topic: "claim", payload: { action: "release", itemId: "X" } }, 1)],
    ];
    for (const shape of shapes) {
      const entry = deriveEntry("otto", META, shape);
      if (entry.state === "CLOSED") expect(entry.observations).toBeGreaterThan(0);
    }
  });
});
