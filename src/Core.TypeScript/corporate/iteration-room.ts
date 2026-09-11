/**
 * corporate/iteration-room.ts — where a person and an agent iterate on a document until it is right.
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
 * "Request changes" was a button that sent a sentence into a queue and ended the exchange. The
 * person could say what was wrong; they could not say what they meant, see the next draft, or
 * disagree with it. So the only two things a reviewer could do were approve something imperfect or
 * stop the work — which is why every review converges on approval.
 *
 * A ROOM is the third option: the document, the conversation about it, and the revisions that
 * conversation produced, in one place, until somebody approves a specific revision.
 *
 * ── WHY NOT `discussion-anchor.ts` ──────────────────────────────────────────
 * That board is for HATS deliberating: `postToAnchor` admits only the anchor's declared
 * participants, and a person is not wearing a hat. Borrowing one to make the shape fit would put a
 * human's words under an agent's authority — which is exactly the smuggling the rest of this
 * register refuses. Here a person is a first-class speaker with no hat at all, and their turns are
 * marked as theirs.
 *
 * ── THE PROPERTY THAT MAKES AN APPROVAL MEAN SOMETHING ───────────────────────
 * **An approval names a REVISION, not a document.** Three drafts into a conversation, "approved"
 * against a path is ambiguous — and the ambiguity resolves in favour of whatever the agent wrote
 * last, which may be written after the person stopped reading. So `converge` takes the revision
 * number the person actually read, and refuses if a newer one exists that they have not seen.
 */

/** Who is speaking. A person is not a hat, and the record says so. */
export const SpeakerKind = { Person: "person", Hat: "hat" } as const;
export type SpeakerKind = (typeof SpeakerKind)[keyof typeof SpeakerKind];

export interface Speaker {
  readonly kind: SpeakerKind;
  /** A person's name, or a hat id. */
  readonly id: string;
}

export interface RoomTurn {
  readonly turnId: string;
  readonly speaker: Speaker;
  readonly text: string;
  readonly atMs: number;
  /** The revision this turn produced, when the agent answered by rewriting rather than by talking. */
  readonly producedRevision?: number;
}

export interface Revision {
  readonly revision: number;
  readonly text: string;
  readonly byHatId: string;
  readonly atMs: number;
  /** The turn that asked for this rewrite. Absent on the first draft, which nobody asked for. */
  readonly inResponseToTurnId?: string;
}

export const RoomState = {
  /** The conversation is live; the agent is expected to answer. */
  Open: "open",
  /** A person approved a specific revision. Terminal. */
  Converged: "converged",
  /** A person ended it without approving. Terminal, and the work goes back rather than forward. */
  Abandoned: "abandoned",
} as const;

export type RoomState = (typeof RoomState)[keyof typeof RoomState];

export function isTerminalRoom(state: RoomState): boolean {
  return state === RoomState.Converged || state === RoomState.Abandoned;
}

export interface IterationRoom {
  readonly roomId: string;
  readonly workId: string;
  /** The gate this room is holding. Approving here answers that gate. */
  readonly gate: string;
  /** The document under discussion. */
  readonly documentPath: string;
  readonly withHatId: string;
  readonly openedBy: string;
  readonly openedAtMs: number;
  readonly state: RoomState;
  readonly turns: readonly RoomTurn[];
  readonly revisions: readonly Revision[];
  /** Which revision was approved, when it converged. */
  readonly approvedRevision?: number;
  readonly closedAtMs?: number;
}

export type RoomResult =
  | { readonly ok: true; readonly room: IterationRoom }
  | { readonly ok: false; readonly reason: string };

export interface OpenRoomInput {
  readonly roomId: string;
  readonly workId: string;
  readonly gate: string;
  readonly documentPath: string;
  readonly withHatId: string;
  readonly openedBy: string;
  readonly atMs: number;
  /** What the document says right now — revision 1, which nobody asked for. */
  readonly currentText: string;
  /** What the person wants to talk about. Optional: sometimes you open a room to read together. */
  readonly opening?: string;
}

/**
 * Open a room on a document.
 *
 * The current text becomes revision 1 so the conversation has a baseline. Without one, "make it
 * shorter" has nothing to be shorter than, and the first rewrite would be unreviewable.
 */
export function openRoom(input: OpenRoomInput): RoomResult {
  if (input.openedBy.trim() === "") return { ok: false, reason: "a room needs somebody who opened it" };
  if (input.withHatId.trim() === "") return { ok: false, reason: "a room needs an agent to talk to" };
  if (input.documentPath.trim() === "") return { ok: false, reason: "a room is about a document" };

  const turns: RoomTurn[] =
    input.opening === undefined || input.opening.trim() === ""
      ? []
      : [
          {
            turnId: `${input.roomId}-t1`,
            speaker: { kind: SpeakerKind.Person, id: input.openedBy },
            text: input.opening.trim(),
            atMs: input.atMs,
          },
        ];

  return {
    ok: true,
    room: {
      roomId: input.roomId,
      workId: input.workId,
      gate: input.gate,
      documentPath: input.documentPath,
      withHatId: input.withHatId,
      openedBy: input.openedBy,
      openedAtMs: input.atMs,
      state: RoomState.Open,
      turns,
      revisions: [
        {
          revision: 1,
          text: input.currentText,
          byHatId: input.withHatId,
          atMs: input.atMs,
        },
      ],
    },
  };
}

/** Say something in the room. */
export function say(room: IterationRoom, speaker: Speaker, text: string, atMs: number): RoomResult {
  if (isTerminalRoom(room.state)) {
    return { ok: false, reason: `room ${room.roomId} is ${room.state} — reopen it or open a new one` };
  }
  if (text.trim() === "") return { ok: false, reason: "an empty message says nothing" };
  return {
    ok: true,
    room: {
      ...room,
      turns: [
        ...room.turns,
        {
          turnId: `${room.roomId}-t${String(room.turns.length + 1)}`,
          speaker,
          text: text.trim(),
          atMs,
        },
      ],
    },
  };
}

/**
 * The agent answers by rewriting the document.
 *
 * A revision is ALWAYS in response to something. A rewrite nobody asked for, arriving in the middle
 * of a conversation, is the agent changing the thing under discussion while the other party is
 * reading it — so `inResponseToTurnId` is required after the first draft and checked to exist.
 */
export function revise(
  room: IterationRoom,
  input: { readonly text: string; readonly byHatId: string; readonly inResponseToTurnId: string; readonly atMs: number },
): RoomResult {
  if (isTerminalRoom(room.state)) return { ok: false, reason: `room ${room.roomId} is ${room.state}` };
  if (input.text.trim() === "") return { ok: false, reason: "a revision with no text deletes the document" };
  if (!room.turns.some((t) => t.turnId === input.inResponseToTurnId)) {
    return { ok: false, reason: `no turn '${input.inResponseToTurnId}' in this room to be responding to` };
  }
  const latest = room.revisions[room.revisions.length - 1];
  if (latest !== undefined && latest.text.trim() === input.text.trim()) {
    // A "revision" identical to the last one would advance the number a reviewer has to re-read
    // while changing nothing. Refusing says so instead of manufacturing progress.
    return { ok: false, reason: "this revision is identical to the previous one" };
  }
  const revision = room.revisions.length + 1;
  return {
    ok: true,
    room: {
      ...room,
      revisions: [
        ...room.revisions,
        { revision, text: input.text, byHatId: input.byHatId, atMs: input.atMs, inResponseToTurnId: input.inResponseToTurnId },
      ],
      turns: [
        ...room.turns,
        {
          turnId: `${room.roomId}-t${String(room.turns.length + 1)}`,
          speaker: { kind: SpeakerKind.Hat, id: input.byHatId },
          text: `revised the document — revision ${String(revision)}`,
          atMs: input.atMs,
          producedRevision: revision,
        },
      ],
    },
  };
}

export function latestRevision(room: IterationRoom): Revision | undefined {
  return room.revisions[room.revisions.length - 1];
}

/**
 * A person approves a SPECIFIC revision, ending the room.
 *
 * ── WHY THE REVISION NUMBER IS REQUIRED ─────────────────────────────────────
 * Approving "the document" three drafts in resolves to whichever draft exists when the approval is
 * processed — which may be one written after the person stopped reading. Naming the revision makes
 * the approval a statement about something that was actually read, and lets this function refuse
 * when a newer revision has appeared since.
 */
export function converge(
  room: IterationRoom,
  input: { readonly byHuman: string; readonly revision: number; readonly reason: string; readonly atMs: number },
): RoomResult {
  if (isTerminalRoom(room.state)) return { ok: false, reason: `room ${room.roomId} is already ${room.state}` };
  if (input.reason.trim() === "") return { ok: false, reason: "an approval needs a reason, like every other decision here" };
  const target = room.revisions.find((r) => r.revision === input.revision);
  if (target === undefined) return { ok: false, reason: `there is no revision ${String(input.revision)} in this room` };
  const latest = latestRevision(room);
  if (latest !== undefined && latest.revision !== input.revision) {
    return {
      ok: false,
      reason: `revision ${String(latest.revision)} was written after the one you read — read it, then approve that`,
    };
  }
  return {
    ok: true,
    room: {
      ...room,
      state: RoomState.Converged,
      approvedRevision: input.revision,
      closedAtMs: input.atMs,
      turns: [
        ...room.turns,
        {
          turnId: `${room.roomId}-t${String(room.turns.length + 1)}`,
          speaker: { kind: SpeakerKind.Person, id: input.byHuman },
          text: `approved revision ${String(input.revision)}: ${input.reason.trim()}`,
          atMs: input.atMs,
        },
      ],
    },
  };
}

/** End the room without approving. The work goes back, not forward. */
export function abandon(room: IterationRoom, input: { readonly byHuman: string; readonly reason: string; readonly atMs: number }): RoomResult {
  if (isTerminalRoom(room.state)) return { ok: false, reason: `room ${room.roomId} is already ${room.state}` };
  if (input.reason.trim() === "") return { ok: false, reason: "abandoning a room needs a reason — the agent has to know what to do next" };
  return {
    ok: true,
    room: {
      ...room,
      state: RoomState.Abandoned,
      closedAtMs: input.atMs,
      turns: [
        ...room.turns,
        {
          turnId: `${room.roomId}-t${String(room.turns.length + 1)}`,
          speaker: { kind: SpeakerKind.Person, id: input.byHuman },
          text: `ended without approving: ${input.reason.trim()}`,
          atMs: input.atMs,
        },
      ],
    },
  };
}

/**
 * What the agent is expected to do next, if anything.
 *
 * Derived from the transcript rather than stored: the agent owes an answer exactly when the last
 * turn was a person's and it did not already produce a revision. A stored "awaiting agent" flag
 * would be one more thing to forget to clear.
 */
export function awaitingAgent(room: IterationRoom): boolean {
  if (isTerminalRoom(room.state)) return false;
  const last = room.turns[room.turns.length - 1];
  if (last === undefined) return false;
  return last.speaker.kind === SpeakerKind.Person && last.producedRevision === undefined;
}

/** What the person is expected to do next: read the newest revision the agent has produced. */
export function awaitingPerson(room: IterationRoom): boolean {
  if (isTerminalRoom(room.state)) return false;
  const last = room.turns[room.turns.length - 1];
  return last !== undefined && last.speaker.kind === SpeakerKind.Hat;
}

/** A one-line summary for a list of rooms. */
export function roomSummary(room: IterationRoom): string {
  const revs = room.revisions.length;
  const who = awaitingAgent(room) ? "waiting on the agent" : awaitingPerson(room) ? "waiting on you" : room.state;
  return `${room.documentPath} · ${String(revs)} revision(s) · ${String(room.turns.length)} message(s) · ${who}`;
}

/**
 * The message an agent's `observe.ts` receives when a person speaks in a room.
 *
 * Built here so every surface delivers the same thing. The agent is told WHO said it, WHERE, and
 * what it is about — a message with no room and no document is an instruction from nowhere, which
 * is precisely what an agent must not act on.
 */
export function observationFor(room: IterationRoom, turn: RoomTurn): {
  readonly channel: "iteration_room";
  readonly roomId: string;
  readonly workId: string;
  readonly gate: string;
  readonly documentPath: string;
  readonly fromKind: SpeakerKind;
  readonly from: string;
  readonly text: string;
  readonly atMs: number;
  readonly currentRevision: number;
} {
  return {
    channel: "iteration_room",
    roomId: room.roomId,
    workId: room.workId,
    gate: room.gate,
    documentPath: room.documentPath,
    fromKind: turn.speaker.kind,
    from: turn.speaker.id,
    text: turn.text,
    atMs: turn.atMs,
    currentRevision: latestRevision(room)?.revision ?? 1,
  };
}
