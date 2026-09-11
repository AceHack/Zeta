/**
 * room-planning.ts — how many rooms a task needs, and who sits in each.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `ROOMS_AS_DETERMINISTIC_SIMULATIONS.md` §4, and the emphasis is the doc's own:
 *
 *   > **RMO determines, per task, how many rooms and how many hats per room.**
 *   > Rooms created during **meetings** are *automation* — a meeting is not a task, so RMO does
 *   > not plan those. RMO plans rooms for **tasks** only.
 *
 * `rmo.ts` already decides hat SUPPLY — how many wearers of each hat the workload needs. Nothing
 * turned that into seating. This is the missing step between "we need three backend implementers"
 * and "here are the rooms they work in".
 *
 * ── WHY DETERMINISM IS THE POINT AND NOT A NICETY ────────────────────────────
 * A room is a deterministic simulation. If the PLAN that creates rooms is not itself deterministic,
 * every replay seats different hats in different rooms and the simulations underneath stop being
 * comparable — the property the whole room design exists for is lost one level up, in the planner
 * nobody was looking at.
 *
 * So: seats are ordered ORDINALLY by hat id, packed in that order, and room ids come from an
 * INJECTED sequence rather than being minted here. Two runs over the same supply produce the same
 * plan, byte for byte.
 *
 * ── WHAT IT REFUSES ──────────────────────────────────────────────────────────
 * A capacity of zero or less. `ceil(n / 0)` is Infinity and a room with no seats packs nothing
 * forever, so the honest answer is a refusal rather than a plan that cannot be executed. And a
 * supply of nobody plans NO rooms — not one empty room, which would be a room allocated for nobody
 * to sit in and would read downstream as capacity that exists.
 */

/** One hat's seat in a room. */
export interface RoomSeat {
  readonly hatId: string;
  /** Which of that hat's wearers this seat is for, from 1. */
  readonly seatIndex: number;
}

export interface PlannedRoom {
  readonly roomId: string;
  readonly seats: readonly RoomSeat[];
}

export interface TaskRoomPlan {
  readonly workId: string;
  readonly rooms: readonly PlannedRoom[];
  /** Total seats packed. Equals the supply, and a test pins that nobody is dropped. */
  readonly seatCount: number;
}

export type RoomPlanResult =
  | { readonly ok: true; readonly plan: TaskRoomPlan }
  | { readonly ok: false; readonly reason: string };

export interface RoomPlanInput {
  readonly workId: string;
  /** How many wearers of each hat the workload needs — `rmo.ts`'s output. */
  readonly requiredHatSupply: ReadonlyMap<string, number>;
  readonly maxHatsPerRoom: number;
  /**
   * Where room ids come from.
   *
   * INJECTED, not minted here. A planner that generated its own ids would be the one part of a
   * deterministic simulation that could not be replayed, and the caller is the only party that
   * knows whether these rooms are new or a re-plan of existing ones.
   */
  readonly nextRoomId: (index: number) => string;
}

/**
 * Pack the required supply into capacity-bounded rooms.
 *
 * `roomCount = ceil(totalSeats / maxHatsPerRoom)`, and the seats fill rooms in ordinal hat order —
 * so which hat lands in which room is a function of the supply alone.
 */
export function planTaskRooms(input: RoomPlanInput): RoomPlanResult {
  if (!Number.isInteger(input.maxHatsPerRoom) || input.maxHatsPerRoom < 1) {
    return {
      ok: false,
      reason: `a room holds at least one hat; '${String(input.maxHatsPerRoom)}' packs nothing`,
    };
  }

  const seats: RoomSeat[] = [];
  for (const hatId of ordinal([...input.requiredHatSupply.keys()])) {
    const count = input.requiredHatSupply.get(hatId) ?? 0;
    if (!Number.isInteger(count) || count < 0) {
      return { ok: false, reason: `supply for '${hatId}' is '${String(count)}', which is not a count` };
    }
    for (let i = 1; i <= count; i += 1) seats.push({ hatId, seatIndex: i });
  }

  // NO SEATS, NO ROOMS. One empty room would be capacity allocated for nobody, and downstream it
  // would read as capacity that exists.
  const rooms: PlannedRoom[] = [];
  for (let start = 0; start < seats.length; start += input.maxHatsPerRoom) {
    rooms.push({
      roomId: input.nextRoomId(rooms.length),
      seats: seats.slice(start, start + input.maxHatsPerRoom),
    });
  }

  return { ok: true, plan: { workId: input.workId, rooms, seatCount: seats.length } };
}

/**
 * Which room a hat's Nth wearer sits in, or `undefined` when it is not in this plan.
 *
 * The question the binding step asks. Searching rather than recomputing, so a caller cannot get an
 * answer that disagrees with the plan it was handed.
 */
export function roomFor(plan: TaskRoomPlan, hatId: string, seatIndex: number): PlannedRoom | undefined {
  return plan.rooms.find((r) => r.seats.some((s) => s.hatId === hatId && s.seatIndex === seatIndex));
}

/** ORDINAL. Two machines planning the same supply must seat it identically. */
function ordinal(xs: readonly string[]): readonly string[] {
  return [...xs].sort((a, b) => {
    if (a < b) return -1;
    return a > b ? 1 : 0;
  });
}
