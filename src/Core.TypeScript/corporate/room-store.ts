/**
 * corporate/room-store.ts — a conversation two processes are both writing to.
 *
 * ── WHY APPEND-ONLY, AND NOT ONE FILE PER ROOM ───────────────────────────────
 * A room has TWO writers. The server appends what the person said; the run appends what the agent
 * said and the revisions it produced. If the room were one JSON file that each rewrote, the last
 * writer would silently erase whatever the other added in between — and the thing erased would be a
 * message somebody typed, or a draft somebody is about to approve.
 *
 * So a room is a DIRECTORY OF EVENTS and the room is the fold of them. Neither writer ever reads
 * before writing, so there is nothing to lose a race with. This is the same shape as `action-queue.ts`
 * and as the org log itself, for the same reason.
 *
 * ── THE SERVER STILL CANNOT CHANGE THE ORGANIZATION ──────────────────────────
 * Writing here is like writing to the action queue: it records that a person said something. The run
 * decides what the organization does about it. Keeping those separate is what lets the server accept
 * input and remain unable to alter what it reports.
 */

import { stringCompare } from "../collation/collation.ts";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  RoomState,
  SpeakerKind,
  type IterationRoom,
  type Revision,
  type RoomTurn,
  type Speaker,
} from "./iteration-room";

/** One thing that happened in a room. Append-only; the room is the fold of these. */
export type RoomEvent =
  | {
      readonly kind: "opened";
      readonly roomId: string;
      readonly workId: string;
      readonly gate: string;
      readonly documentPath: string;
      readonly withHatId: string;
      readonly openedBy: string;
      readonly atMs: number;
      readonly baselineText: string;
    }
  | {
      readonly kind: "turn";
      readonly roomId: string;
      readonly turnId: string;
      readonly speakerKind: string;
      readonly speaker: string;
      readonly text: string;
      readonly atMs: number;
      readonly producedRevision?: number;
    }
  | {
      readonly kind: "revision";
      readonly roomId: string;
      readonly revision: number;
      readonly byHatId: string;
      readonly text: string;
      readonly atMs: number;
      readonly inResponseToTurnId?: string;
    }
  | {
      readonly kind: "closed";
      readonly roomId: string;
      readonly state: string;
      readonly byHuman: string;
      readonly reason: string;
      readonly atMs: number;
      readonly approvedRevision?: number;
    };

function safeId(id: string): string {
  // Room ids reach the filesystem. Same discipline as memory keys: one segment, never a traversal.
  const cleaned = id.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^\.+/, "-");
  return cleaned === "" ? "-" : cleaned.slice(0, 100);
}

/** Append one event. The filename carries the sequence so the fold order is the write order. */
export function appendRoomEvent(dir: string, event: RoomEvent): string {
  const roomDir = join(dir, safeId(event.roomId));
  mkdirSync(roomDir, { recursive: true });
  // Padded so a lexical directory listing is chronological — the same reason the org store pads.
  const seq = String(readdirSync(roomDir).length + 1).padStart(6, "0");
  const path = join(roomDir, `${seq}-${event.kind}.json`);
  writeFileSync(path, `${JSON.stringify(event, null, 2)}\n`, "utf-8");
  return path;
}

/** Every event for one room, in write order. */
export function readRoomEvents(dir: string, roomId: string): readonly RoomEvent[] {
  const roomDir = join(dir, safeId(roomId));
  // The read decides existence. A room directory that is gone has no events, which is
  // exactly what the `existsSync` early-return meant -- without the window between the
  // question and the answer (CWE-367).
  let names: readonly string[];
  try {
    names = readdirSync(roomDir);
  } catch {
    return [];
  }
  const out: RoomEvent[] = [];
  for (const entry of [...names].sort()) {
    if (!entry.endsWith(".json")) continue;
    try {
      out.push(JSON.parse(readFileSync(join(roomDir, entry), "utf-8")) as RoomEvent);
    } catch {
      // A corrupt file loses ONE turn, not the conversation. Skipping is right here: the rest of
      // the room is still readable, and refusing the whole room would hide a live discussion
      // because one write was interrupted.
      continue;
    }
  }
  return out;
}

export function listRoomIds(dir: string): readonly string[] {
  try {
    return readdirSync(dir).sort();
  } catch {
    // No directory means no rooms — the same answer the `existsSync` gate gave, reached
    // without a window in which the check could go stale.
    return [];
  }
}

/**
 * Fold a room from its events.
 *
 * Returns `undefined` when the first event is not an `opened` — a transcript with no header is not
 * a room, and inventing one would produce a conversation about no document.
 */
export function foldRoom(events: readonly RoomEvent[]): IterationRoom | undefined {
  const first = events[0];
  if (first === undefined || first.kind !== "opened") return undefined;

  const turns: RoomTurn[] = [];
  const revisions: Revision[] = [
    { revision: 1, text: first.baselineText, byHatId: first.withHatId, atMs: first.atMs },
  ];
  let state: RoomState = RoomState.Open;
  let approvedRevision: number | undefined;
  let closedAtMs: number | undefined;

  for (const event of events.slice(1)) {
    if (event.kind === "turn") {
      if (turns.some((t) => t.turnId === event.turnId)) continue;
      const speaker: Speaker = {
        kind: event.speakerKind === "person" ? SpeakerKind.Person : SpeakerKind.Hat,
        id: event.speaker,
      };
      turns.push({
        turnId: event.turnId,
        speaker,
        text: event.text,
        atMs: event.atMs,
        ...(event.producedRevision === undefined ? {} : { producedRevision: event.producedRevision }),
      });
    } else if (event.kind === "revision") {
      if (revisions.some((r) => r.revision === event.revision)) continue;
      revisions.push({
        revision: event.revision,
        text: event.text,
        byHatId: event.byHatId,
        atMs: event.atMs,
        ...(event.inResponseToTurnId === undefined ? {} : { inResponseToTurnId: event.inResponseToTurnId }),
      });
    } else if (event.kind === "closed") {
      state = event.state === "converged" ? RoomState.Converged : RoomState.Abandoned;
      approvedRevision = event.approvedRevision;
      closedAtMs = event.atMs;
    }
  }

  return {
    roomId: first.roomId,
    workId: first.workId,
    gate: first.gate,
    documentPath: first.documentPath,
    withHatId: first.withHatId,
    openedBy: first.openedBy,
    openedAtMs: first.atMs,
    state,
    turns: turns.sort((a, b) => (a.atMs === b.atMs ? stringCompare(a.turnId, b.turnId) : a.atMs - b.atMs)),
    revisions: revisions.sort((a, b) => a.revision - b.revision),
    ...(approvedRevision === undefined ? {} : { approvedRevision }),
    ...(closedAtMs === undefined ? {} : { closedAtMs }),
  };
}

/** Every room in the directory, newest first. */
export function loadRooms(dir: string): readonly IterationRoom[] {
  const out: IterationRoom[] = [];
  for (const id of listRoomIds(dir)) {
    const room = foldRoom(readRoomEvents(dir, id));
    if (room !== undefined) out.push(room);
  }
  return out.sort((a, b) => b.openedAtMs - a.openedAtMs);
}

export function loadRoom(dir: string, roomId: string): IterationRoom | undefined {
  return foldRoom(readRoomEvents(dir, roomId));
}

/** The next turn id for a room, derived from what is already there. */
export function nextTurnId(room: IterationRoom): string {
  return `${room.roomId}-t${String(room.turns.length + 1)}`;
}
