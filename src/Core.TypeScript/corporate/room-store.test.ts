/**
 * room-store.test.ts — two processes writing to one conversation without losing a word.
 *
 * The property: the server appends what a person said while the run appends what the agent said,
 * and neither can erase the other. That is why the room is a directory of events rather than a file
 * each rewrites — the thing a rewrite would erase is a message somebody typed.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { RoomState } from "./iteration-room";
import { appendRoomEvent, foldRoom, loadRoom, loadRooms, readRoomEvents, type RoomEvent } from "./room-store";

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "zeta-rooms-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    if (d !== undefined) rmSync(d, { recursive: true, force: true });
  }
});

const T0 = 1_700_000_000_000;

const opened: RoomEvent = {
  kind: "opened",
  roomId: "room-1",
  workId: "task-015",
  gate: "architecture_approval",
  documentPath: "docs/architecture_design.md",
  withHatId: "architect",
  openedBy: "Max Chadaev",
  atMs: T0,
  baselineText: "# Architecture\n\nWrite the blob first.",
};

describe("TWO WRITERS, NOTHING LOST", () => {
  test("a person's turn and an agent's turn both survive", () => {
    const dir = tempDir();
    appendRoomEvent(dir, opened);
    // The server writes this one.
    appendRoomEvent(dir, { kind: "turn", roomId: "room-1", turnId: "t1", speakerKind: "person", speaker: "Max", text: "what about a partial write?", atMs: T0 + 1 });
    // The run writes this one, with no knowledge of the first.
    appendRoomEvent(dir, { kind: "turn", roomId: "room-1", turnId: "t2", speakerKind: "hat", speaker: "architect", text: "covered by the retry", atMs: T0 + 2 });
    const room = loadRoom(dir, "room-1");
    expect(room?.turns.map((t) => t.turnId)).toEqual(["t1", "t2"]);
  });

  test("an interleaved revision does not overwrite the messages around it", () => {
    const dir = tempDir();
    appendRoomEvent(dir, opened);
    appendRoomEvent(dir, { kind: "turn", roomId: "room-1", turnId: "t1", speakerKind: "person", speaker: "Max", text: "fix it", atMs: T0 + 1 });
    appendRoomEvent(dir, { kind: "revision", roomId: "room-1", revision: 2, byHatId: "architect", text: "second draft", atMs: T0 + 2, inResponseToTurnId: "t1" });
    appendRoomEvent(dir, { kind: "turn", roomId: "room-1", turnId: "t2", speakerKind: "person", speaker: "Max", text: "better", atMs: T0 + 3 });
    const room = loadRoom(dir, "room-1");
    expect(room?.turns.length).toBe(2);
    expect(room?.revisions.length).toBe(2);
  });

  test("the baseline is revision 1, so a rewrite has something to be a rewrite of", () => {
    const dir = tempDir();
    appendRoomEvent(dir, opened);
    expect(loadRoom(dir, "room-1")?.revisions[0]?.text).toContain("blob first");
  });

  test("write order is fold order, even past ten events", () => {
    // The filenames are padded for exactly this: an unpadded `10` sorts before `2`.
    const dir = tempDir();
    appendRoomEvent(dir, opened);
    for (let i = 1; i <= 12; i++) {
      appendRoomEvent(dir, { kind: "turn", roomId: "room-1", turnId: `t${String(i)}`, speakerKind: "person", speaker: "Max", text: `m${String(i)}`, atMs: T0 + i });
    }
    expect(loadRoom(dir, "room-1")?.turns.map((t) => t.text)).toEqual(
      Array.from({ length: 12 }, (_, i) => `m${String(i + 1)}`),
    );
  });
});

describe("FOLDING", () => {
  test("a duplicated turn is not replayed twice", () => {
    const dir = tempDir();
    appendRoomEvent(dir, opened);
    const turn: RoomEvent = { kind: "turn", roomId: "room-1", turnId: "t1", speakerKind: "person", speaker: "Max", text: "hi", atMs: T0 + 1 };
    appendRoomEvent(dir, turn);
    appendRoomEvent(dir, turn);
    expect(loadRoom(dir, "room-1")?.turns.length).toBe(1);
  });

  test("closing carries which revision was approved", () => {
    const dir = tempDir();
    appendRoomEvent(dir, opened);
    appendRoomEvent(dir, { kind: "closed", roomId: "room-1", state: "converged", byHuman: "Max", reason: "good", atMs: T0 + 9, approvedRevision: 1 });
    const room = loadRoom(dir, "room-1");
    expect(room?.state).toBe(RoomState.Converged);
    expect(room?.approvedRevision).toBe(1);
  });

  test("a transcript with no header is not a room", () => {
    // Inventing one would produce a conversation about no document.
    expect(foldRoom([{ kind: "turn", roomId: "x", turnId: "t1", speakerKind: "person", speaker: "M", text: "hi", atMs: T0 }])).toBeUndefined();
    expect(foldRoom([])).toBeUndefined();
  });

  test("a corrupt event file loses one turn, not the conversation", () => {
    const dir = tempDir();
    appendRoomEvent(dir, opened);
    appendRoomEvent(dir, { kind: "turn", roomId: "room-1", turnId: "t1", speakerKind: "person", speaker: "Max", text: "first", atMs: T0 + 1 });
    writeFileSync(join(dir, "room-1", "000003-turn.json"), "{broken", "utf-8");
    appendRoomEvent(dir, { kind: "turn", roomId: "room-1", turnId: "t3", speakerKind: "person", speaker: "Max", text: "third", atMs: T0 + 3 });
    const room = loadRoom(dir, "room-1");
    expect(room?.turns.map((t) => t.text)).toEqual(["first", "third"]);
  });

  test("a room id cannot address a directory outside the store", () => {
    // CONTAINMENT is the property, not the absence of dots. A name containing `..` traverses
    // nothing as long as it is one segment — and asserting "no dots" fails on a perfectly safe
    // name. That mistake has been made three times in this repository now; this is the right
    // assertion: whatever the store created resolves inside the store.
    const dir = tempDir();
    const written = appendRoomEvent(dir, { ...opened, roomId: "../../escape" });
    expect(resolve(written).startsWith(resolve(dir) + sep)).toBe(true);
    // And it is exactly one level down, so the id became a directory NAME rather than a path.
    expect(relative(resolve(dir), resolve(written)).split(sep).length).toBe(2);
  });
});

describe("LISTING", () => {
  test("rooms come back newest first", () => {
    const dir = tempDir();
    appendRoomEvent(dir, { ...opened, roomId: "old", atMs: T0 });
    appendRoomEvent(dir, { ...opened, roomId: "new", atMs: T0 + 1000 });
    expect(loadRooms(dir).map((r) => r.roomId)).toEqual(["new", "old"]);
  });

  test("an empty store lists nothing rather than throwing", () => {
    expect(loadRooms(tempDir())).toEqual([]);
    expect(readRoomEvents(tempDir(), "nope")).toEqual([]);
  });
});
