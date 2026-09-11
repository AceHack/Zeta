/**
 * event-stream.test.ts — falsifiers for watching the organization work.
 *
 * The defect a live view has, that a page-refresh does not, is SILENT LOSS: a position that skips,
 * rewinds, or stalls produces a view that looks fine and is not.
 *
 * The first version of this file tested only IN-ORDER appends and passed, while the real stream was
 * dropping 161 of 318 events on a live run — because a log does not grow forward in time. That case
 * is the centrepiece here now.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { emit, OrgEventKind, type OrgEvent } from "./org-event";
import {
  advance,
  cursorOf,
  formatCursor,
  isAfter,
  parseCursor,
  seedPosition,
  sseFrame,
  undelivered,
  type StreamCursor,
  type StreamPosition,
} from "./event-stream";

const T = Date.parse("2026-09-09T10:00:00.000Z");
const HOUR = 3_600_000;

function chartOf(): OrgChart {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  return built.chart;
}
const CHART = chartOf();

function ev(id: string, atMs: number, decision = "did a thing"): OrgEvent {
  return emit(CHART, id, {
    kind: OrgEventKind.DecisionRecorded,
    subjectId: "task-1",
    decision,
    atMs,
  });
}

/** The log's canonical order — the same key `readEvents` and the fold sort by. */
function log(...events: OrgEvent[]): readonly OrgEvent[] {
  return [...events].sort((a, b) => (a.atMs === b.atMs ? (a.id < b.id ? -1 : 1) : a.atMs - b.atMs));
}

const FRESH: StreamPosition = { mark: undefined, delivered: new Set<string>() };

function idsOf(events: readonly OrgEvent[]): string[] {
  return events.map((e) => e.id);
}

function deliveredIds(frames: readonly { kind: string }[]): string[] {
  return frames
    .filter((f): f is { kind: "event"; event: OrgEvent } => f.kind === "event")
    .map((f) => f.event.id);
}

describe("THE LOG DOES NOT GROW FORWARD IN TIME", () => {
  test("an event appended LATE and stamped EARLY is still delivered", () => {
    // The measured defect. A run's life tick emits at the run's own instant (09:00) while the walk
    // has advanced a synthetic clock hours past it (16:01), so those events are written last and
    // sort first. A high-water mark steps straight over them: 161 of 318 events, silently.
    const walk = log(ev("walk-1", T), ev("walk-2", T + 6 * HOUR));
    const first = advance(walk, FRESH, T);
    expect(deliveredIds(first.frames)).toEqual(["walk-1", "walk-2"]);

    // Now the life events land — written after, timestamped before.
    const withLife = log(...walk, ev("life-1", T), ev("life-2", T));
    const second = advance(withLife, first.position, T);
    expect(deliveredIds(second.frames)).toEqual(["life-1", "life-2"]);
  });

  test("the whole log reaches the viewer exactly once, whatever order it was appended in", () => {
    const all = log(
      ev("a", T + 3 * HOUR),
      ev("b", T),
      ev("c", T + 6 * HOUR),
      ev("d", T + HOUR),
      ev("e", T + 2 * HOUR),
    );
    // Simulate five appends in an order unrelated to their instants.
    const arrival = [["a"], ["a", "b"], ["a", "b", "c"], ["a", "b", "c", "d"], idsOf(all)];
    let position = FRESH;
    const seen: string[] = [];
    for (const present of arrival) {
      const visible = log(...all.filter((e) => present.includes(e.id)));
      const step = advance(visible, position, T);
      position = step.position;
      seen.push(...deliveredIds(step.frames));
    }
    expect([...seen].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(seen.length).toBe(5); // exactly once each
  });

  test("a late early-stamped event does NOT drag the mark backwards", () => {
    const walk = log(ev("walk-1", T), ev("walk-2", T + 6 * HOUR));
    const first = advance(walk, FRESH, T);
    expect(first.position.mark?.atMs).toBe(T + 6 * HOUR);

    const withLife = log(...walk, ev("life-1", T));
    const second = advance(withLife, first.position, T);
    // Delivered, but the mark stays at the high-water point — otherwise a reconnect would resend
    // everything between the late event and the newest one.
    expect(deliveredIds(second.frames)).toEqual(["life-1"]);
    expect(second.position.mark?.atMs).toBe(T + 6 * HOUR);
  });
});

describe("nothing is delivered twice", () => {
  test("two events at the same instant are both delivered, in id order", () => {
    // A run appends many events at one logical instant — every run does, because the clock is
    // declared once per run. A position of "how many have I seen" cannot tell them apart.
    const events = log(ev("b", T), ev("a", T), ev("c", T));
    expect(deliveredIds(advance(events, FRESH, T).frames)).toEqual(["a", "b", "c"]);
  });

  test("a viewer already up to date receives nothing, not the last event again", () => {
    const events = log(ev("a", T), ev("b", T + 1000));
    const first = advance(events, FRESH, T);
    const second = advance(events, first.position, T);
    expect(second.frames.map((f) => f.kind)).toEqual(["quiet"]);
  });

  test("polling an unchanged log forever never re-sends anything", () => {
    const events = log(ev("a", T), ev("b", T + 1000));
    let position = FRESH;
    let total = 0;
    for (let i = 0; i < 5; i += 1) {
      const step = advance(events, position, T);
      position = step.position;
      total += deliveredIds(step.frames).length;
    }
    expect(total).toBe(2);
  });
});

describe("the cap takes the OLDEST undelivered", () => {
  test("capping advances continuously and leaves no hole", () => {
    const events = log(...Array.from({ length: 10 }, (_v, i) => ev(`e${String(i)}`, T + i * 1000)));
    let position = FRESH;
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const step = advance(events, position, T, 4);
      position = step.position;
      seen.push(...deliveredIds(step.frames));
    }
    // Taking the NEWEST under a cap would show the latest activity and skip the middle.
    expect(seen).toEqual(idsOf(events));
  });

  test("the cap is respected exactly", () => {
    const events = log(...Array.from({ length: 10 }, (_v, i) => ev(`e${String(i)}`, T + i * 1000)));
    expect(undelivered(events, FRESH, 4).length).toBe(4);
    expect(undelivered(events, FRESH, 1).length).toBe(1);
  });
});

describe("a quiet organization is not a broken one", () => {
  test("nothing new produces a QUIET frame, never an empty response", () => {
    const events = log(ev("a", T));
    const first = advance(events, FRESH, T);
    const second = advance(events, first.position, T + 5000);
    expect(second.frames.length).toBe(1);
    expect(second.frames[0]?.kind).toBe("quiet");
  });

  test("a quiet frame carries the mark forward unchanged, so nothing is skipped", () => {
    const events = log(ev("a", T));
    const first = advance(events, FRESH, T);
    const second = advance(events, first.position, T + 5000);
    const frame = second.frames[0];
    expect(frame?.kind === "quiet" ? frame.cursor : undefined).toEqual(cursorOf(events[0]!));
  });

  test("an empty log is quiet, not an error", () => {
    expect(advance([], FRESH, T).frames[0]?.kind).toBe("quiet");
  });

  test("activity produces event frames and no quiet frame", () => {
    const step = advance(log(ev("a", T), ev("b", T + 1)), FRESH, T + 5000);
    expect(step.frames.map((f) => f.kind)).toEqual(["event", "event"]);
  });
});

describe("resuming after a reconnect", () => {
  test("seeding from a mark treats everything at or before it as delivered", () => {
    const events = log(ev("a", T), ev("b", T + 1000), ev("c", T + 2000));
    const position = seedPosition(events, cursorOf(events[1]!));
    expect(deliveredIds(advance(events, position, T).frames)).toEqual(["c"]);
  });

  test("reconnecting MID-BURST resumes inside the instant, not past it", () => {
    // Every run emits many events at one logical instant, so a socket that drops mid-run reconnects
    // with a mark whose atMs is shared by events on both sides of it. Seeding on the instant alone
    // would mark the whole burst delivered and lose its tail permanently — the reconnect case of
    // the same defect a live run found in the forward path.
    const burst = log(ev("a", T), ev("b", T), ev("c", T), ev("d", T));
    const position = seedPosition(burst, cursorOf(burst[1]!)); // received a and b, then dropped
    expect(deliveredIds(advance(burst, position, T).frames)).toEqual(["c", "d"]);
  });

  test("seeding from nothing delivers the whole log", () => {
    const events = log(ev("a", T), ev("b", T + 1000));
    expect(seedPosition(events, undefined).delivered.size).toBe(0);
    expect(deliveredIds(advance(events, seedPosition(events, undefined), T).frames)).toEqual(["a", "b"]);
  });

  test("an older instant is behind, whatever its id sorts like", () => {
    expect(isAfter(ev("zzz", T - 1), { atMs: T, id: "aaa" })).toBe(false);
    expect(isAfter(ev("aaa", T + 1), { atMs: T, id: "zzz" })).toBe(true);
  });
});

describe("a malformed cursor is REFUSED, never rewound", () => {
  test("absent means from the beginning", () => {
    expect(parseCursor(null)).toBeUndefined();
    expect(parseCursor("")).toBeUndefined();
    expect(parseCursor("   ")).toBeUndefined();
  });

  test("garbage is invalid — silently starting over would replay the whole log into the page", () => {
    expect(parseCursor("nonsense")).toBe("invalid");
    expect(parseCursor(":no-instant")).toBe("invalid");
    expect(parseCursor("123:")).toBe("invalid");
    expect(parseCursor("notanumber:id")).toBe("invalid");
  });

  test("a cursor survives the round trip, including ids containing a colon", () => {
    const cursor: StreamCursor = { atMs: T, id: "evt-life-1789:3" };
    expect(parseCursor(formatCursor(cursor))).toEqual(cursor);
  });
});

describe("the wire format", () => {
  test("an event frame carries its cursor as the SSE id, so a browser reconnect resumes", () => {
    const event = ev("a", T);
    const frame = sseFrame({ kind: "event", event, cursor: cursorOf(event) });
    expect(frame).toContain(`id: ${String(T)}:a`);
    expect(frame).toContain("event: event");
    expect(frame.endsWith("\n\n")).toBe(true);
  });

  test("a newline in the payload cannot end the frame early", () => {
    // SSE terminates a frame on a blank line, so a raw newline in a decision would split one frame
    // into two and the tail would be parsed as a different event.
    const event = ev("a", T, "line one\n\nline two");
    const frame = sseFrame({ kind: "event", event, cursor: cursorOf(event) });
    const dataLines = frame.split("\n").filter((l) => l.startsWith("data: "));
    expect(dataLines.length).toBe(1);
    const parsed: unknown = JSON.parse(dataLines[0]!.slice("data: ".length));
    expect((parsed as { event: OrgEvent }).event.decision).toBe("line one\n\nline two");
  });

  test("a quiet frame carries no id, so it never advances a browser's Last-Event-ID", () => {
    const frame = sseFrame({ kind: "quiet", atMs: T, cursor: undefined });
    expect(frame).not.toContain("id: ");
    expect(frame).toContain("event: quiet");
  });
});
