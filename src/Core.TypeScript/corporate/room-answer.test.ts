/**
 * room-answer.test.ts — the agent's side of a conversation somebody is waiting in.
 *
 * The property that matters: a person waiting in a room always finds out what happened. A reviser
 * that fails, or that has nothing to add, SAYS SO in the room — because a conversation that simply
 * stops gives the person no way to tell waiting from broken.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { appendRoomEvent, loadRoom, type RoomEvent } from "./room-store";
import { answerRooms, gateAnswersFromRooms, pendingAsk, type Reviser } from "./room-answer";
import { awaitingAgent, awaitingPerson } from "./iteration-room";

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "zeta-answer-"));
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

function roomWithAsk(dir: string, roomId = "room-1"): void {
  const opened: RoomEvent = {
    kind: "opened", roomId, workId: "task-1", gate: "architecture_approval",
    documentPath: "docs/design.md", withHatId: "architect", openedBy: "Max", atMs: T0,
    baselineText: "# Design\n\nWrite the blob first.",
  };
  appendRoomEvent(dir, opened);
  appendRoomEvent(dir, {
    kind: "turn", roomId, turnId: `${roomId}-t1`, speakerKind: "person", speaker: "Max",
    text: "cover the partial-write case", atMs: T0 + 1,
  });
}

const good: Reviser = () => ({ ok: true, text: "# Design\n\nUpload, verify, then write the row." });

describe("ANSWERING PRODUCES A REVISION, not a reply", () => {
  test("a room waiting on the agent gets a new revision", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    return answerRooms(dir, good, T0 + 10).then((answered) => {
      expect(answered[0]?.outcome).toBe("revised");
      expect(answered[0]?.revision).toBe(2);
      const room = loadRoom(dir, "room-1");
      expect(room?.revisions.length).toBe(2);
      expect(room?.revisions[1]?.text).toContain("Upload, verify");
    });
  });

  test("after answering, the room is waiting on the PERSON again", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    return answerRooms(dir, good, T0 + 10).then(() => {
      const room = loadRoom(dir, "room-1");
      if (room === undefined) throw new Error("no room");
      expect(awaitingPerson(room)).toBe(true);
      expect(awaitingAgent(room)).toBe(false);
    });
  });

  test("the revision records WHICH message it answered", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    return answerRooms(dir, good, T0 + 10).then(() => {
      expect(loadRoom(dir, "room-1")?.revisions[1]?.inResponseToTurnId).toBe("room-1-t1");
    });
  });

  test("the reviser is told the draft, the ask, and the whole conversation", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    let seen: unknown;
    const spy: Reviser = (req) => {
      seen = req;
      return { ok: true, text: "changed" };
    };
    return answerRooms(dir, spy, T0 + 10).then(() => {
      const req = seen as { currentText: string; askedFor: string; transcript: unknown[]; documentPath: string };
      expect(req.currentText).toContain("blob first");
      expect(req.askedFor).toContain("partial-write");
      expect(req.documentPath).toBe("docs/design.md");
      expect(req.transcript.length).toBe(1);
    });
  });
});

describe("THE PERSON ALWAYS FINDS OUT WHAT HAPPENED", () => {
  test("a reviser that REFUSES says so in the room", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    const bad: Reviser = () => ({ ok: false, reason: "the model timed out" });
    return answerRooms(dir, bad, T0 + 10).then((answered) => {
      expect(answered[0]?.outcome).toBe("refused");
      const room = loadRoom(dir, "room-1");
      const last = room?.turns[room.turns.length - 1];
      expect(last?.text).toContain("could not revise");
      expect(last?.text).toContain("timed out");
      // And no phantom revision was created.
      expect(room?.revisions.length).toBe(1);
    });
  });

  test("a reviser that THROWS is caught and reported, not lost", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    const boom: Reviser = () => {
      throw new Error("spawn ENOENT");
    };
    return answerRooms(dir, boom, T0 + 10).then((answered) => {
      expect(answered[0]?.outcome).toBe("refused");
      expect(loadRoom(dir, "room-1")?.turns.some((t) => t.text.includes("ENOENT"))).toBe(true);
    });
  });

  test("an IDENTICAL revision is reported as no change rather than bumping the version", () => {
    // Otherwise the person re-reads a draft that is the same, and the version number lies.
    const dir = tempDir();
    roomWithAsk(dir);
    const same: Reviser = () => ({ ok: true, text: "# Design\n\nWrite the blob first." });
    return answerRooms(dir, same, T0 + 10).then((answered) => {
      expect(answered[0]?.outcome).toBe("unchanged");
      const room = loadRoom(dir, "room-1");
      expect(room?.revisions.length).toBe(1);
      expect(room?.turns[room.turns.length - 1]?.text).toContain("no change made");
    });
  });

  test("one room failing does not stop another from being answered", () => {
    const dir = tempDir();
    roomWithAsk(dir, "room-a");
    roomWithAsk(dir, "room-b");
    let first = true;
    const flaky: Reviser = () => {
      if (first) {
        first = false;
        return { ok: false, reason: "boom" };
      }
      return { ok: true, text: "the other one worked" };
    };
    return answerRooms(dir, flaky, T0 + 10).then((answered) => {
      expect(answered.length).toBe(2);
      expect(answered.map((a) => a.outcome).sort()).toEqual(["refused", "revised"]);
    });
  });
});

describe("WHAT IS NOT ANSWERED", () => {
  test("a room waiting on the PERSON is left alone", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    return answerRooms(dir, good, T0 + 10)
      .then(() => answerRooms(dir, good, T0 + 20))
      .then((second) => {
        // The agent already replied; answering again would be talking to itself.
        expect(second).toEqual([]);
      });
  });

  test("a closed room is never answered", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    appendRoomEvent(dir, { kind: "closed", roomId: "room-1", state: "converged", byHuman: "Max", reason: "fine", atMs: T0 + 5, approvedRevision: 1 });
    return answerRooms(dir, good, T0 + 10).then((answered) => expect(answered).toEqual([]));
  });

  test("pendingAsk is the last thing the person said", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    const room = loadRoom(dir, "room-1");
    if (room === undefined) throw new Error("no room");
    expect(pendingAsk(room)?.text).toContain("partial-write");
  });
});

describe("A CONVERGED ROOM IS A GATE ANSWER", () => {
  test("approving in a room answers the gate, naming the revision", () => {
    // Iterating and approving in the room is a complete path — not a detour that still needs a
    // second click somewhere else.
    const dir = tempDir();
    roomWithAsk(dir);
    appendRoomEvent(dir, {
      kind: "turn", roomId: "room-1", turnId: "room-1-t9", speakerKind: "person",
      speaker: "Max Chadaev", text: "approved revision 1: good enough", atMs: T0 + 8,
    });
    appendRoomEvent(dir, {
      kind: "closed", roomId: "room-1", state: "converged", byHuman: "Max Chadaev",
      reason: "good enough", atMs: T0 + 9, approvedRevision: 1,
    });
    const answers = gateAnswersFromRooms(dir);
    expect(answers.length).toBe(1);
    expect(answers[0]?.workId).toBe("task-1");
    expect(answers[0]?.gate).toBe("architecture_approval");
    expect(answers[0]?.revision).toBe(1);
    expect(answers[0]?.byHuman).toBe("Max Chadaev");
  });

  test("an ABANDONED room answers no gate — the work goes back, not forward", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    appendRoomEvent(dir, { kind: "closed", roomId: "room-1", state: "abandoned", byHuman: "Max", reason: "wrong approach", atMs: T0 + 9 });
    expect(gateAnswersFromRooms(dir)).toEqual([]);
  });

  test("an open room answers no gate", () => {
    const dir = tempDir();
    roomWithAsk(dir);
    expect(gateAnswersFromRooms(dir)).toEqual([]);
  });
});
