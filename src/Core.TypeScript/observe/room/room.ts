/**
 * observe/room/room.ts — Room primitive: keyed state slot + enforced scope predicate.
 *
 * A Room is the minimal extension to the observe→choose→execute loop that earns
 * its existence (per Rodney's Razor):
 *   1. Keyed state slot — tick-surviving cursor, content-addressed
 *   2. Scope predicate — declared read/write envelope, ENFORCED at runtime
 *
 * Without these two, a Room is just a labeled async function (accidental complexity).
 * With them, it handles multi-tick concerns (PR thread resolution, merge queue)
 * without scope violations between concurrent rooms.
 *
 * Design input: Rodney (reducer), Kenji (architect), Lior (antigravity check).
 */

import type { NextAction, World, BacklogItem } from "../observe";
import type { ChooserResult } from "../chooser";

// ─── Scope predicate (Lior's enforcement requirement) ───────────────

/** What a Room is allowed to read and write. Enforced, not advisory. */
export interface ScopePredicate {
  /** Backlog item IDs this room may act on (empty = no backlog access). */
  readonly backlogIds: ReadonlySet<string>;
  /** PR numbers this room may act on (empty = no PR access). */
  readonly prNumbers: ReadonlySet<number>;
  /** Whether this room may read/write the operator channel. */
  readonly operatorAccess: boolean;
  /** Whether this room may trigger git push / PR creation. */
  readonly writeAccess: boolean;
}

/** Narrow a World to only what the scope predicate allows. */
export function scopeWorld(world: World, scope: ScopePredicate): World {
  const filteredBacklog: readonly BacklogItem[] = scope.backlogIds.size === 0
    ? []
    : world.backlog.filter(item => scope.backlogIds.has(item.id));

  const scoped: World = {
    ...world,
    backlog: filteredBacklog,
  };

  const copy = { ...scoped };

  if (!scope.operatorAccess) {
    delete (copy as any).operator;
  }

  // Strip forgeState PR numbers not in scope
  if (world.forgeState && scope.prNumbers.size > 0) {
    copy.forgeState = {
      ...world.forgeState,
      cleanPrNumbers: world.forgeState.cleanPrNumbers.filter(n => scope.prNumbers.has(n)),
    };
  }

  return copy;
}

// ─── Room state (tick-surviving, content-addressed) ─────────────────

/** Opaque per-room state that survives across ticks. JSON-serializable. */
export type RoomState = Record<string, unknown>;

// ─── Room interface ─────────────────────────────────────────────────

export interface Room {
  /** Stable identifier (e.g. "pr-42", "merge-queue", "backlog-081KSNY2Z0008QG0R002JKH50A"). */
  readonly id: string;
  /** Declared read/write envelope — enforced by the tick runner. */
  readonly scope: ScopePredicate;
  /** Tick-surviving state. Mutated by the room, persisted by the runner. */
  state: RoomState;
  /**
   * Run one tick of this room against its scoped world.
   * Returns the chosen action (which the runner executes within the scope).
   */
  tick(scopedWorld: World): Promise<ChooserResult>;
}

// ─── Room runner (the fan-out) ──────────────────────────────────────

export interface RoomTickResult {
  readonly roomId: string;
  readonly result: ChooserResult;
  readonly scopeViolation: boolean;
}

/**
 * Run all active rooms in parallel against the world.
 * Each room sees only its scoped slice (Lior's enforcement).
 * Returns results per room for the runner to execute.
 */
export async function tickRooms(rooms: readonly Room[], world: World): Promise<readonly RoomTickResult[]> {
  // Validate no overlapping scopes (Lior's drift guard)
  validateNoOverlap(rooms);

  const results = await Promise.all(
    rooms.map(async (room): Promise<RoomTickResult> => {
      const scopedWorld = scopeWorld(world, room.scope);
      const result = await room.tick(scopedWorld);

      // Enforce: action must be within scope
      const violation = !isActionInScope(result.action, room.scope);
      if (violation) {
        // Return the result but flag the violation — runner decides what to do
        return { roomId: room.id, result, scopeViolation: true };
      }

      return { roomId: room.id, result, scopeViolation: false };
    })
  );

  return results;
}

/** Check if an action is within the room's declared scope. */
function isActionInScope(action: NextAction, scope: ScopePredicate): boolean {
  // Free modes and edit_grammar are always in scope (no external effects)
  if (action.kind === "explore" || action.kind === "play" ||
      action.kind === "self_reflect" || action.kind === "free_time" ||
      action.kind === "edit_grammar") {
    return true;
  }

  // Operator actions require operator access
  if (action.kind === "preserve_ferry" || action.kind === "respond_to_operator") {
    return scope.operatorAccess;
  }

  // Work actions require the item to be in scope
  if (action.kind === "do_item" || action.kind === "decompose") {
    return scope.backlogIds.has(action.item.id) ||
           action.item.id.startsWith("merge-pr-"); // merge actions checked via prNumbers
  }

  return true;
}

/** Validate no two rooms claim overlapping backlog IDs or PR numbers. */
function validateNoOverlap(rooms: readonly Room[]): void {
  const seenBacklog = new Set<string>();
  const seenPrs = new Set<number>();

  for (const room of rooms) {
    for (const id of room.scope.backlogIds) {
      if (seenBacklog.has(id)) {
        throw new Error(`Scope overlap: backlog item "${id}" claimed by multiple rooms`);
      }
      seenBacklog.add(id);
    }
    for (const pr of room.scope.prNumbers) {
      if (seenPrs.has(pr)) {
        throw new Error(`Scope overlap: PR #${pr} claimed by multiple rooms`);
      }
      seenPrs.add(pr);
    }
  }
}
