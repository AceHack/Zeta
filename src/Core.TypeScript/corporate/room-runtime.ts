/**
 * room-runtime.ts — a planned room, actually occupied, and judged by its own tests.
 *
 * `room-planning` decides the seating: which hats sit in which room for a work item. Nothing then
 * SAT in one. This is the other half — seat real agents, declare what each IO seam is wired to, and
 * make the room's acceptance criteria the thing that decides whether the work in it was any good.
 *
 * ── A ROOM WITH NO ACCEPTANCE CRITERIA CANNOT PASS ──────────────────────────
 * The single rule this file exists to enforce. An empty check list is REFUSED, never approved:
 * "nothing failed" and "nothing was checked" are the same observation from the outside, and every
 * defect this system has hunted has been an instance of confusing them. A room that ran no test
 * has not demonstrated anything, and saying so costs nothing.
 *
 * ── FIDELITY IS DERIVED, NOT DECLARED ───────────────────────────────────────
 * A room is DST-replayable exactly when every seam is mocked. That is computed from the seams
 * rather than asserted by the caller, because a caller that could claim replayability would
 * eventually claim it for a room that reached the network — and a replay that quietly is not one is
 * worse than no replay at all.
 */

import { mayProvision, type AgentRoster } from "./agent-roster";
import type { HatBinding } from "./hat-binding";
import type { OrgChart } from "./org-chart";
import type { PlannedRoom } from "./room-planning";

export const SeamFidelity = {
  /** Really does the IO: git, HTTP, a model, a clock that moves. */
  Real: "real",
  /** A deterministic double at the SAME boundary. Feathers' seam, made explicit. */
  Mock: "mock",
} as const;
export type SeamFidelity = (typeof SeamFidelity)[keyof typeof SeamFidelity];

export interface RoomSeam {
  /** The boundary this is: "git", "http", "model", "clock", "filesystem". */
  readonly name: string;
  readonly fidelity: SeamFidelity;
  /** What it is actually wired to, for the trace. Never the credential. */
  readonly describes: string;
}

export interface Occupant {
  readonly hatId: string;
  readonly agentId: string;
}

export interface OccupiedRoom {
  readonly roomId: string;
  readonly workId: string;
  readonly occupants: readonly Occupant[];
  readonly seams: readonly RoomSeam[];
  /**
   * DERIVED: every seam mocked means the room replays. Computed here so nobody can claim it.
   *
   * A room with NO seams is not replayable either — it declared no boundaries, which means nobody
   * looked for them, and "we found no IO" is not the same as "there is none".
   */
  readonly replayable: boolean;
}

export type SeatResult =
  | { readonly ok: true; readonly room: OccupiedRoom }
  | { readonly ok: false; readonly reason: string };

/** One thing the room must demonstrate. Its `run` is the evidence, not its name. */
export interface AcceptanceCheck {
  readonly name: string;
  /** What this check would prove. Read by a human deciding whether the list is adequate. */
  readonly asserts: string;
  run(room: OccupiedRoom): Promise<{ readonly passed: boolean; readonly detail: string }>;
}

export interface CheckOutcome {
  readonly name: string;
  readonly asserts: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface RoomVerdict {
  readonly roomId: string;
  readonly workId: string;
  readonly accepted: boolean;
  readonly outcomes: readonly CheckOutcome[];
  readonly replayable: boolean;
  /** Present only when the room was refused OUTRIGHT rather than failing a check. */
  readonly refusal?: string;
}

export function isReplayable(seams: readonly RoomSeam[]): boolean {
  return seams.length > 0 && seams.every((s) => s.fidelity === SeamFidelity.Mock);
}

/**
 * Seat a planned room with agents that are actually allowed to wear its hats.
 *
 * Refuses rather than seating a hat nobody can hold: an occupied room whose occupant could not
 * legitimately be there produces work attributed to authority that does not exist.
 */
export function seatRoom(input: {
  readonly planned: PlannedRoom;
  readonly workId: string;
  readonly roster: AgentRoster;
  readonly bindings: readonly HatBinding[];
  readonly chart: OrgChart;
  readonly seams: readonly RoomSeam[];
  readonly nowMs: number;
  /** Who to seat in each hat. Absent for a hat means: pick nobody, and refuse. */
  readonly agentForHat: (hatId: string) => string | undefined;
}): SeatResult {
  if (input.planned.seats.length === 0) {
    return { ok: false, reason: `room '${input.planned.roomId}' has no seats` };
  }
  const occupants: Occupant[] = [];
  for (const seat of input.planned.seats) {
    const agentId = input.agentForHat(seat.hatId);
    if (agentId === undefined) {
      return { ok: false, reason: `no agent offered for '${seat.hatId}' in room '${input.planned.roomId}'` };
    }
    const allowed = mayProvision({
      roster: input.roster,
      bindings: input.bindings,
      chart: input.chart,
      agentId,
      hatId: seat.hatId,
      nowMs: input.nowMs,
    });
    if (!allowed.ok) {
      return { ok: false, reason: `cannot seat '${agentId}' as '${seat.hatId}': ${allowed.reason}` };
    }
    occupants.push({ hatId: seat.hatId, agentId });
  }
  return {
    ok: true,
    room: {
      roomId: input.planned.roomId,
      workId: input.workId,
      occupants,
      seams: [...input.seams],
      replayable: isReplayable(input.seams),
    },
  };
}

/**
 * Run the room's acceptance criteria and return a verdict.
 *
 * THE EMPTY LIST IS A REFUSAL. This is the whole point of the file: a room that was asked to
 * demonstrate nothing has demonstrated nothing, and reporting that as acceptance is how a gate
 * becomes decorative. A check that THROWS is a failed check, not an absent one — an exception
 * swallowed into "no result" is the same erasure by another route.
 */
export async function runAcceptance(
  room: OccupiedRoom,
  checks: readonly AcceptanceCheck[],
): Promise<RoomVerdict> {
  if (checks.length === 0) {
    return {
      roomId: room.roomId,
      workId: room.workId,
      accepted: false,
      outcomes: [],
      replayable: room.replayable,
      refusal:
        "no acceptance criteria were declared for this room — nothing was checked, which is not the same as nothing failing",
    };
  }
  const outcomes: CheckOutcome[] = [];
  for (const check of checks) {
    try {
      const result = await check.run(room);
      outcomes.push({ name: check.name, asserts: check.asserts, passed: result.passed, detail: result.detail });
    } catch (err) {
      outcomes.push({
        name: check.name,
        asserts: check.asserts,
        passed: false,
        detail: `the check threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return {
    roomId: room.roomId,
    workId: room.workId,
    // EVERY check, not a majority and not a sample. A room is accepted when it demonstrated
    // everything it said it would.
    accepted: outcomes.every((o) => o.passed),
    outcomes,
    replayable: room.replayable,
  };
}

/** One line per room, for a log or a UI. Says what was checked, never only whether it passed. */
export function renderVerdict(verdict: RoomVerdict): string {
  if (verdict.refusal !== undefined) return `${verdict.roomId}: REFUSED — ${verdict.refusal}`;
  const failed = verdict.outcomes.filter((o) => !o.passed);
  const head = `${verdict.roomId} (${verdict.workId}): ${verdict.accepted ? "ACCEPTED" : "REJECTED"} ` +
    `${String(verdict.outcomes.length - failed.length)}/${String(verdict.outcomes.length)} check(s)` +
    `${verdict.replayable ? ", replayable" : ", NOT replayable (a real seam)"}`;
  return failed.length === 0 ? head : `${head}\n${failed.map((f) => `    ${f.name}: ${f.detail}`).join("\n")}`;
}
