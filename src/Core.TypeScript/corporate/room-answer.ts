/**
 * corporate/room-answer.ts — the agent's side of the room.
 *
 * ── WHY THIS RUNS FIRST ──────────────────────────────────────────────────────
 * A person waiting in a room is the most valuable thing the organization can attend to, and it is
 * also the cheapest to get wrong: a room that is answered an hour later is a conversation nobody is
 * having. So the run answers rooms BEFORE it walks any pipeline, and `org-life.preemptForConversation`
 * moves whatever that displaces rather than dropping it.
 *
 * ── WHAT AN ANSWER IS ────────────────────────────────────────────────────────
 * A REVISION, not a reply. The room exists so a document can be shaped; an agent that answers "good
 * point, I agree" has moved the conversation and not the document, and the person still cannot
 * approve anything. So the reviser returns text, and a reviser that returns nothing is recorded as
 * having produced nothing — visibly — rather than posting an empty draft.
 */

import {
  awaitingAgent,
  isTerminalRoom,
  latestRevision,
  revise,
  type IterationRoom,
  type RoomTurn,
} from "./iteration-room";
import { appendRoomEvent, loadRooms } from "./room-store";

/** Everything the reviser is told. A message with no document is an instruction from nowhere. */
export interface RevisionRequest {
  readonly roomId: string;
  readonly workId: string;
  readonly gate: string;
  readonly documentPath: string;
  readonly hatId: string;
  /** The draft being revised. */
  readonly currentText: string;
  readonly currentRevision: number;
  /** What the person asked for — the turn that is being answered. */
  readonly askedFor: string;
  readonly askedByTurnId: string;
  /** The whole conversation so far, oldest first, so the reviser can see what was already tried. */
  readonly transcript: readonly { readonly who: string; readonly text: string }[];
}

export type RevisionOutcome =
  | { readonly ok: true; readonly text: string; readonly note?: string }
  | { readonly ok: false; readonly reason: string };

export type Reviser = (request: RevisionRequest) => Promise<RevisionOutcome> | RevisionOutcome;

export interface AnsweredRoom {
  readonly roomId: string;
  readonly outcome: "revised" | "refused" | "unchanged";
  readonly revision?: number;
  readonly reason?: string;
}

/** The turn a room is waiting on an answer to — the last thing the person said. */
export function pendingAsk(room: IterationRoom): RoomTurn | undefined {
  if (!awaitingAgent(room)) return undefined;
  return room.turns[room.turns.length - 1];
}

/**
 * Answer every room that is waiting on the agent.
 *
 * Each room is independent: one reviser refusing does not stop the others, because a person waiting
 * in room B should not be held up by an unrelated failure in room A.
 */
export async function answerRooms(
  roomsDir: string,
  reviser: Reviser,
  nowMs: number,
): Promise<readonly AnsweredRoom[]> {
  const out: AnsweredRoom[] = [];
  for (const room of loadRooms(roomsDir)) {
    if (isTerminalRoom(room.state)) continue;
    const ask = pendingAsk(room);
    if (ask === undefined) continue;

    const current = latestRevision(room);
    const request: RevisionRequest = {
      roomId: room.roomId,
      workId: room.workId,
      gate: room.gate,
      documentPath: room.documentPath,
      hatId: room.withHatId,
      currentText: current?.text ?? "",
      currentRevision: current?.revision ?? 1,
      askedFor: ask.text,
      askedByTurnId: ask.turnId,
      transcript: room.turns.map((t) => ({ who: t.speaker.id, text: t.text })),
    };

    let result: RevisionOutcome;
    try {
      result = await reviser(request);
    } catch (error) {
      result = { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }

    if (!result.ok) {
      // SAID OUT LOUD IN THE ROOM. A reviser that failed silently would leave the person watching a
      // conversation that has simply stopped, with no way to tell waiting from broken.
      appendRoomEvent(roomsDir, {
        kind: "turn",
        roomId: room.roomId,
        turnId: `${room.roomId}-t${String(room.turns.length + 1)}`,
        speakerKind: "hat",
        speaker: room.withHatId,
        text: `could not revise the document: ${result.reason}`,
        atMs: nowMs,
      });
      out.push({ roomId: room.roomId, outcome: "refused", reason: result.reason });
      continue;
    }

    const attempt = revise(room, {
      text: result.text,
      byHatId: room.withHatId,
      inResponseToTurnId: ask.turnId,
      atMs: nowMs,
    });
    if (!attempt.ok) {
      // The commonest case is an identical revision, which `revise` refuses. Saying so is more
      // useful than a silent no-op: it tells the person the agent had nothing to add.
      appendRoomEvent(roomsDir, {
        kind: "turn",
        roomId: room.roomId,
        turnId: `${room.roomId}-t${String(room.turns.length + 1)}`,
        speakerKind: "hat",
        speaker: room.withHatId,
        text: `no change made: ${attempt.reason}`,
        atMs: nowMs,
      });
      out.push({ roomId: room.roomId, outcome: "unchanged", reason: attempt.reason });
      continue;
    }

    const rev = latestRevision(attempt.room);
    const turn = attempt.room.turns[attempt.room.turns.length - 1];
    if (rev !== undefined) {
      appendRoomEvent(roomsDir, {
        kind: "revision",
        roomId: room.roomId,
        revision: rev.revision,
        byHatId: rev.byHatId,
        text: rev.text,
        atMs: nowMs,
        inResponseToTurnId: ask.turnId,
      });
    }
    if (turn !== undefined) {
      appendRoomEvent(roomsDir, {
        kind: "turn",
        roomId: room.roomId,
        turnId: turn.turnId,
        speakerKind: "hat",
        speaker: turn.speaker.id,
        text: result.note ?? turn.text,
        atMs: nowMs,
        ...(turn.producedRevision === undefined ? {} : { producedRevision: turn.producedRevision }),
      });
    }
    out.push({ roomId: room.roomId, outcome: "revised", ...(rev === undefined ? {} : { revision: rev.revision }) });
  }
  return out;
}

/**
 * Rooms whose approval answers a gate.
 *
 * A converged room IS an approval of that gate against a specific revision — that is the whole
 * point of naming the revision. The run turns these into gate answers, so iterating in a room and
 * approving there is a complete path and not a detour that still needs a second click elsewhere.
 */
export function gateAnswersFromRooms(
  roomsDir: string,
): readonly { readonly workId: string; readonly gate: string; readonly revision: number; readonly roomId: string; readonly byHuman: string }[] {
  const out: { workId: string; gate: string; revision: number; roomId: string; byHuman: string }[] = [];
  for (const room of loadRooms(roomsDir)) {
    if (room.state !== "converged" || room.approvedRevision === undefined) continue;
    // `openedBy` is who opened it; a converged room's closing turn names who approved. The last
    // person turn is that, and it is the one recorded as the approver.
    const closing = [...room.turns].reverse().find((t) => t.speaker.kind === "person");
    out.push({
      workId: room.workId,
      gate: room.gate,
      revision: room.approvedRevision,
      roomId: room.roomId,
      byHuman: closing?.speaker.id ?? room.openedBy,
    });
  }
  return out;
}
