/**
 * iteration-room.test.ts — approving a document you actually read.
 *
 * The property this file exists for: an approval names a REVISION. Three drafts into a conversation
 * "approved" against a path resolves to whatever exists when it is processed, and that may be a
 * draft written after the person stopped reading. Everything else here follows from that.
 */

import { describe, expect, test } from "bun:test";

import {
  abandon,
  awaitingAgent,
  awaitingPerson,
  converge,
  isTerminalRoom,
  latestRevision,
  observationFor,
  openRoom,
  RoomState,
  revise,
  roomSummary,
  say,
  SpeakerKind,
  type IterationRoom,
} from "./iteration-room";

const T0 = 1_700_000_000_000;

function room(opening?: string): IterationRoom {
  const r = openRoom({
    roomId: "room-1",
    workId: "task-015",
    gate: "architecture_approval",
    documentPath: "docs/1637/architecture_design.md",
    withHatId: "architect",
    openedBy: "Max Chadaev",
    atMs: T0,
    currentText: "# Architecture\n\nWrite the blob first, then the row.",
    ...(opening === undefined ? {} : { opening }),
  });
  if (!r.ok) throw new Error(r.reason);
  return r.room;
}

const person = { kind: SpeakerKind.Person, id: "Max Chadaev" } as const;
const hat = { kind: SpeakerKind.Hat, id: "architect" } as const;

describe("OPENING A ROOM", () => {
  test("the current document becomes revision 1, so a rewrite has a baseline", () => {
    // Without one, "make it shorter" has nothing to be shorter than.
    const r = room();
    expect(r.revisions.length).toBe(1);
    expect(latestRevision(r)?.revision).toBe(1);
    expect(latestRevision(r)?.text).toContain("blob first");
  });

  test("an opening message is the first turn, and it is the PERSON's", () => {
    const r = room("What happens if the blob write succeeds and the row write fails?");
    expect(r.turns.length).toBe(1);
    expect(r.turns[0]?.speaker.kind).toBe(SpeakerKind.Person);
    expect(r.turns[0]?.speaker.id).toBe("Max Chadaev");
  });

  test("a room with no opening is a room you opened to read together", () => {
    expect(room().turns).toEqual([]);
  });

  test("a room needs somebody, an agent and a document", () => {
    const base = {
      roomId: "r", workId: "w", gate: "g", documentPath: "d",
      withHatId: "architect", openedBy: "Max", atMs: T0, currentText: "x",
    };
    expect(openRoom({ ...base, openedBy: " " }).ok).toBe(false);
    expect(openRoom({ ...base, withHatId: " " }).ok).toBe(false);
    expect(openRoom({ ...base, documentPath: " " }).ok).toBe(false);
  });
});

describe("A PERSON IS NOT A HAT", () => {
  test("a person speaks as themselves, with no authority borrowed", () => {
    // Borrowing a hat to make the shape fit would put a human's words under an agent's authority.
    const r = say(room(), person, "This does not cover a partial write.", T0 + 60_000);
    expect(r.ok && r.room.turns[0]?.speaker.kind).toBe(SpeakerKind.Person);
    expect(r.ok && r.room.turns[0]?.speaker.id).toBe("Max Chadaev");
  });

  test("an empty message is refused rather than posted", () => {
    expect(say(room(), person, "   ", T0).ok).toBe(false);
  });
});

describe("REVISING: the agent answers by rewriting", () => {
  test("a revision is always in response to a turn that exists", () => {
    // A rewrite nobody asked for, arriving mid-conversation, is the agent changing the thing under
    // discussion while the other party is reading it.
    const asked = say(room(), person, "Cover the partial-write case.", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const bad = revise(asked.room, { text: "new", byHatId: "architect", inResponseToTurnId: "nope", atMs: T0 + 2 });
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.reason).toContain("no turn");
  });

  test("a revision bumps the number and records what it answered", () => {
    const asked = say(room(), person, "Cover the partial-write case.", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const turnId = asked.room.turns[0]?.turnId ?? "";
    const done = revise(asked.room, {
      text: "# Architecture\n\nUpload, verify, then write the row. A partial write leaves the row absent.",
      byHatId: "architect",
      inResponseToTurnId: turnId,
      atMs: T0 + 2,
    });
    expect(done.ok && latestRevision(done.room)?.revision).toBe(2);
    expect(done.ok && latestRevision(done.room)?.inResponseToTurnId).toBe(turnId);
  });

  test("a revision also appears in the transcript, so the conversation reads in order", () => {
    const asked = say(room(), person, "fix it", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const done = revise(asked.room, {
      text: "different", byHatId: "architect", inResponseToTurnId: asked.room.turns[0]?.turnId ?? "", atMs: T0 + 2,
    });
    if (!done.ok) throw new Error("unreachable");
    expect(done.room.turns[1]?.producedRevision).toBe(2);
    expect(done.room.turns[1]?.speaker.kind).toBe(SpeakerKind.Hat);
  });

  test("an IDENTICAL revision is refused — it would manufacture progress", () => {
    const asked = say(room(), person, "fix it", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const same = revise(asked.room, {
      text: "# Architecture\n\nWrite the blob first, then the row.",
      byHatId: "architect",
      inResponseToTurnId: asked.room.turns[0]?.turnId ?? "",
      atMs: T0 + 2,
    });
    expect(same.ok).toBe(false);
    expect(same.ok === false && same.reason).toContain("identical");
  });

  test("an empty revision is refused, because it would delete the document", () => {
    const asked = say(room(), person, "fix it", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    expect(revise(asked.room, { text: "  ", byHatId: "architect", inResponseToTurnId: asked.room.turns[0]?.turnId ?? "", atMs: T0 }).ok).toBe(false);
  });
});

describe("APPROVAL NAMES A REVISION — the property this room exists for", () => {
  function twoRevisions(): IterationRoom {
    const asked = say(room(), person, "Cover the partial-write case.", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const done = revise(asked.room, {
      text: "revision two text", byHatId: "architect", inResponseToTurnId: asked.room.turns[0]?.turnId ?? "", atMs: T0 + 2,
    });
    if (!done.ok) throw new Error("unreachable");
    return done.room;
  }

  test("approving the revision you read converges the room", () => {
    const r = converge(twoRevisions(), { byHuman: "Max Chadaev", revision: 2, reason: "covers the case now", atMs: T0 + 3 });
    expect(r.ok && r.room.state).toBe(RoomState.Converged);
    expect(r.ok && r.room.approvedRevision).toBe(2);
  });

  test("approving an OLDER revision is refused, because a newer one exists you have not read", () => {
    // The whole point. Otherwise "approved" silently attaches to whatever the agent wrote last.
    const r = converge(twoRevisions(), { byHuman: "Max", revision: 1, reason: "looked fine", atMs: T0 + 3 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain("written after the one you read");
  });

  test("approving a revision that does not exist is refused", () => {
    expect(converge(twoRevisions(), { byHuman: "Max", revision: 9, reason: "x", atMs: T0 }).ok).toBe(false);
  });

  test("an approval needs a reason, like every other decision here", () => {
    expect(converge(twoRevisions(), { byHuman: "Max", revision: 2, reason: "  ", atMs: T0 }).ok).toBe(false);
  });

  test("a converged room is terminal — no more talking, no more revising", () => {
    const done = converge(twoRevisions(), { byHuman: "Max", revision: 2, reason: "good", atMs: T0 + 3 });
    if (!done.ok) throw new Error("unreachable");
    expect(isTerminalRoom(done.room.state)).toBe(true);
    expect(say(done.room, person, "actually…", T0 + 4).ok).toBe(false);
    expect(revise(done.room, { text: "x", byHatId: "architect", inResponseToTurnId: "t", atMs: T0 }).ok).toBe(false);
    expect(converge(done.room, { byHuman: "Max", revision: 2, reason: "again", atMs: T0 }).ok).toBe(false);
  });

  test("abandoning ends it without approving, and needs a reason the agent can act on", () => {
    const r = abandon(twoRevisions(), { byHuman: "Max", reason: "wrong approach entirely — start from the retry semantics", atMs: T0 + 3 });
    expect(r.ok && r.room.state).toBe(RoomState.Abandoned);
    expect(r.ok && r.room.approvedRevision).toBeUndefined();
    expect(abandon(twoRevisions(), { byHuman: "Max", reason: " ", atMs: T0 }).ok).toBe(false);
  });
});

describe("WHOSE TURN IT IS, derived from the transcript", () => {
  test("after a person speaks, the agent owes an answer", () => {
    const asked = say(room(), person, "what about X?", T0 + 1);
    expect(asked.ok && awaitingAgent(asked.room)).toBe(true);
    expect(asked.ok && awaitingPerson(asked.room)).toBe(false);
  });

  test("after the agent answers, the person owes a read", () => {
    const asked = say(room(), person, "what about X?", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const answered = say(asked.room, hat, "It is covered by the retry.", T0 + 2);
    expect(answered.ok && awaitingPerson(answered.room)).toBe(true);
    expect(answered.ok && awaitingAgent(answered.room)).toBe(false);
  });

  test("a closed room is waiting on nobody", () => {
    const asked = say(room(), person, "x", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const done = converge(asked.room, { byHuman: "Max", revision: 1, reason: "fine as written", atMs: T0 + 2 });
    if (!done.ok) throw new Error("unreachable");
    expect(awaitingAgent(done.room)).toBe(false);
    expect(awaitingPerson(done.room)).toBe(false);
  });

  test("a fresh room with no opening is waiting on nobody yet", () => {
    expect(awaitingAgent(room())).toBe(false);
  });

  test("the summary says who it is waiting on", () => {
    const asked = say(room(), person, "x", T0 + 1);
    expect(asked.ok && roomSummary(asked.room)).toContain("waiting on the agent");
  });
});

describe("WHAT THE AGENT IS TOLD", () => {
  test("the observation carries the room, the document and the revision in play", () => {
    // A message with no room and no document is an instruction from nowhere, which is exactly what
    // an agent must not act on.
    const asked = say(room(), person, "Cover the partial-write case.", T0 + 1);
    if (!asked.ok) throw new Error("unreachable");
    const turn = asked.room.turns[0];
    if (turn === undefined) throw new Error("no turn");
    const obs = observationFor(asked.room, turn);
    expect(obs.channel).toBe("iteration_room");
    expect(obs.documentPath).toBe("docs/1637/architecture_design.md");
    expect(obs.workId).toBe("task-015");
    expect(obs.gate).toBe("architecture_approval");
    expect(obs.currentRevision).toBe(1);
    expect(obs.fromKind).toBe(SpeakerKind.Person);
    expect(obs.text).toContain("partial-write");
  });
});
