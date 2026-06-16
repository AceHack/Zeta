/**
 * src/Core.TypeScript/observe/schema-overlap.ts — overlap-window state machine.
 *
 * The state machine for zero-downtime schema evolution:
 *   STABLE → WRITER_SWITCHED → READERS_MIGRATING → QUORUM → STABLE
 *
 * At no point does a read fail. The overlap window is the safety margin.
 * The conformance suite proves this: all tests pass at every state.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/schema-zset.ts (the schema Z-set this monitors)
 *   - src/Core.TypeScript/observe/schema-cdc.ts (events that trigger transitions)
 *   - src/Core.TypeScript/observe/observe.ts (the observe loop can detect schema work)
 *   - docs/specs/zero-downtime-schema-evolution/design.md (the spec)
 */

import { type SchemaZSet, type SchemaField, currentSchema, isInOverlap, consolidate } from "./schema-zset";

// ─── State machine ───────────────────────────────────────────────────────────

/**
 * The overlap-window states:
 *   STABLE             — no evolution in progress; all fields at weight +1
 *   WRITER_SWITCHED    — delta applied; new entries use new schema; old entries unchanged
 *   READERS_MIGRATING  — batched rewrites in progress; some entries old, some new
 *   QUORUM             — all entries migrated; ready to consolidate (drop old)
 */
export type OverlapState = "stable" | "writer_switched" | "readers_migrating" | "quorum";

/** A reader that needs to migrate (a consumer of the schema). */
export interface SchemaReader {
  readonly id: string;          // reader identity (agent, service, view)
  readonly migrated: boolean;   // has this reader acknowledged the new schema?
}

/** The full overlap status snapshot. */
export interface OverlapStatus {
  readonly state: OverlapState;
  readonly fieldsInOverlap: readonly string[];    // field names currently in transition
  readonly totalReaders: number;
  readonly migratedReaders: number;
  readonly canConsolidate: boolean;               // true = safe to drop old schema
}

// ─── Status computation ──────────────────────────────────────────────────────

/**
 * Compute the current overlap state from the schema Z-set and reader statuses.
 * Pure function — no side effects.
 */
export function overlapStatus(schema: SchemaZSet, readers: readonly SchemaReader[]): OverlapStatus {
  // Find fields in overlap (have negative weights or duplicates)
  const activeFields = currentSchema(schema);
  const fieldsInOverlap = activeFields
    .filter(f => isInOverlap(schema, f.name))
    .map(f => f.name);

  const totalReaders = readers.length;
  const migratedReaders = readers.filter(r => r.migrated).length;

  // Determine state
  let state: OverlapState;
  if (fieldsInOverlap.length === 0) {
    state = "stable";
  } else if (totalReaders === 0 || migratedReaders === totalReaders) {
    state = "quorum";
  } else if (migratedReaders > 0) {
    state = "readers_migrating";
  } else {
    state = "writer_switched";
  }

  const canConsolidate = state === "quorum" && fieldsInOverlap.length > 0;

  return {
    state,
    fieldsInOverlap,
    totalReaders,
    migratedReaders,
    canConsolidate,
  };
}

/**
 * Predicate: is it safe to consolidate (drop old schema entries)?
 * True only when ALL readers have migrated AND there are fields to consolidate.
 */
export function canDropOldSchema(schema: SchemaZSet, readers: readonly SchemaReader[]): boolean {
  return overlapStatus(schema, readers).canConsolidate;
}

/**
 * Attempt to close the overlap window. Returns the consolidated schema if safe,
 * or the unchanged schema with a reason if not yet safe.
 */
export function tryConsolidate(
  schema: SchemaZSet,
  readers: readonly SchemaReader[],
): { ok: true; schema: SchemaZSet } | { ok: false; reason: string } {
  const status = overlapStatus(schema, readers);

  if (status.state === "stable") {
    return { ok: true, schema }; // already stable, nothing to consolidate
  }

  if (!status.canConsolidate) {
    const pending = status.totalReaders - status.migratedReaders;
    return {
      ok: false,
      reason: `cannot consolidate: ${pending} reader(s) not yet migrated (state: ${status.state})`,
    };
  }

  return { ok: true, schema: consolidate(schema) };
}

// ─── Reader management ───────────────────────────────────────────────────────

/** Mark a reader as migrated (it now understands the new schema). */
export function migrateReader(readers: readonly SchemaReader[], readerId: string): readonly SchemaReader[] {
  return readers.map(r => r.id === readerId ? { ...r, migrated: true } : r);
}

/** Register a new reader (initially not migrated). */
export function registerReader(readers: readonly SchemaReader[], readerId: string): readonly SchemaReader[] {
  if (readers.some(r => r.id === readerId)) return readers; // already registered
  return [...readers, { id: readerId, migrated: false }];
}

/** List readers that haven't migrated yet. */
export function pendingReaders(readers: readonly SchemaReader[]): readonly SchemaReader[] {
  return readers.filter(r => !r.migrated);
}
