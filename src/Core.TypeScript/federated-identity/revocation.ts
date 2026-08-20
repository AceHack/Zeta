/**
 * revocation.ts — revocation as a G-Set (grow-only set), so it converges with no
 * central CRL and cannot be censored.
 *
 * Aaron 2026-08-20: *"this is a gset revocation in our model, we just assume our
 * keys are numerous enough that revocation can beat hacking"*.
 *
 * This corrects a claim `trust-bundle.ts` makes in its cost list. "No global
 * revocation" is true only if revocation must be PUBLISHED BY someone. It need
 * not be: a grow-only set is a CRDT, so the distribution mechanism is just
 * pairwise union, which is precisely the pairwise-never-global shape everything
 * else here has.
 *
 * ── WHY GROW-ONLY IS THE RIGHT SHAPE ─────────────────────────────────────────
 *
 * Union is **commutative**, **associative**, and **idempotent** — a
 * join-semilattice (Shapiro, Preguiça, Baquero & Zawirski, *Conflict-free
 * Replicated Data Types*, 2011; the G-Set is their canonical state-based
 * example). Those three laws are exactly the preconditions for merging without
 * coordination: order of arrival cannot matter, duplicate delivery cannot matter,
 * and no node needs to be told when it has everything.
 *
 * Two consequences worth stating out loud because they are the whole payoff:
 *
 *  1. **Revocation cannot be censored.** Withholding a revocation only DELAYS
 *     it. Any single honest peer that holds it re-introduces it at the next
 *     union, and monotonicity means it can never be removed again once it lands.
 *     Contrast a CRL, where the publisher's silence IS the absence of the fact.
 *  2. **Fail-safe direction.** Losing a message loses a *removal of authority*,
 *     which is the direction that is safe to retry. There is no message whose
 *     loss silently GRANTS authority.
 *
 * ── THE SECURITY ASSUMPTION, STATED WHERE THE CLAIM IS MADE ──────────────────
 *
 * A G-Set converges; it does not converge *instantly*. Between compromise and
 * the revocation reaching a given node, that node still honours the compromised
 * key. So the design premise is Aaron's, and it is an ASSUMPTION, not a result:
 *
 *   > **key population × rotation rate must outpace compromise rate.**
 *   > Revocation beats hacking by NUMEROUSNESS, not by being instantaneous.
 *
 * That is falsifiable and unfalsified: nothing here measures propagation delay,
 * compromise rate, or key population, and no such measurement exists in this
 * repo. If an attacker can compromise keys faster than the population rotates,
 * this design loses and the G-Set does not save it. Anyone citing "we have
 * revocation" should be pointed at this paragraph.
 *
 * ── SCOPE: PAIRWISE, LIKE EVERYTHING ELSE ────────────────────────────────────
 * A node applies a revocation only for a trust domain it accepts, and only when
 * the revocation is signed by a root of THAT domain. A domain revokes its own
 * keys; nobody revokes anybody else's. A revocation for a domain this node does
 * not accept is retained (grow-only — it may be accepted later) but does not
 * decide anything.
 *
 * ── THIS IS NOT NOVEL IN THIS REPO — the prior art, named ────────────────────
 *
 * `tools/setup/persona-keys/key-epoch-ledger.ts` ALREADY implements G-Set
 * revocation (`RevocationLedger = GSet<string>`, `ledgerAdd`, `ledgerMerge`,
 * `admit`, `foldChain`, `detectEquivocation`) over signed key-epoch transitions
 * for persona keys, with an old-quorum-signs-new-key chain. It is the more
 * developed artifact and it got there first.
 *
 * This file is a DIFFERENT LAYER, not a replacement: it revokes **trust-bundle
 * roots and SVID subject keys inside the federation layer**, keyed by
 * `(trustDomain, keyId, phase)` and adjudicated against a node's own accepted
 * bundles. The epoch ledger revokes **persona key epochs**. Both are G-Sets
 * because a G-Set is the right shape, not because either copied the other. A
 * later consolidation onto one ledger type is the obvious cleanup, and this note
 * is here so nobody mistakes duplication for independent confirmation — two
 * implementations of one idea are one observation, not two
 * (`.claude/rules/numerology-vs-number-theory.md` on correlated corroboration).
 *
 * Related committed prior art: `src/Core/KeyCustody.fs` `PhaseWindow` (expiry
 * needs no revocation message at all — partition-safe by construction) and
 * `tools/setup/persona-keys/trust-graph.ts` `revocationClosure` (transitive
 * invalidation of a revoked root's cross-sign closure).
 *
 * REGISTER: `unmetered`. The CRDT laws are pinned by tests including a paired
 * negative that shows a non-monotone "unrevoke" DIVERGES, so the laws are doing
 * work rather than being asserted. The propagation assumption above is `toy` —
 * it is a premise with no measurement behind it.
 */

import { createHash } from "node:crypto";

import { canonicalBytes, ordinalCompare, type Phase, type SignatureVerifier } from "./ports.ts";
import { type AcceptedBundles } from "./trust-bundle.ts";

/**
 * One revocation fact. Immutable and content-addressable: the same revocation
 * produced twice is the same element, which is what makes union idempotent in
 * practice and not only in theory.
 */
export interface RevocationEntry {
  /** The trust domain whose key this is. Only that domain may revoke it. */
  readonly trustDomain: string;
  /** The revoked key id — a root key id, or a leaf's subject key. */
  readonly revokedKeyId: string;
  /** Agreed phase from which the key is considered revoked. */
  readonly revokedFromPhase: Phase;
  /**
   * Which root signed this revocation. Must be a root of `trustDomain` in the
   * receiving node's accepted bundle for that domain.
   */
  readonly signedByKeyId: string;
  readonly signature: string;
  /**
   * DV2.0 record source: WHERE this node learned the fact. Never used in the
   * decision — it is provenance, so the raw evidence stays queryable. Two nodes
   * with different record sources for the same entry still merge identically,
   * which is why this field is excluded from the element key below.
   */
  readonly recordSource: string;
}

/** The element key. Excludes `recordSource` so provenance cannot fork the set. */
export function revocationKey(entry: RevocationEntry): string {
  return `${entry.trustDomain}\u0000${entry.revokedKeyId}\u0000${String(entry.revokedFromPhase)}`;
}

/** The bytes a revocation signature covers. Purpose-tagged. */
export function revocationSigningBytes(entry: RevocationEntry): Uint8Array {
  return canonicalBytes({
    purpose: "zeta-revocation-v0",
    trustDomain: entry.trustDomain,
    revokedKeyId: entry.revokedKeyId,
    revokedFromPhase: entry.revokedFromPhase,
  });
}

/**
 * The G-Set. A `ReadonlyMap` keyed by `revocationKey`, so it is a SET whose
 * elements carry payload. There is deliberately **no** `remove`, `unrevoke`,
 * `prune`, or `expire` — adding one would break monotonicity and therefore
 * convergence, and no amount of care at the call site would fix it.
 */
export type RevocationGSet = ReadonlyMap<string, RevocationEntry>;

export const EMPTY_REVOCATIONS: RevocationGSet = new Map();

/** Add one entry. Idempotent: adding an element already present is a no-op. */
export function addRevocation(set: RevocationGSet, entry: RevocationEntry): RevocationGSet {
  const key = revocationKey(entry);
  if (set.has(key)) return set;
  const next = new Map(set);
  next.set(key, entry);
  return next;
}

/**
 * The join. Union, with a deterministic tie-break on payload so that two nodes
 * that saw the same element via different record sources still produce the
 * BYTE-IDENTICAL merged state — convergence has to be on the state, not merely
 * on the key set, or a later digest of that state diverges.
 *
 * The tie-break is ordinal on `recordSource` (codepoint order, never a
 * locale-sensitive comparison).
 */
export function mergeRevocations(a: RevocationGSet, b: RevocationGSet): RevocationGSet {
  const out = new Map<string, RevocationEntry>(a);
  for (const [key, entry] of b) {
    const held = out.get(key);
    if (held === undefined) {
      out.set(key, entry);
      continue;
    }
    if (held.recordSource === entry.recordSource) continue;
    out.set(key, held.recordSource < entry.recordSource ? held : entry);
  }
  return out;
}

/** Merge many. Fold of an associative, commutative, idempotent operation. */
export function mergeAllRevocations(sets: readonly RevocationGSet[]): RevocationGSet {
  return sets.reduce<RevocationGSet>(mergeRevocations, EMPTY_REVOCATIONS);
}

/**
 * Stable digest of the set's CONTENTS, for convergence assertions.
 *
 * Sorted before hashing, so the digest depends on the SET and never on insertion
 * order — which is exactly the property the convergence tests assert, so an
 * order-dependent digest would make them vacuous.
 */
export function revocationSetDigest(set: RevocationGSet): string {
  const rows = [...set.entries()]
    .map(([key, e]) => `${key}\u0001${e.signedByKeyId}\u0001${e.recordSource}`)
    .sort(ordinalCompare);
  return createHash("sha256").update(rows.join("\u0002"), "utf8").digest("hex");
}

// ── Using the set ────────────────────────────────────────────────────────────

export interface RevocationCheck {
  readonly revoked: boolean;
  readonly reason: string;
  readonly entry?: RevocationEntry;
}

/**
 * Is `keyId` of `trustDomain` revoked as of `currentPhase`, according to this
 * node's own set and its own accepted bundles?
 *
 * An entry is only DECISIVE when this node accepts the domain AND the signing
 * root is in that accepted bundle AND the signature verifies. Everything else is
 * retained and ignored. Retaining it matters: this node may accept that domain
 * later, and the fact must already be there when it does. That is the grow-only
 * property earning its keep.
 */
export function isKeyRevoked(params: {
  readonly revocations: RevocationGSet;
  readonly accepted: AcceptedBundles;
  readonly trustDomain: string;
  readonly keyId: string;
  readonly currentPhase: Phase;
  readonly verifier: SignatureVerifier;
}): RevocationCheck {
  const { revocations, accepted, trustDomain, keyId, currentPhase, verifier } = params;
  const bundle = accepted.get(trustDomain);

  for (const entry of revocations.values()) {
    if (entry.trustDomain !== trustDomain || entry.revokedKeyId !== keyId) continue;
    if (currentPhase < entry.revokedFromPhase) continue;
    if (!bundle) {
      // Retained, not decisive — and say which, rather than reporting a clean
      // "not revoked" that reads like evidence of good standing.
      continue;
    }
    const root = bundle.roots.find((r) => r.keyId === entry.signedByKeyId);
    if (!root) continue;
    if (!verifier.verify(root.publicKey, revocationSigningBytes(entry), entry.signature)) continue;
    return {
      revoked: true,
      entry,
      reason: `key '${keyId}' of '${trustDomain}' revoked from phase ${String(entry.revokedFromPhase)} by root '${entry.signedByKeyId}' (learned via ${entry.recordSource})`,
    };
  }

  if (!bundle) {
    return {
      revoked: false,
      reason: `this node accepts no bundle for '${trustDomain}', so no revocation for it can be adjudicated — this is ABSENCE OF A DECISION, not a finding of good standing`,
    };
  }
  return {
    revoked: false,
    reason: `no verified revocation for '${keyId}' of '${trustDomain}' at phase ${String(currentPhase)} in this node's set`,
  };
}
