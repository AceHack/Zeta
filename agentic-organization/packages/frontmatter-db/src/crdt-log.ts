/**
 * The event log as a G-Set CRDT keyed by unique ZetaId (operator vision
 * 2026-05-29: "git as event store via CRDTs in the form of unique ids that
 * allow no conflict").
 *
 * Merge is set-union over the id key. Because ZetaIds are globally unique:
 *   - two distinct events never collide  -> no content conflict on git merge
 *   - the same event (same id) dedupes   -> idempotent
 * Union is commutative, associative, and idempotent: the three CRDT join laws.
 * Therefore merging branches in any order converges to the same log, and
 * project() over that log converges to the same state (see project.ts).
 */

import type { FrontmatterEvent, ZetaIdDecimal } from "./event.ts";

export type EventLog = ReadonlyMap<ZetaIdDecimal, FrontmatterEvent>;

export function emptyLog(): EventLog {
  return new Map<ZetaIdDecimal, FrontmatterEvent>();
}

export function fromEvents(events: Iterable<FrontmatterEvent>): EventLog {
  const log = new Map<ZetaIdDecimal, FrontmatterEvent>();
  for (const event of events) {
    log.set(event.id, event);
  }
  return log;
}

/** Append one event (grow-only). Re-appending the same id is a no-op (idempotent). */
export function appendEvent(log: EventLog, event: FrontmatterEvent): EventLog {
  const next = new Map(log);
  next.set(event.id, event);
  return next;
}

/** CRDT join: the conflict-free union of two logs. */
export function mergeLogs(a: EventLog, b: EventLog): EventLog {
  const next = new Map(a);
  for (const [id, event] of b) {
    next.set(id, event);
  }
  return next;
}

export function logSize(log: EventLog): number {
  return log.size;
}
