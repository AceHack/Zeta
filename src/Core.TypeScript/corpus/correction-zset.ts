/**
 * correction-zset.ts — retractable membership of correction-corpus rows.
 *
 * WHY. Workitem 081M12CZRHC: the next honest collector is a store-native log of
 * (rule, violation, repair) events as a Z-set so a generator has both halves
 * and a retraction. `"Failed"` has no second half (Landauer erasure).
 *
 * HUB / SATELLITE. The Z-set key is `observation.id` (the violation hub from
 * `from-lint-finding.ts`). Repair is a label on the row, not a key — editing
 * FIX prose must not mint a new membership key. That is the labelled-observation
 * contract; the workitem's "(rule, violation, repair)" names the *pair a
 * generator needs*, not a three-field primary key.
 *
 * Z-SET, NOT A MAP. Membership uses `src/Core.TypeScript/z-set/z-set.ts`
 * (ℤ / sum). `observe` is +1 (NOT idempotent). `retract` is −1. Weight 0 drops
 * the key (retraction). A negative weight is a retraction in flight, not a
 * teaching row. Labels live in a sidecar map so the Z-set stays a signed
 * multiset of ids, not of payloads.
 *
 * NO AMBIENT ANYTHING. No clock, no fs, no network. Callers supply rows.
 */

import {
  add,
  addW,
  empty,
  stringCompare,
  weight,
  type ZSet,
} from "../z-set/z-set.ts";
import { addLabels, labelsFor, type CorpusRow, type Label } from "./labelled-observation.ts";

export interface CorrectionLog {
  /** Signed membership of observation ids. Canonical Z-set order. */
  readonly membership: ZSet<string>;
  /** Payload satellite. Present only while weight !== 0. */
  readonly rows: ReadonlyMap<string, CorpusRow>;
}

export function emptyLog(): CorrectionLog {
  return { membership: empty(), rows: new Map() };
}

function sameLabel(a: Label, b: Label): boolean {
  return (
    a.key.namespace === b.key.namespace &&
    a.key.name === b.key.name &&
    a.value === b.value &&
    a.assertedBy === b.assertedBy &&
    a.at === b.at &&
    (a.because ?? "") === (b.because ?? "")
  );
}

function mergeRow(existing: CorpusRow, incoming: CorpusRow): CorpusRow {
  const fresh = incoming.labels.filter((l) => !existing.labels.some((e) => sameLabel(e, l)));
  const { row } = addLabels(existing, fresh);
  return { observation: existing.observation, labels: row.labels };
}

/**
 * Record a row. Membership += 1. Labels on a known id are appended (no
 * overwrite, no duplicate of an identical assertion). The hub fields of the
 * first observe win — the id is content-addressed by the caller.
 */
export function observe(log: CorrectionLog, row: CorpusRow): CorrectionLog {
  const id = row.observation.id;
  const membership = add(stringCompare, id, log.membership);
  const existing = log.rows.get(id);
  const nextRows = new Map(log.rows);
  nextRows.set(id, existing === undefined ? row : mergeRow(existing, row));
  return { membership, rows: nextRows };
}

/**
 * Retract one observation of `id` (membership −1). When weight hits 0 the
 * satellite is dropped. Retracting an absent id stores a negative weight and
 * no row — a retraction in flight, not an invented hub.
 */
export function retract(log: CorrectionLog, id: string): CorrectionLog {
  const membership = addW(stringCompare, id, -1, log.membership);
  const nextRows = new Map(log.rows);
  if (weight(stringCompare, membership, id) === 0) nextRows.delete(id);
  return { membership, rows: nextRows };
}

export function membershipWeight(log: CorrectionLog, id: string): number {
  return weight(stringCompare, log.membership, id);
}

/** Rows whose membership weight is strictly positive, in Z-set key order. */
export function present(log: CorrectionLog): readonly CorpusRow[] {
  const out: CorpusRow[] = [];
  for (const { e: id, w } of log.membership) {
    if (w <= 0) continue;
    const row = log.rows.get(id);
    if (row !== undefined) out.push(row);
  }
  return out;
}

/** Present rows that carry at least one `lint/repair` label. Failure-only stays out. */
export function teaching(log: CorrectionLog): readonly CorpusRow[] {
  const repair = { namespace: "lint", name: "repair" };
  return present(log).filter((row) => labelsFor(row, repair).length > 0);
}
