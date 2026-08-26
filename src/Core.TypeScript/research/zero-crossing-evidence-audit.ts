/**
 * Zero-crossing evidence-audit experiment.
 *
 * Scope: canonical ZSet cancellation versus retained signed-delta auditability.
 * This module makes no claim about thermodynamic cost, secrecy, or privacy.
 */

import { ofArray as gSetOfArray } from "../g-set/g-set";
import { root } from "../z-set-merkle/z-set-merkle";
import {
  empty,
  equals,
  negate,
  ofEntries,
  stringCompare,
  union,
  type ZSet,
} from "../z-set/z-set";

export interface SignedEvidenceDelta {
  /** Hash-minted event identity, binding the logical counter and predecessor. */
  readonly eventId: string;
  /** Emitter namespace; callers mint it rather than deriving it from content. */
  readonly emitterId: string;
  /** Logical counter only. Wall-clock time never enters the shared evidence fold. */
  readonly emitterSeq: number;
  /** Previous event identity in this emitter's hash chain; genesis is explicit. */
  readonly previousEventHash: string;
  /** Content recognizer for integrity/equality, never an event identifier. */
  readonly contentFingerprint: string;
  /** The evidence key whose net ZSet weight changes. */
  readonly key: string;
  /** A nonzero safe integer; + asserts and − retracts. */
  readonly weight: number;
  /** Uncertainty remains attached to both asserted and retracted evidence. */
  readonly meanPpm: number;
  readonly precisionPpm: number;
}

export interface EmitterChainContinuity {
  /** True only if every atom has its expected predecessor locally available. */
  readonly complete: boolean;
  /** Known event identities whose predecessor atom has not yet arrived. */
  readonly missingPredecessors: readonly string[];
  /** Locally visible chain links that point outside their emitter namespace. */
  readonly invalidPredecessorLinks: readonly string[];
}

export interface ZeroCrossingAuditView {
  /** Canonical materialized view: only nonzero net evidence remains. */
  readonly net: ZSet<string>;
  /** Content-addressed identity of every retained signed event. */
  readonly auditRoot: string;
  /** Number of distinct retained events, independent of net cancellation. */
  readonly auditCount: number;
  /** Out-of-order chains remain admissible; missing predecessors stay observable. */
  readonly chainContinuity: EmitterChainContinuity;
}

const encoder = new TextEncoder();

function digestText(value: string): string {
  const digest = root((key) => encoder.encode(key), ofEntries(stringCompare, [{ e: value, w: 1 }]));
  return `${digest.hi.toString(16).padStart(16, "0")}${digest.lo.toString(16).padStart(16, "0")}`;
}

/** Shared, deterministic origin of one emitter's logical event chain. */
export function genesisEventHash(emitterId: string): string {
  if (emitterId.length === 0) {
    throw new RangeError("genesis requires a nonempty emitter");
  }
  return digestText(JSON.stringify(["zero-crossing-audit/genesis/v1", emitterId]));
}

/** Canonical content recognizer for the current evidence payload schema. */
export function mintContentFingerprint(
  key: string,
  weight: number,
  meanPpm: number,
  precisionPpm: number,
): string {
  return digestText(JSON.stringify(["zero-crossing-audit/content/v1", key, weight, meanPpm, precisionPpm]));
}

/**
 * Mint an event identity from a logical (never wall-clock) counter, the prior
 * chain event, and content recognition. A signature may authenticate this
 * preimage, but only the predecessor link exposes a sequence fork structurally.
 */
export function mintEventId(
  emitterId: string,
  emitterSeq: number,
  previousEventHash: string,
  contentFingerprint: string,
): string {
  if (
    emitterId.length === 0
    || previousEventHash.length === 0
    || contentFingerprint.length === 0
    || !Number.isSafeInteger(emitterSeq)
    || emitterSeq < 0
  ) {
    throw new RangeError("event identity requires emitter, logical counter, predecessor, and content fingerprint");
  }
  return digestText(JSON.stringify(["zero-crossing-audit/event/v1", emitterId, emitterSeq, previousEventHash, contentFingerprint]));
}

function assertDelta(delta: SignedEvidenceDelta): void {
  if (
    delta.eventId.length === 0
    || delta.emitterId.length === 0
    || delta.previousEventHash.length === 0
    || delta.contentFingerprint.length === 0
    || delta.key.length === 0
  ) {
    throw new RangeError("event identity, emitter, predecessor, content fingerprint, and key must be nonempty");
  }
  if (!Number.isSafeInteger(delta.emitterSeq) || delta.emitterSeq < 0) {
    throw new RangeError("emitterSeq must be a nonnegative logical safe integer");
  }
  if (!Number.isSafeInteger(delta.weight) || delta.weight === 0) {
    throw new RangeError("weight must be a nonzero safe integer");
  }
  if (!Number.isInteger(delta.meanPpm) || !Number.isInteger(delta.precisionPpm) || delta.precisionPpm <= 0) {
    throw new RangeError("uncertainty must use integer ppm with positive precision");
  }
  const expectedContentFingerprint = mintContentFingerprint(
    delta.key,
    delta.weight,
    delta.meanPpm,
    delta.precisionPpm,
  );
  if (delta.contentFingerprint !== expectedContentFingerprint) {
    throw new RangeError("contentFingerprint does not bind the signed payload fields");
  }
  const expectedEventId = mintEventId(
    delta.emitterId,
    delta.emitterSeq,
    delta.previousEventHash,
    delta.contentFingerprint,
  );
  if (delta.eventId !== expectedEventId) {
    throw new RangeError("eventId does not bind the logical counter, predecessor, and content fingerprint");
  }
  if (delta.emitterSeq === 0 && delta.previousEventHash !== genesisEventHash(delta.emitterId)) {
    throw new RangeError("logical sequence zero must reference its emitter genesis hash");
  }
}

function canonicalAuditKey(delta: SignedEvidenceDelta): string {
  assertDelta(delta);
  return JSON.stringify([
    delta.eventId,
    delta.emitterId,
    delta.emitterSeq,
    delta.previousEventHash,
    delta.contentFingerprint,
    delta.key,
    delta.weight,
    delta.meanPpm,
    delta.precisionPpm,
  ]);
}

/**
 * Exact redelivery is idempotent at an event identity. A reused logical counter
 * with a distinct event hash is a locally visible chain fork and fails closed.
 * Missing predecessors remain admissible because out-of-order delivery is normal.
 */
function uniqueDeltas(deltas: readonly SignedEvidenceDelta[]): SignedEvidenceDelta[] {
  const byId = new Map<string, { readonly atom: string; readonly delta: SignedEvidenceDelta }>();
  const byLogicalPosition = new Map<string, string>();
  for (const delta of deltas) {
    const atom = canonicalAuditKey(delta);
    const prior = byId.get(delta.eventId);
    if (prior === undefined) {
      byId.set(delta.eventId, { atom, delta });
    } else if (prior.atom !== atom) {
      throw new RangeError(`eventId ${delta.eventId} was reused with conflicting evidence`);
    }
    const position = `${delta.emitterId}:${delta.emitterSeq}`;
    const priorAtPosition = byLogicalPosition.get(position);
    if (priorAtPosition === undefined) {
      byLogicalPosition.set(position, delta.eventId);
    } else if (priorAtPosition !== delta.eventId) {
      throw new RangeError(`emitter logical counter ${position} has conflicting chain branches`);
    }
  }
  return [...byId.values()].map((entry) => entry.delta);
}

/**
 * Reports chain completeness without rejecting an atom whose predecessor is
 * merely delayed. A partition can hide a competing branch; unioning both
 * branches makes the reused logical counter fail closed in `uniqueDeltas`.
 */
export function inspectEmitterChains(deltas: readonly SignedEvidenceDelta[]): EmitterChainContinuity {
  const unique = uniqueDeltas(deltas);
  const byEventId = new Map(unique.map((delta) => [delta.eventId, delta]));
  const missing = new Set<string>();
  const invalid = new Set<string>();
  for (const delta of unique) {
    if (delta.emitterSeq === 0) continue;
    const predecessor = byEventId.get(delta.previousEventHash);
    if (predecessor === undefined) {
      missing.add(delta.eventId);
    } else if (predecessor.emitterId !== delta.emitterId || predecessor.emitterSeq + 1 !== delta.emitterSeq) {
      invalid.add(delta.eventId);
    }
  }
  return {
    complete: missing.size === 0 && invalid.size === 0,
    missingPredecessors: [...missing].sort(),
    invalidPredecessorLinks: [...invalid].sort(),
  };
}

/** Fold signed evidence to the canonical net ZSet view. */
export function canonicalNet(deltas: readonly SignedEvidenceDelta[]): ZSet<string> {
  const unique = uniqueDeltas(deltas);
  return ofEntries(
    stringCompare,
    unique.map((delta) => ({ e: delta.key, w: delta.weight })),
  );
}

/**
 * Retain each append-only signed event as its own evidence key. The resulting
 * audit identity is order-independent, preserves intended multiplicity, and
 * distinguishes cancelled history from never-observed absence.
 */
export function auditView(deltas: readonly SignedEvidenceDelta[]): ZeroCrossingAuditView {
  const unique = uniqueDeltas(deltas);
  const audit = ofEntries(
    stringCompare,
    unique.map((delta) => ({ e: canonicalAuditKey(delta), w: 1 })),
  );
  const auditRoot = root((key) => encoder.encode(key), audit);
  return {
    net: canonicalNet(unique),
    auditRoot: `${auditRoot.hi.toString(16).padStart(16, "0")}${auditRoot.lo.toString(16).padStart(16, "0")}`,
    auditCount: audit.length,
    chainContinuity: inspectEmitterChains(unique),
  };
}

/** ZSet translation by a known delta remains invertible, including a zero-crossing. */
export function restoreKnownDelta(initial: ZSet<string>, knownDelta: ZSet<string>): ZSet<string> {
  return union(stringCompare, union(stringCompare, initial, knownDelta), negate(knownDelta));
}

export function restoresExactly(initial: ZSet<string>, knownDelta: ZSet<string>): boolean {
  return equals(stringCompare, initial, restoreKnownDelta(initial, knownDelta));
}

/** A GSet intentionally compacts duplicate identity keys; it does not preserve multiplicity. */
export function gSetDuplicateCount(identity: string): number {
  return gSetOfArray(stringCompare, [identity, identity]).length;
}

/** Explicit empty value used by callers/tests that must not confuse absence with an audit. */
export function noEvidence(): ZSet<string> {
  return empty<string>();
}

/** A small stable diagnostic for display/logging without elevating it to a physics metric. */
export function auditDiagnostic(deltas: readonly SignedEvidenceDelta[]): string {
  const view = auditView(deltas);
  return `net=${view.net.length};audit=${view.auditCount};complete=${view.chainContinuity.complete};root=${digestText(view.auditRoot)}`;
}
