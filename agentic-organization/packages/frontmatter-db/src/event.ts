/**
 * The event-store record for git-as-event-store (operator vision 2026-05-29).
 *
 * Git is both the database AND the event store. Each event is one file named by
 * its ZetaId (decimal). Because ZetaIds are globally unique (crypto-random
 * field), two agents writing concurrently never produce the same filename, so a
 * git merge of two branches is a conflict-free UNION of event files — a G-Set
 * CRDT (see crdt-log.ts). Timestamp-based ordering is carried INSIDE the id:
 * ZetaId embeds a 48-bit timestamp, so the log is self-ordering (see project.ts).
 */

import type { FrontmatterValue } from "./schema.ts";

/** ZetaId rendered base-10 — the unique, conflict-free, time-ordered key. */
export type ZetaIdDecimal = string & { readonly __brand: "ZetaIdDecimal" };

export function asZetaIdDecimal(value: string): ZetaIdDecimal {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`asZetaIdDecimal: '${value}' is not a base-10 ZetaId`);
  }
  return value as ZetaIdDecimal;
}

/**
 * Bit layout mirrors src/Core.TypeScript/zeta-id/zeta-id.ts (timestamp field at
 * offset 75, width 48). Reimplemented locally so this package stays
 * self-contained (no cross-tree import); the canonical codec is authoritative.
 */
const TIMESTAMP_OFFSET = 75n;
const TIMESTAMP_WIDTH = 48n;

/** Extract the event time (ms) carried inside the ZetaId itself. */
export function timestampMsFromZetaId(id: ZetaIdDecimal): number {
  const bits = BigInt(id);
  const mask = (1n << TIMESTAMP_WIDTH) - 1n;
  return Number((bits >> TIMESTAMP_OFFSET) & mask);
}

/** Construct a decimal ZetaId whose only set field is the timestamp (test/demo aid). */
export function zetaIdWithTimestamp(ms: number): ZetaIdDecimal {
  const bits = (BigInt(ms) & ((1n << TIMESTAMP_WIDTH) - 1n)) << TIMESTAMP_OFFSET;
  return bits.toString() as ZetaIdDecimal;
}

/** Retraction-native op set (Z-set semantics: upsert adds, retract removes). */
export const EventOp = {
  Upsert: "upsert",
  Retract: "retract",
} as const;

export type EventOp = (typeof EventOp)[keyof typeof EventOp];

/**
 * One event = one git file. `id` is the unique CRDT key + carries the timestamp.
 * `aggregateId` is the row the event mutates. `fields` are the column values an
 * upsert sets (ignored for retract).
 */
export type FrontmatterEvent = {
  id: ZetaIdDecimal;
  table: string;
  aggregateId: ZetaIdDecimal;
  op: EventOp;
  schemaVersion: number;
  fields: Readonly<Record<string, FrontmatterValue>>;
};
