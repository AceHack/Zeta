/**
 * org-life-fold.test.ts — a restarted organization still knows what it learned and what was said.
 *
 * The four new concepts are only part of the organization if they survive the process. A room that
 * comes back as a snapshot instead of a conversation, or a hat that stays on because a roster was
 * not updated, would each be the register quietly lying about its own state.
 */

import { describe, expect, test } from "bun:test";

import { OrgEventKind, type OrgEvent } from "./org-event";
import { foldHatsWorn, foldLearned, foldRooms } from "./org-fold";

let seq = 0;
function ev(atMs: number, fact: NonNullable<OrgEvent["fact"]>, subjectId = "s"): OrgEvent {
  return {
    id: `e-${String(seq++)}`,
    kind: OrgEventKind.DecisionRecorded,
    atMs,
    subjectId,
    decision: "recorded",
    supervisorChain: [],
    evidenceRefs: [],
    fact,
  };
}

const opened = ev(10, {
  kind: "room_opened",
  roomId: "room-1",
  workId: "task-015",
  gate: "architecture_approval",
  documentPath: "docs/architecture_design.md",
  withHatId: "architect",
  openedBy: "Max Chadaev",
});

describe("ROOMS fold by replaying the conversation", () => {
  test("a room comes back with its turns in order", () => {
    const rooms = foldRooms([
      opened,
      ev(11, { kind: "room_turn", roomId: "room-1", turnId: "t1", speakerKind: "person", speaker: "Max", text: "what about a partial write?" }),
      ev(12, { kind: "room_turn", roomId: "room-1", turnId: "t2", speakerKind: "hat", speaker: "architect", text: "covered by the retry" }),
    ]);
    const room = rooms.get("room-1");
    expect(room?.turns.map((t) => t.turnId)).toEqual(["t1", "t2"]);
    expect(room?.turns[0]?.speakerKind).toBe("person");
  });

  test("revisions come back with their text, so the document can be read at any draft", () => {
    const rooms = foldRooms([
      opened,
      ev(11, { kind: "room_revision", roomId: "room-1", revision: 1, byHatId: "architect", text: "first draft" }),
      ev(13, { kind: "room_revision", roomId: "room-1", revision: 2, byHatId: "architect", text: "second draft" }),
    ]);
    expect(rooms.get("room-1")?.revisions.map((r) => r.text)).toEqual(["first draft", "second draft"]);
  });

  test("closing records WHICH revision was approved", () => {
    const rooms = foldRooms([
      opened,
      ev(11, { kind: "room_revision", roomId: "room-1", revision: 1, byHatId: "architect", text: "d1" }),
      ev(14, { kind: "room_closed", roomId: "room-1", state: "converged", byHuman: "Max", reason: "covers it", approvedRevision: 1 }),
    ]);
    expect(rooms.get("room-1")?.state).toBe("converged");
    expect(rooms.get("room-1")?.approvedRevision).toBe(1);
  });

  test("a duplicated turn is not replayed twice", () => {
    const turn = ev(11, { kind: "room_turn", roomId: "room-1", turnId: "t1", speakerKind: "person", speaker: "Max", text: "hi" });
    expect(foldRooms([opened, turn, turn]).get("room-1")?.turns.length).toBe(1);
  });

  test("a second room_opened does not wipe the conversation", () => {
    // Losing a transcript to a duplicated event is worse than carrying one stale header field.
    const rooms = foldRooms([
      opened,
      ev(11, { kind: "room_turn", roomId: "room-1", turnId: "t1", speakerKind: "person", speaker: "Max", text: "hi" }),
      opened,
    ]);
    expect(rooms.get("room-1")?.turns.length).toBe(1);
  });

  test("a turn for a room that was never opened is dropped, not invented", () => {
    const rooms = foldRooms([
      ev(11, { kind: "room_turn", roomId: "ghost", turnId: "t1", speakerKind: "person", speaker: "Max", text: "hi" }),
    ]);
    expect(rooms.size).toBe(0);
  });
});

describe("WHAT THE ORGANIZATION LEARNED survives the process", () => {
  const wrote = (value: string, outcome: "new" | "reinforced" | "conflicted", atMs: number): OrgEvent =>
    ev(atMs, {
      kind: "memory_written",
      memoryId: "3:hat|13:code_reviewer|1:k",
      tier: "hat",
      scope: "code_reviewer",
      key: "k",
      writtenBy: "code_reviewer",
      outcome,
      value,
    });

  test("a memory comes back with its value and its author", () => {
    const learned = foldLearned([wrote("Require a rollback plan.", "new", 10)]);
    expect(learned.get("3:hat|13:code_reviewer|1:k")?.value).toBe("Require a rollback plan.");
    expect(learned.get("3:hat|13:code_reviewer|1:k")?.writtenBy).toBe("code_reviewer");
  });

  test("a CONFLICTED write does not replace the belief, matching what the writer refused to do", () => {
    // `memory.write` keeps the existing value on a conflict; a fold that took the new one would
    // resolve the argument in the log that the code refused to resolve in memory.
    const learned = foldLearned([
      wrote("Require a rollback plan.", "new", 10),
      wrote("Rollback plans are optional.", "conflicted", 20),
    ]);
    expect(learned.get("3:hat|13:code_reviewer|1:k")?.value).toBe("Require a rollback plan.");
    expect(learned.get("3:hat|13:code_reviewer|1:k")?.outcome).toBe("conflicted");
  });

  test("a phase change moves the phase and leaves the value alone", () => {
    const learned = foldLearned([
      wrote("v", "new", 10),
      ev(20, {
        kind: "memory_phase",
        memoryId: "3:hat|13:code_reviewer|1:k",
        from: "draft",
        to: "archived",
        authority: "auto",
        weight: 0.05,
        why: "fell to the floor",
      }),
    ]);
    expect(learned.get("3:hat|13:code_reviewer|1:k")?.phase).toBe("archived");
    expect(learned.get("3:hat|13:code_reviewer|1:k")?.value).toBe("v");
  });

  test("a phase change for a memory nobody wrote is dropped", () => {
    const learned = foldLearned([
      ev(20, { kind: "memory_phase", memoryId: "ghost", from: "active", to: "archived", authority: "auto", weight: 0, why: "x" }),
    ]);
    expect(learned.size).toBe(0);
  });
});

describe("WHICH HATS ARE WORN is replayed, never stored", () => {
  const move = (hatId: string, m: "don" | "doff", atMs: number): OrgEvent =>
    ev(atMs, { kind: "hat_move", hatId, move: m, why: "test" });

  test("donning adds, doffing removes", () => {
    expect([...foldHatsWorn([move("a", "don", 1), move("b", "don", 2), move("a", "doff", 3)])]).toEqual(["b"]);
  });

  test("a hat taken off cannot linger because a roster was not updated", () => {
    expect(foldHatsWorn([move("a", "don", 1), move("a", "doff", 2)]).has("a")).toBe(false);
  });

  test("donning twice is still one hat", () => {
    expect(foldHatsWorn([move("a", "don", 1), move("a", "don", 2)]).size).toBe(1);
  });

  test("doffing a hat nobody wore is not an error", () => {
    expect(foldHatsWorn([move("a", "doff", 1)]).size).toBe(0);
  });

  test("an empty log means nothing is worn — the honest default", () => {
    expect(foldHatsWorn([]).size).toBe(0);
  });
});
