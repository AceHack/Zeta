// FROST distributed key generation (RFC 9591 / Feldman VSS) — no trusted dealer.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// Slice 1: in-process n-party ceremony (simulates network rounds locally for tests/CLI).
// Each participant generates a degree-(k-1) polynomial; shares are verified against
// coefficient commitments before aggregation. No party ever holds the full group scalar.
//
// Not yet: networked transport, ROAST signing robustness, Pedersen (hiding) commitments.
//
// Anchors: RFC 9591; Gennaro et al. secure DKG; Komlo & Goldberg FROST.

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  frostThresholdSign,
  frostVerify,
  type FrostKeygenResult,
  type FrostKeyShare,
} from "./frost.ts";

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
  for (let i = buf.length - 1; i >= 0; i--) {
    s = (s << 8n) + BigInt(buf[i]!);
  }
  s = Fn.create(s);
  if (Fn.is0(s)) s = Fn.ONE;
  return s;
}

/** f(x) = Σ c_j x^j  (mod L). */
function evalPolynomial(coeffs: readonly bigint[], x: bigint): bigint {
  let acc = Fn.ZERO;
  let xp = Fn.ONE;
  for (const c of coeffs) {
    acc = Fn.add(acc, Fn.mul(c, xp));
    xp = Fn.mul(xp, x);
  }
  return acc;
}

/** Σ A_j · x^j  where A_j = a_j·G (point Horner). */
function evalCommitments(commitments: readonly Uint8Array[], x: bigint): InstanceType<typeof ed25519.Point> {
  let acc = ed25519.Point.ZERO;
  let xp = Fn.ONE;
  for (const c of commitments) {
    acc = acc.add(ed25519.Point.fromBytes(c).multiply(xp));
    xp = Fn.mul(xp, x);
  }
  return acc;
}

/** Feldman check: received scalar share matches sender's coefficient commitments. */
export function verifyDkgShare(
  commitments: readonly Uint8Array[],
  recipientIndex: number,
  shareScalar: bigint,
): boolean {
  if (recipientIndex < 1) return false;
  const x = Fn.create(BigInt(recipientIndex));
  const expected = evalCommitments(commitments, x);
  return expected.equals(G.multiply(shareScalar));
}

export interface DkgRound1Package {
  readonly participantId: number;
  /** A_j = a_j·G for j = 0..k-1. */
  readonly commitments: readonly Uint8Array[];
}

export interface DkgRound2Package {
  readonly senderId: number;
  readonly recipientId: number;
  readonly shareScalar: bigint;
}

/**
 * Run a full n-party DKG ceremony in-process (all parties simulated).
 * Returns the same shape as trusted-dealer `frostKeygen` for drop-in custody use.
 */
export function frostDkgKeygen(
  threshold: number,
  participants: number,
  random?: () => number,
): FrostKeygenResult {
  if (threshold < 1 || participants < threshold) {
    throw new Error("frost-dkg: require 1 ≤ k ≤ n");
  }

  const polys: bigint[][] = [];
  const round1: DkgRound1Package[] = [];

  for (let pid = 1; pid <= participants; pid++) {
    const coeffs = Array.from({ length: threshold }, () => randScalar(random));
    polys.push(coeffs);
    round1.push({
      participantId: pid,
      commitments: coeffs.map((c) => G.multiply(c).toBytes()),
    });
  }

  const round2: DkgRound2Package[] = [];
  for (let sender = 1; sender <= participants; sender++) {
    const coeffs = polys[sender - 1]!;
    const pkg = round1[sender - 1]!;
    for (let recipient = 1; recipient <= participants; recipient++) {
      const shareScalar = evalPolynomial(coeffs, Fn.create(BigInt(recipient)));
      if (!verifyDkgShare(pkg.commitments, recipient, shareScalar)) {
        throw new Error(`frost-dkg: internal share verify failed sender=${String(sender)} recipient=${String(recipient)}`);
      }
      round2.push({ senderId: sender, recipientId: recipient, shareScalar });
    }
  }

  const shares: FrostKeyShare[] = [];
  let groupPt = ed25519.Point.ZERO;
  for (const pkg of round1) {
    groupPt = groupPt.add(ed25519.Point.fromBytes(pkg.commitments[0]!));
  }

  for (let recipient = 1; recipient <= participants; recipient++) {
    let secretShare = Fn.ZERO;
    for (const pkg of round2) {
      if (pkg.recipientId !== recipient) continue;
      secretShare = Fn.add(secretShare, pkg.shareScalar);
    }
    shares.push({ x: recipient, secretShare });
  }

  return {
    groupPublicKey: groupPt.toBytes(),
    threshold,
    shares,
  };
}

/** Sanity: DKG output signs and verifies like dealer keygen. */
export function frostDkgSmokeSign(
  kg: FrostKeygenResult,
  message: Uint8Array,
  random?: () => number,
): boolean {
  const sig = frostThresholdSign(kg.groupPublicKey, kg.shares, message, random, kg.threshold);
  return frostVerify(kg.groupPublicKey, message, sig);
}
