// FROST verifiable resharing — replace a lost share WITHOUT reconstituting the secret.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// THE QUESTION THIS MODULE ANSWERS
// ============================================================================
//
// When one site's HSM dies, can a replacement share be provisioned without
// reassembling the group signing scalar anywhere?
//
// Before this module the answer in THIS REPOSITORY was no, and not because the
// literature lacks a construction. The repo had exactly two moves available:
//
//   (a) frostKeygen / frostDkgKeygen -- samples a FRESH secret. It has no
//       parameter that accepts an existing secret, so it cannot re-split the
//       group you already have. It yields a NEW groupPublicKey, which means
//       every relying party changes its trust anchor (frost-ca.pub in every
//       TrustedUserCAKeys, every issued cert's signing-CA fingerprint). At 20
//       sites that is a fleet-wide re-trust to replace one dead chip.
//
//   (b) Reassemble f(0) from k shares on one host and re-split it. Nothing in
//       the repo does this, and it is the move that puts the whole secret in
//       one process -- the hidden single point of failure at ceremony time that
//       makes geographic distribution partly theatre.
//
// This module adds the third move, which is the one the literature actually
// prescribes: SHARE REDISTRIBUTION. The group public key is preserved, and the
// signing scalar is never formed, in any process, at any instant.
//
// ============================================================================
// WHY NO PARTY EVER HOLDS THE SECRET
// ============================================================================
//
// Take any k current holders S. Lagrange interpolation at 0 says
//
//     secret = SUM_{i in S} lambda_i^S * s_i
//
// so u_i = lambda_i^S * s_i is participant i's ADDITIVE share of the secret.
// Each holder can compute its own u_i from material it already has, and u_i
// reveals no more than s_i already did.
//
// Holder i then picks a FRESH random degree-(k'-1) polynomial g_i with
// g_i(0) = u_i, and sends g_i(x'_j) to each new participant j. New participant
// j sums what it receives:
//
//     s'_j = SUM_{i in S} g_i(x'_j)  =  G(x'_j)   where G = SUM_i g_i
//
// and G(0) = SUM_i u_i = secret. So s'_j is a valid share of the SAME secret on
// a NEW polynomial. At no point does any party compute SUM_i u_i: holder i sees
// only its own u_i, and new participant j sees only evaluations at its own x'_j,
// which are k'-1-degree-blinded by the other holders' random coefficients.
//
// ============================================================================
// THE VERIFICATION THAT MAKES THIS SAFE TO RUN HEADLESS
// ============================================================================
//
// Feldman commitments make the ceremony checkable by parties who know nothing
// secret. Holder i publishes C_i = ([u_i]B, [a_i1]B, ...). Then:
//
//   * A new participant checks its own subshare: [g_i(x'_j)]B == SUM_m C_i[m] * x'_j^m.
//     This catches a holder that sends a corrupted subshare (verifyReshareSubshare).
//
//   * ANYONE checks the whole ceremony preserved the secret:
//         SUM_{i in S} C_i[0] == groupPublicKey
//     because SUM_i [u_i]B = [SUM_i u_i]B = [secret]B. This is the load-bearing
//     one: it proves the redistribution targeted the ORIGINAL key, using only
//     public points, WITHOUT anyone learning or reassembling the secret
//     (verifyResharePreservesGroupKey). A holder that substitutes a different
//     secret is caught by a verifier that holds nothing but the public key.
//
// ============================================================================
// WHAT THIS MODULE DOES *NOT* GIVE YOU -- READ BEFORE TRUSTING IT
// ============================================================================
//
// 1. TIER IS UNCHANGED. This is L1, exactly like frost-share-adapter.ts says.
//    reshareContribute takes the share SCALAR, so the scalar is in host RAM in
//    the contributing process. A PKCS#11 HSM cannot do this arithmetic: no
//    PKCS#11 mechanism computes lambda*s over the ed25519 scalar field, which is
//    the same reason no adapter reaches use-without-extract for signing.
//    Hardware buys at-rest sealing of the share between ceremonies. It does not
//    buy a ceremony that never exposes the scalar. Do not let the arrival of a
//    $650 chip inflate this claim.
//
// 2. SUBSHARE TRANSPORT IS CONFIDENTIAL-OR-BUST, AND THIS MODULE DOES NOT
//    PROVIDE THE TRANSPORT. g_i(x'_j) must travel from holder i to new
//    participant j over a channel no one else reads. Anyone who collects k
//    subshares addressed to the SAME j learns s'_j outright -- summing them is
//    the entire reconstruction. A coordinator that relays subshares in the clear
//    has re-created the single point of failure this module exists to remove,
//    while appearing to run a distributed ceremony. runReshareInProcess is
//    therefore named for the fact that it is one process, and is for tests and
//    golden vectors, NOT for a three-house ceremony.
//
// 3. OLD SHARES MUST BE DESTROYED, and this module cannot destroy them. After a
//    reshare the old and new share sets lie on DIFFERENT polynomials over the
//    same secret. That is a security property when the old set is gone (an
//    attacker holding k-1 old plus k-1 new learns nothing, which is what makes
//    proactive refresh work) and it is a liability while both exist, because the
//    old set is still a complete k-of-n signing capability for the same key. A
//    reshare that does not end in verified destruction of the old shares has
//    RAISED the number of live quorums from one to two.
//
// Anchors (Beacon): Herzberg, Jarecki, Krawczyk & Yung, "Proactive Secret
// Sharing, or: How to Cope With Perpetual Leakage" (CRYPTO '95) -- the refresh
// construction. Desmedt & Jajodia, "Redistributing Secret Shares to New Access
// Structures" (1997) -- redistribution across a CHANGED (k,n), which is the case
// here since a replacement site may arrive with a different threshold. Feldman,
// "A Practical Scheme for Non-interactive Verifiable Secret Sharing" (FOCS '87)
// -- the commitments. Komlo & Goldberg, FROST (SAC 2020); RFC 9591.

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { lagrangeCoefficient, type FrostKeyShare, type FrostKeygenResult } from "./frost.ts";

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

function evalCommitments(
  commitments: readonly Uint8Array[],
  x: bigint,
): InstanceType<typeof ed25519.Point> {
  let acc = ed25519.Point.ZERO;
  let xp = Fn.ONE;
  for (const c of commitments) {
    acc = acc.add(ed25519.Point.fromBytes(c).multiply(xp));
    xp = Fn.mul(xp, x);
  }
  return acc;
}

/**
 * One current holder's public contribution to a reshare.
 *
 * Carries NO secret: commitments are curve points. commitments[0] = [u_i]B is
 * the holder's committed additive share of the group secret, and the sum of
 * those over the contributing set is what must equal the group public key.
 */
export interface ReshareContribution {
  /** The CURRENT participant index i of the contributing holder. */
  readonly fromX: number;
  /** Feldman commitments to g_i: ([u_i]B, [a_i1]B, ... , [a_i(k'-1)]B). */
  readonly commitments: readonly Uint8Array[];
}

/**
 * A subshare g_i(x'_j) travelling from current holder i to NEW participant j.
 *
 * SECRET. This value must reach exactly one recipient over a confidential
 * channel. k of these addressed to the same toX reconstruct that recipient's
 * new share; see caveat 2 in the header.
 */
export interface ReshareSubshare {
  readonly fromX: number;
  readonly toX: number;
  readonly scalar: bigint;
}

/** What one current holder emits: the public contribution plus its addressed subshares. */
export interface ReshareContributionBundle {
  readonly contribution: ReshareContribution;
  readonly subshares: readonly ReshareSubshare[];
}

/**
 * CURRENT HOLDER STEP. Compute this holder's reshare contribution.
 *
 * `contributingSet` is the set of CURRENT indices taking part; it must have at
 * least the current threshold members, because lambda_i is only the correct
 * additive coefficient with respect to that exact set. Passing a different set
 * than the one actually contributing silently produces shares of the WRONG
 * secret -- which is precisely what verifyResharePreservesGroupKey catches.
 *
 * Takes the share scalar. That is the L1 admission in the header: this cannot
 * run inside a PKCS#11 chip.
 */
export function reshareContribute(
  share: FrostKeyShare,
  contributingSet: readonly number[],
  newIndices: readonly number[],
  newThreshold: number,
  random?: () => number,
): ReshareContributionBundle {
  if (newThreshold < 1) throw new Error("frost-reshare: newThreshold must be >= 1");
  if (newIndices.length < newThreshold) {
    throw new Error("frost-reshare: newIndices must be at least newThreshold long");
  }
  if (new Set(newIndices).size !== newIndices.length) {
    throw new Error("frost-reshare: duplicate new participant index");
  }
  if (newIndices.some((x) => x < 1)) {
    throw new Error("frost-reshare: new participant index must be >= 1");
  }
  if (new Set(contributingSet).size !== contributingSet.length) {
    throw new Error("frost-reshare: duplicate contributing index");
  }
  if (!contributingSet.includes(share.x)) {
    throw new Error(`frost-reshare: holder ${String(share.x)} is not in the contributing set`);
  }

  // u_i = lambda_i^S * s_i -- this holder's additive share of the group secret.
  const u = Fn.mul(lagrangeCoefficient(share.x, contributingSet), share.secretShare);

  // g_i(x) = u_i + a_i1 x + ... + a_i(k'-1) x^(k'-1)
  const coeffs = [u, ...Array.from({ length: newThreshold - 1 }, () => randScalar(random))];

  return {
    contribution: {
      fromX: share.x,
      commitments: coeffs.map((c) => G.multiply(c).toBytes()),
    },
    subshares: newIndices.map((toX) => ({
      fromX: share.x,
      toX,
      scalar: evalPolynomial(coeffs, Fn.create(BigInt(toX))),
    })),
  };
}

/**
 * NEW PARTICIPANT STEP (do this BEFORE accepting the subshare).
 *
 * Feldman check that a received subshare really lies on the polynomial the
 * sender committed to: [g_i(x'_j)]B == SUM_m C_i[m] * x'_j^m.
 *
 * Catches a corrupted or malicious sender. It does NOT by itself prove the
 * ceremony targets the right secret -- that is verifyResharePreservesGroupKey,
 * and BOTH are required.
 */
export function verifyReshareSubshare(
  contribution: ReshareContribution,
  subshare: ReshareSubshare,
): boolean {
  if (subshare.fromX !== contribution.fromX) return false;
  if (subshare.toX < 1) return false;
  if (contribution.commitments.length === 0) return false;
  let expected: InstanceType<typeof ed25519.Point>;
  try {
    expected = evalCommitments(contribution.commitments, Fn.create(BigInt(subshare.toX)));
  } catch {
    return false;
  }
  return expected.equals(G.multiply(Fn.create(subshare.scalar)));
}

/**
 * PUBLIC VERIFIER STEP -- the load-bearing check, runnable by a party holding
 * nothing secret.
 *
 * SUM_{i in S} C_i[0] must equal the group public key, because C_i[0] = [u_i]B
 * and SUM_i u_i = secret. This proves the reshare preserved the ORIGINAL group
 * key without reconstituting it, and it is what makes the ceremony auditable
 * after the fact from public artifacts alone.
 *
 * Fails when: a holder used the wrong contributing set (wrong lambda), a holder
 * substituted its own secret, or a contribution is missing/duplicated.
 */
export function verifyResharePreservesGroupKey(
  groupPublicKey: Uint8Array,
  contributions: readonly ReshareContribution[],
): boolean {
  if (contributions.length === 0) return false;
  const seen = new Set<number>();
  let acc = ed25519.Point.ZERO;
  for (const c of contributions) {
    if (seen.has(c.fromX)) return false; // a duplicated contribution double-counts a u_i
    seen.add(c.fromX);
    const head = c.commitments[0];
    if (head === undefined) return false;
    try {
      acc = acc.add(ed25519.Point.fromBytes(head));
    } catch {
      return false;
    }
  }
  try {
    return acc.equals(ed25519.Point.fromBytes(groupPublicKey));
  } catch {
    return false;
  }
}

/**
 * NEW PARTICIPANT STEP. Sum verified subshares into this participant's new share.
 *
 * Every subshare is re-verified here against its sender's commitments, so a
 * caller cannot skip verifyReshareSubshare by calling this directly. Requires
 * exactly one subshare from each contributor, since a missing contributor's
 * term silently yields a share of a different secret.
 */
export function reshareCombine(
  toX: number,
  contributions: readonly ReshareContribution[],
  subshares: readonly ReshareSubshare[],
): FrostKeyShare {
  if (toX < 1) throw new Error("frost-reshare: participant index must be >= 1");
  if (contributions.length === 0) throw new Error("frost-reshare: no contributions");

  const mine = subshares.filter((s) => s.toX === toX);
  if (mine.length !== contributions.length) {
    throw new Error(
      `frost-reshare: participant ${String(toX)} needs exactly one subshare per contributor ` +
        `(have ${String(mine.length)}, expected ${String(contributions.length)})`,
    );
  }

  let acc = Fn.ZERO;
  for (const c of contributions) {
    const s = mine.find((m) => m.fromX === c.fromX);
    if (s === undefined) {
      throw new Error(`frost-reshare: missing subshare from contributor ${String(c.fromX)}`);
    }
    if (!verifyReshareSubshare(c, s)) {
      throw new Error(`frost-reshare: subshare from ${String(c.fromX)} failed Feldman verification`);
    }
    acc = Fn.add(acc, Fn.create(s.scalar));
  }
  return { x: toX, secretShare: acc };
}

/**
 * TEST / GOLDEN-VECTOR HARNESS ONLY -- runs every role in ONE process.
 *
 * Named for what it is. Because it is one process, every subshare is in one
 * address space, so this specific function DOES momentarily hold enough material
 * to reconstruct any new share. That is the property a real three-house ceremony
 * must not have (header caveat 2), and it is why this is not the shape you
 * deploy. The per-role functions above are the deployable shape: each runs where
 * its share lives, and only commitments and point-to-point-encrypted subshares
 * cross the network.
 *
 * The group public key is carried through unchanged, by construction.
 */
export function runReshareInProcess(
  groupPublicKey: Uint8Array,
  contributingShares: readonly FrostKeyShare[],
  newIndices: readonly number[],
  newThreshold: number,
  random?: () => number,
): FrostKeygenResult {
  const contributingSet = contributingShares.map((s) => s.x);
  const bundles = contributingShares.map((s) =>
    reshareContribute(s, contributingSet, newIndices, newThreshold, random),
  );
  const contributions = bundles.map((b) => b.contribution);

  if (!verifyResharePreservesGroupKey(groupPublicKey, contributions)) {
    throw new Error("frost-reshare: contributions do not reconstruct the group public key");
  }

  const allSubshares = bundles.flatMap((b) => b.subshares);
  const shares = newIndices.map((toX) => reshareCombine(toX, contributions, allSubshares));

  return { groupPublicKey, threshold: newThreshold, shares };
}
