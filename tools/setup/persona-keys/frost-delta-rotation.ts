// FROST delta rotation — REVOKE a share without the revoked party's cooperation.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// THE QUESTION THIS MODULE ANSWERS, AND WHY frost-reshare.ts CANNOT ANSWER IT
// ============================================================================
//
// frost-reshare.ts (#10654) redistributes shares while preserving groupPublicKey
// byte-identically. Preserving the group key is exactly why it CANNOT revoke:
// the old shares still interpolate to the same secret, so they still produce
// signatures that verify under the same anchor. Its own RS-7 asserts this. A
// reshare therefore raises the number of live quorums from one to two, and its
// only stated remedy is "the holder destroys the old share".
//
// Destruction-by-cooperation is not a security property. Aaron 2026-08-14:
// "we can assume if they use our software it will be destroyed but not if they
// fork." A revocation mechanism that needs an action from the revoked party is
// not a revocation mechanism; it is a request.
//
// So: you cannot revoke a share and keep the group key. Revocation IS a key
// change. The only real question is whether the change is a COLD RE-PIN (every
// relying party re-anchors out of band — at 20 sites, the cost that makes
// rotation too slow to do promptly, which is the actual vulnerability) or a
// VERIFIABLE one (relying parties check a chain instead of re-pinning).
//
// This module makes it verifiable.
//
// ============================================================================
// THE CONSTRUCTION: RESHARE IS THE delta = 0 SPECIAL CASE OF THIS
// ============================================================================
//
// In a reshare, contributing holder i publishes a fresh polynomial g_i with
//
//     g_i(0) = u_i = lambda_i^S * s_i        (its additive share of the secret)
//
// and SUM_i g_i(0) = secret, so the key is preserved. Here holder i instead
// picks a FRESH RANDOM delta_i and uses
//
//     g_i(0) = u_i + delta_i
//
// so the recombined polynomial H = SUM_i g_i satisfies
//
//     H(0) = secret + SUM_i delta_i = secret + delta,    A' = [H(0)]B = A + [delta]B.
//
// delta is a joint random secret: no party knows it, exactly as no party knows
// the group scalar. Set every delta_i = 0 and this degenerates, term for term,
// to frost-reshare.ts. That is not a coincidence and it is asserted as a test
// (DR-2): reshare is the delta = 0 point of this family.
//
// THE PUBLIC CHECK. Holder i publishes its Feldman commitments C_i (as before)
// AND one extra point Delta_i = [delta_i]B. Then any party holding nothing but
// the OLD group public key A checks
//
//     SUM_i ( C_i[0] - Delta_i )  ==  A         (the rotation targeted THIS key)
//     A'  :=  SUM_i C_i[0]                      (the new key is DERIVED, not asserted)
//
// because C_i[0] - Delta_i = [u_i + delta_i - delta_i]B = [u_i]B. The verifier
// never learns delta, never learns the secret, and never has to be told A' — it
// recomputes A' and the link A -> A' from public points alone. When every
// Delta_i is the identity this is literally verifyResharePreservesGroupKey.
//
// WHY THE OLD SHARES ARE THEN DEAD. A revoked holder r keeps s_r = F(x_r) on the
// OLD polynomial. It is not in newIndices, so it receives no subshare and holds
// no point of H. Its material signs A, and A is retired. Nothing was asked of
// it. That is the whole point.
//
// ============================================================================
// WHAT THIS DOES NOT GIVE YOU -- READ BEFORE TRUSTING IT
// ============================================================================
//
// 1. THE ARITHMETIC CHECK IS NOT AUTHENTICATION. Anyone holding no shares at all
//    can fabricate a transcript that passes verifyDeltaRotation: pick the C_i[0]
//    freely and set Delta_i = C_i[0] - X_i for any X_i summing to A. The check
//    proves a transcript is INTERNALLY CONSISTENT WITH A, not that the holders
//    ran it. Authorization comes from the old quorum's threshold signature over
//    the transition statement -- see key-epoch-ledger.ts. Test DR-11 plants
//    exactly this forgery and shows the arithmetic check waves it through.
//
// 2. LAST-MOVER BIAS ON A'. A contributor that publishes its Delta_i after
//    seeing the others' can resample and thereby bias the DISTRIBUTION of A' by
//    roughly log2(retries) bits. This is the Gennaro-Jarecki-Krawczyk-Rabin
//    observation about Pedersen-style DKG, and it is the reason a deployment
//    that cares should add a commit-then-reveal round on Delta_i. It does NOT
//    let the biasing party LEARN delta: to send Feldman-valid subshares it must
//    know its own g_i(0) as a scalar, so it cannot set Delta_i to a value whose
//    discrete log it does not have. Bias, not theft. GJKR 1999/2007 show
//    Pedersen-style DKG remains sufficient for threshold Schnorr regardless.
//
// 3. TIER IS UNCHANGED -- STILL L1, exactly as frost-reshare.ts says. This takes
//    the share SCALAR. No PKCS#11 mechanism computes lambda*s over the ed25519
//    scalar field. Hardware seals the share at rest between ceremonies; it does
//    not make the ceremony scalar-free. Do not let a rotation design imply
//    otherwise.
//
// 4. SUBSHARE TRANSPORT IS CONFIDENTIAL-OR-BUST AND IS NOT PROVIDED HERE. Same
//    caveat as frost-reshare.ts #2: k subshares addressed to the same recipient
//    reconstruct that recipient's new share. Aaron is running headscale/tailscale
//    (WireGuard) for this; it is a separate concern and a named DEPENDENCY, not
//    something this module solves. runDeltaRotationInProcess is named for the
//    fact that it is one process: tests and golden vectors, never a ceremony.
//
// 5. REVOCATION IS NOT INSTANT FOR A VERIFIER THAT HAS NOT HEARD. The rotation is
//    immediate and unconditional in the KEY; it is eventually consistent in the
//    KNOWLEDGE. A relying party still pinned to A accepts A-signed material until
//    it learns of the transition. That gap is the ledger's job
//    (key-epoch-ledger.ts) and it is a real, permanent gap shared with every
//    revocation system ever fielded (CRL windows, OCSP outages).
//
// Anchors (Beacon): Herzberg, Jarecki, Krawczyk & Yung, "Proactive Secret
// Sharing, or: How to Cope With Perpetual Leakage" (CRYPTO '95) -- share refresh
// by adding a random polynomial with zero constant term; delta rotation is that
// construction with the constant term left NONZERO and jointly generated.
// Desmedt & Jajodia, "Redistributing Secret Shares to New Access Structures"
// (1997). Feldman, "A Practical Scheme for Non-interactive Verifiable Secret
// Sharing" (FOCS '87). Pedersen, "A Threshold Cryptosystem without a Trusted
// Party" (EUROCRYPT '91) -- the joint random secret. Gennaro, Jarecki, Krawczyk
// & Rabin, "Secure Distributed Key Generation for Discrete-Log Based
// Cryptosystems" (EUROCRYPT '99; J. Cryptology 2007) -- the bias caveat above.
// Komlo & Goldberg, FROST (SAC 2020); RFC 9591.

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { lagrangeCoefficient, type FrostKeyShare } from "./frost.ts";
import { verifyReshareSubshare, type ReshareSubshare } from "./frost-reshare.ts";

const Fn = ed25519.Point.Fn;
const G = ed25519.Point.BASE;

/** See the P0 note on randScalar in frost.ts: the DEFAULT is the OS CSPRNG, not Math.random. */
function randScalar(random?: () => number): bigint {
  const buf = new Uint8Array(64);
  if (random === undefined) {
    buf.set(nodeRandomBytes(64));
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(random() * 256);
  }
  let s = Fn.ZERO;
  for (let i = buf.length - 1; i >= 0; i--) s = (s << 8n) + BigInt(buf[i]!);
  s = Fn.create(s);
  if (Fn.is0(s)) s = Fn.ONE;
  return s;
}

function evalPolynomial(coeffs: readonly bigint[], x: bigint): bigint {
  let acc = Fn.ZERO;
  let xp = Fn.ONE;
  for (const c of coeffs) {
    acc = Fn.add(acc, Fn.mul(c, xp));
    xp = Fn.mul(xp, x);
  }
  return acc;
}

/**
 * One current holder's PUBLIC contribution to a delta rotation.
 *
 * Carries no secret. Structurally a `ReshareContribution` plus `deltaCommitment`,
 * so the recipient-side Feldman check is byte-for-byte the same one
 * (`verifyReshareSubshare`) — the recipient's check does not change at all when
 * a rotation carries a delta, and that is worth knowing.
 */
export interface DeltaContribution {
  /** The CURRENT participant index i of the contributing holder. */
  readonly fromX: number;
  /** Feldman commitments to g_i: ([u_i + delta_i]B, [a_i1]B, ...). */
  readonly commitments: readonly Uint8Array[];
  /** Delta_i = [delta_i]B — the ONLY thing added to a reshare contribution. */
  readonly deltaCommitment: Uint8Array;
}

/** What one current holder emits: the public contribution plus its addressed subshares. */
export interface DeltaContributionBundle {
  readonly contribution: DeltaContribution;
  /** SECRET. One per new participant; must travel over a confidential channel. */
  readonly subshares: readonly ReshareSubshare[];
}

/** The request for one holder's contribution. */
export interface DeltaRotationRequest {
  /** Current indices taking part; must contain at least the current threshold members. */
  readonly contributingSet: readonly number[];
  /** Indices that will hold a share AFTER the rotation. */
  readonly newIndices: readonly number[];
  /** Threshold of the new share set. */
  readonly newThreshold: number;
  /**
   * Indices being REVOKED by this rotation. Not needed by the arithmetic — a
   * revoked holder is revoked by absence from `newIndices` — but stating it
   * makes the intent checkable, and the check below refuses the operator error
   * of "revoking" a holder while still handing it a share.
   */
  readonly retiredIndices?: readonly number[];
  /**
   * Set true ONLY to reproduce a pure reshare (delta = 0, group key preserved,
   * NOTHING revoked). Present so that the reshare/rotate family is one code
   * path with an explicit knob, rather than two implementations that can drift.
   */
  readonly zeroDelta?: boolean;
}

/**
 * CURRENT HOLDER STEP. Compute this holder's delta-rotation contribution.
 *
 * Takes the share scalar — the L1 admission in header caveat 3.
 *
 * `contributingSet` must be the set that ACTUALLY contributes: lambda_i is only
 * the right additive coefficient with respect to that exact set, and a wrong set
 * silently produces shares of the wrong secret. That is what
 * {@link verifyDeltaRotation} catches.
 */
export function deltaRotateContribute(
  share: FrostKeyShare,
  request: DeltaRotationRequest,
  random?: () => number,
): DeltaContributionBundle {
  const { contributingSet, newIndices, newThreshold } = request;
  const retired = request.retiredIndices ?? [];

  if (newThreshold < 1) throw new Error("frost-delta-rotation: newThreshold must be >= 1");
  if (newIndices.length < newThreshold) {
    throw new Error("frost-delta-rotation: newIndices must be at least newThreshold long");
  }
  if (new Set(newIndices).size !== newIndices.length) {
    throw new Error("frost-delta-rotation: duplicate new participant index");
  }
  if (newIndices.some((x) => x < 1)) {
    throw new Error("frost-delta-rotation: new participant index must be >= 1");
  }
  if (new Set(contributingSet).size !== contributingSet.length) {
    throw new Error("frost-delta-rotation: duplicate contributing index");
  }
  if (!contributingSet.includes(share.x)) {
    throw new Error(
      `frost-delta-rotation: holder ${String(share.x)} is not in the contributing set`,
    );
  }
  // The revocation guard: a retired holder that still appears in newIndices is
  // not retired. Refuse rather than quietly issue it a share.
  for (const r of retired) {
    if (newIndices.includes(r)) {
      throw new Error(
        `frost-delta-rotation: index ${String(r)} is listed as retired but is still in newIndices`,
      );
    }
  }
  // A retired holder must not be trusted to help retire itself.
  for (const r of retired) {
    if (contributingSet.includes(r)) {
      throw new Error(
        `frost-delta-rotation: index ${String(r)} is listed as retired but is in the contributing set`,
      );
    }
  }
  if (request.zeroDelta === true && retired.length > 0) {
    throw new Error(
      "frost-delta-rotation: zeroDelta preserves the group key and therefore revokes nothing",
    );
  }

  // u_i = lambda_i^S * s_i — this holder's additive share of the group secret.
  const u = Fn.mul(lagrangeCoefficient(share.x, contributingSet), share.secretShare);
  // delta_i — a fresh joint-random contribution to the key change.
  const deltaI = request.zeroDelta === true ? Fn.ZERO : randScalar(random);

  // g_i(x) = (u_i + delta_i) + a_i1 x + ... + a_i(k'-1) x^(k'-1)
  const coeffs = [
    Fn.add(u, deltaI),
    ...Array.from({ length: newThreshold - 1 }, () => randScalar(random)),
  ];

  return {
    contribution: {
      fromX: share.x,
      commitments: coeffs.map((c) => G.multiply(c).toBytes()),
      // [0]B is the identity, which is the correct commitment for delta_i = 0
      // and is exactly what makes the zeroDelta case reduce to a reshare.
      deltaCommitment: (Fn.is0(deltaI) ? ed25519.Point.ZERO : G.multiply(deltaI)).toBytes(),
    },
    subshares: newIndices.map((toX) => ({
      fromX: share.x,
      toX,
      scalar: evalPolynomial(coeffs, Fn.create(BigInt(toX))),
    })),
  };
}

/** Outcome of the public rotation check. `newGroupPublicKey` is present iff `ok`. */
export type DeltaRotationCheck =
  | { readonly ok: true; readonly newGroupPublicKey: Uint8Array; readonly deltaPoint: Uint8Array }
  | { readonly ok: false; readonly reason: string };

/**
 * PUBLIC VERIFIER STEP — runnable by a party holding nothing but the OLD key.
 *
 * Checks SUM_i (C_i[0] - Delta_i) == oldGroupPublicKey, and DERIVES
 * newGroupPublicKey = SUM_i C_i[0]. The new key is never taken on assertion.
 *
 * Fails when: a holder used the wrong contributing set (wrong lambda), a holder
 * substituted a different secret, a contribution is missing or duplicated, or a
 * holder's published Delta_i does not match the delta actually baked into its
 * commitments.
 *
 * READ HEADER CAVEAT 1. Passing this does NOT mean the holders ran the ceremony.
 * A party with no shares can fabricate a passing transcript. Authorization is
 * the old quorum's signature over the transition statement, not this check.
 */
export function verifyDeltaRotation(
  oldGroupPublicKey: Uint8Array,
  contributions: readonly DeltaContribution[],
): DeltaRotationCheck {
  if (contributions.length === 0) return { ok: false, reason: "no contributions" };

  const seen = new Set<number>();
  let sumHeads = ed25519.Point.ZERO; // SUM C_i[0]  -> the new key
  let sumDeltas = ed25519.Point.ZERO; // SUM Delta_i -> [delta]B

  for (const c of contributions) {
    if (seen.has(c.fromX)) {
      return { ok: false, reason: `duplicate contribution from ${String(c.fromX)}` };
    }
    seen.add(c.fromX);
    const head = c.commitments[0];
    if (head === undefined) {
      return { ok: false, reason: `contribution from ${String(c.fromX)} has no commitments` };
    }
    try {
      sumHeads = sumHeads.add(ed25519.Point.fromBytes(head));
      sumDeltas = sumDeltas.add(ed25519.Point.fromBytes(c.deltaCommitment));
    } catch {
      return { ok: false, reason: `contribution from ${String(c.fromX)} has malformed points` };
    }
  }

  let oldPoint: InstanceType<typeof ed25519.Point>;
  try {
    oldPoint = ed25519.Point.fromBytes(oldGroupPublicKey);
  } catch {
    return { ok: false, reason: "malformed old group public key" };
  }

  // SUM (C_i[0] - Delta_i) == A   <=>   SUM C_i[0] == A + SUM Delta_i
  if (!sumHeads.equals(oldPoint.add(sumDeltas))) {
    return { ok: false, reason: "contributions do not rotate the stated old group key" };
  }

  return {
    ok: true,
    newGroupPublicKey: sumHeads.toBytes(),
    deltaPoint: sumDeltas.toBytes(),
  };
}

/**
 * NEW PARTICIPANT STEP. Sum verified subshares into this participant's new share.
 *
 * Every subshare is re-verified against its sender's commitments here, so a
 * caller cannot skip the Feldman check by calling this directly. Requires
 * exactly one subshare per contributor: a missing term silently yields a share
 * of a different secret.
 */
export function deltaRotateCombine(
  toX: number,
  contributions: readonly DeltaContribution[],
  subshares: readonly ReshareSubshare[],
): FrostKeyShare {
  if (toX < 1) throw new Error("frost-delta-rotation: participant index must be >= 1");
  if (contributions.length === 0) throw new Error("frost-delta-rotation: no contributions");

  const mine = subshares.filter((s) => s.toX === toX);
  if (mine.length !== contributions.length) {
    throw new Error(
      `frost-delta-rotation: participant ${String(toX)} needs exactly one subshare per contributor ` +
        `(have ${String(mine.length)}, expected ${String(contributions.length)})`,
    );
  }

  let acc = Fn.ZERO;
  for (const c of contributions) {
    const s = mine.find((m) => m.fromX === c.fromX);
    if (s === undefined) {
      throw new Error(`frost-delta-rotation: missing subshare from contributor ${String(c.fromX)}`);
    }
    if (!verifyReshareSubshare(c, s)) {
      throw new Error(
        `frost-delta-rotation: subshare from ${String(c.fromX)} failed Feldman verification`,
      );
    }
    acc = Fn.add(acc, Fn.create(s.scalar));
  }
  return { x: toX, secretShare: acc };
}

/**
 * Canonical 32-byte digest of a rotation transcript.
 *
 * This is what goes in the signed transition statement instead of the transcript
 * itself. At a 11-of-20 quorum the full transcript is ~4KB of curve points; the
 * digest keeps the statement near 200 bytes, which is the difference between a
 * transition that fits in one LXMF/Reticulum packet and one that does not. The
 * transcript stays available for audit and is checked against this digest.
 *
 * Domain-separated and length-prefixed so no two distinct transcripts collide by
 * concatenation ambiguity. Contributions are hashed in ASCENDING fromX order, so
 * the digest does not depend on the order the coordinator happened to collect
 * them (a coordinator must not be able to change the digest by reordering).
 */
export function hashRotationTranscript(contributions: readonly DeltaContribution[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const u32 = (n: number): Uint8Array => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  };
  parts.push(new TextEncoder().encode("zeta-frost-rotation-transcript-v1"));
  const sorted = [...contributions].sort((a, b) => a.fromX - b.fromX);
  parts.push(u32(sorted.length));
  for (const c of sorted) {
    parts.push(u32(c.fromX));
    parts.push(u32(c.deltaCommitment.length));
    parts.push(c.deltaCommitment);
    parts.push(u32(c.commitments.length));
    for (const m of c.commitments) {
      parts.push(u32(m.length));
      parts.push(m);
    }
  }
  const total = parts.reduce((a, p) => a + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  return sha256(buf);
}

/** The result of a full in-process rotation. */
export interface DeltaRotationResult {
  readonly oldGroupPublicKey: Uint8Array;
  readonly newGroupPublicKey: Uint8Array;
  readonly deltaPoint: Uint8Array;
  readonly threshold: number;
  readonly shares: readonly FrostKeyShare[];
  readonly contributions: readonly DeltaContribution[];
  readonly transcriptHash: Uint8Array;
}

/**
 * TEST / GOLDEN-VECTOR HARNESS ONLY — runs every role in ONE process.
 *
 * Named for what it is. Because it is one process, every subshare is in one
 * address space, so this function DOES momentarily hold enough material to
 * reconstruct any new share. That is the property a real 20-site ceremony must
 * not have. The per-role functions above are the deployable shape.
 */
export function runDeltaRotationInProcess(
  oldGroupPublicKey: Uint8Array,
  contributingShares: readonly FrostKeyShare[],
  request: Omit<DeltaRotationRequest, "contributingSet">,
  random?: () => number,
): DeltaRotationResult {
  const contributingSet = contributingShares.map((s) => s.x);
  const bundles = contributingShares.map((s) =>
    deltaRotateContribute(s, { ...request, contributingSet }, random),
  );
  const contributions = bundles.map((b) => b.contribution);

  const check = verifyDeltaRotation(oldGroupPublicKey, contributions);
  if (!check.ok) {
    throw new Error(`frost-delta-rotation: ${check.reason}`);
  }

  const allSubshares = bundles.flatMap((b) => b.subshares);
  const shares = request.newIndices.map((toX) =>
    deltaRotateCombine(toX, contributions, allSubshares),
  );

  return {
    oldGroupPublicKey,
    newGroupPublicKey: check.newGroupPublicKey,
    deltaPoint: check.deltaPoint,
    threshold: request.newThreshold,
    shares,
    contributions,
    transcriptHash: hashRotationTranscript(contributions),
  };
}
