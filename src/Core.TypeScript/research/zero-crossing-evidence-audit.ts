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
  /**
   * Stable event identity minted at emission time. A redelivery repeats it;
   * a later same-content emission gets a distinct identity.
   */
  readonly eventId: string;
  /** Emitter namespace from which this event identity was minted. */
  readonly emitterId: string;
  /** Strictly nonnegative monotone event sequence within the emitter namespace. */
  readonly emitterSeq: number;
  /** Content recognizer for integrity/equality, never the event name. */
  readonly contentFingerprint: string;
  /** The evidence key whose net ZSet weight changes. */
  readonly key: string;
  /** A nonzero safe integer; + asserts and − retracts. */
  readonly weight: number;
  /** Uncertainty remains attached to both asserted and retracted evidence. */
  readonly meanPpm: number;
  readonly precisionPpm: number;
}

export interface ZeroCrossingAuditView {
  /** Canonical materialized view: only nonzero net evidence remains. */
  readonly net: ZSet<string>;
  /** Content-addressed identity of every retained signed delta. */
  readonly auditRoot: string;
  /** Number of distinct retained deltas, independent of net cancellation. */
  readonly auditCount: number;
}

const encoder = new TextEncoder();

function assertDelta(delta: SignedEvidenceDelta): void {
  if (
    delta.eventId.length === 0
    || delta.emitterId.length === 0
    || delta.contentFingerprint.length === 0
    || delta.key.length === 0
  ) {
    throw new RangeError("event identity, emitter, content fingerprint, and key must be nonempty");
  }
  if (!Number.isSafeInteger(delta.emitterSeq) || delta.emitterSeq < 0) {
    throw new RangeError("emitterSeq must be a nonnegative safe integer");
  }
  if (!Number.isSafeInteger(delta.weight) || delta.weight === 0) {
    throw new RangeError("weight must be a nonzero safe integer");
  }
  if (!Number.isInteger(delta.meanPpm) || !Number.isInteger(delta.precisionPpm) || delta.precisionPpm <= 0) {
    throw new RangeError("uncertainty must use integer ppm with positive precision");
  }
}

function canonicalAuditKey(delta: SignedEvidenceDelta): string {
  assertDelta(delta);
  return JSON.stringify([
    delta.eventId,
    delta.emitterId,
    delta.emitterSeq,
    delta.contentFingerprint,
    delta.key,
    delta.weight,
    delta.meanPpm,
    delta.precisionPpm,
  ]);
}

/**
 * The evidence atom is G-set-like at its event identity: retransmitting the
 * exact same atom is harmless, while reusing an identity for different signed
 * content is an equivocation and must not be folded.
 */
function uniqueDeltas(deltas: readonly SignedEvidenceDelta[]): SignedEvidenceDelta[] {
  const byId = new Map<string, { readonly atom: string; readonly delta: SignedEvidenceDelta }>();
  for (const delta of deltas) {
    const atom = canonicalAuditKey(delta);
    const prior = byId.get(delta.eventId);
    if (prior === undefined) {
      byId.set(delta.eventId, { atom, delta });
    } else if (prior.atom !== atom) {
      throw new RangeError(`eventId ${delta.eventId} was reused with conflicting evidence`);
    }
  }
  return [...byId.values()].map((entry) => entry.delta);
}

/**
 * Deterministic identity shape for a single emitter stream. Production code may
 * hash/sign this tuple, but content recognition must never replace event minting.
 */
export function mintEventId(emitterId: string, emitterSeq: number): string {
  if (emitterId.length === 0 || !Number.isSafeInteger(emitterSeq) || emitterSeq < 0) {
    throw new RangeError("event identity requires a nonempty emitter and nonnegative safe sequence");
  }
  return `${emitterId}:${emitterSeq}`;
}

function hashText(value: string): string {
  const digest = root((key) => encoder.encode(key), ofEntries(stringCompare, [{ e: value, w: 1 }]));
  return `${digest.hi.toString(16).padStart(16, "0")}${digest.lo.toString(16).padStart(16, "0")}`;
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
 * Retain each append-only signed delta as its own evidence key. The resulting
 * audit identity is order-independent but distinguishes cancelled history from
 * never-observed absence.
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
  return `net=${view.net.length};audit=${view.auditCount};root=${hashText(view.auditRoot)}`;
}
