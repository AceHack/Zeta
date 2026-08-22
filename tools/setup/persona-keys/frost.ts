// Zeta FROST-shaped threshold Schnorr (Ed25519) — live signing without key reassembly
// (081KVP3GYW1 deferred slice; agent-native-key-custody design Layer 2).
//
// Monorepo discipline: this lives under tools/setup/persona-keys/ beside shamir.ts and
// ca-shamir-custody.ts — tools-over-trunks forces the move here, not a sidecar service.
//
// Scope (slice 1 — dealer oracle):
//   * Trusted-dealer keygen: Shamir-split the Ed25519 scalar over the curve order L.
//   * Threshold sign: k shares produce a standard Ed25519 signature via partial z-shares.
//   * The full signing scalar is NEVER summed from shares during sign (only partials combine).
//   * Dealer briefly holds the scalar at keygen (same honesty class as Shamir split).
//
// Not yet: full RFC 9591 DKG, ROAST, nonce-commitment binding, HSM-sealed shares.
// Prefer this over Shamir reassembly for any live CA/signing path.
//
// Anchors: Komlo & Goldberg FROST (2020); RFC 9591; Ed25519 (Bernstein et al.).

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";

const Fn = ed25519.Point.Fn;
const G = ed25519.Point.BASE;

export interface FrostKeyShare {
  /** Participant index x ∈ {1..n}. */
  readonly x: number;
  /** Shamir share of the signing scalar (mod L). */
  readonly secretShare: bigint;
}

export interface FrostKeygenResult {
  /** 32-byte compressed Ed25519 group public key. */
  readonly groupPublicKey: Uint8Array;
  readonly threshold: number;
  readonly shares: readonly FrostKeyShare[];
}

export interface FrostSignSession {
  /** Group nonce commitment R (32 bytes). */
  readonly R: Uint8Array;
  /** Challenge scalar c = H(R || A || m) mod L. */
  readonly challenge: bigint;
  /** Lagrange coefficients λ_x for each participant in the signing set. */
  readonly lambdas: ReadonlyMap<number, bigint>;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function bytesToNumberLE(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    n = (n << 8n) + BigInt(bytes[i]!);
  }
  return n;
}

function numberToBytesLE(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let x = n;
  for (let i = 0; i < len; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

/** Challenge hash matching Ed25519: SHA-512(R || A || M) reduced mod L. */
export function frostChallenge(R: Uint8Array, groupPublicKey: Uint8Array, message: Uint8Array): bigint {
  const h = sha512(concatBytes(R, groupPublicKey, message));
  return Fn.create(bytesToNumberLE(h));
}

/** Lagrange coefficient λ_i for f(0) given participant set `xs` (all x in 1..n). */
export function lagrangeCoefficient(i: number, xs: readonly number[]): bigint {
  let num = Fn.ONE;
  let den = Fn.ONE;
  for (const j of xs) {
    if (j === i) continue;
    num = Fn.mul(num, Fn.neg(Fn.create(BigInt(j))));
    den = Fn.mul(den, Fn.create(BigInt(i - j)));
  }
  return Fn.mul(num, Fn.inv(den));
}

/**
 * Uniform scalar in (0, L).
 *
 * P0 FIX 2026-08-14: the default source used to be Math.random. Every production call
 * site reached that default (frost-ca-custody.ts passes no random for keygen or for
 * signing), so the CA group signing scalar, the Shamir coefficients, and EVERY FROST
 * NONCE were drawn from a non-cryptographic PRNG. V8 Math.random is xorshift128+ with
 * a recoverable internal state, and a recoverable FROST nonce yields the share
 * directly from z_i = k_i + c * lambda_i * s_i. The injected `random` door is kept
 * unchanged for DST replay; only the DEFAULT moved to the OS CSPRNG.
 */
function randScalar(random?: () => number): bigint {
  // Wide-reduce into (0, L) using 64 random bytes.
  const buf = new Uint8Array(64);
  if (random === undefined) {
    buf.set(nodeRandomBytes(64));
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(random() * 256);
  }
  let s = Fn.create(bytesToNumberLE(buf));
  if (Fn.is0(s)) s = Fn.ONE;
  return s;
}

/**
 * Dealer keygen: sample signing scalar, publish group PK, Shamir-split into n shares (threshold k).
 * Dealer holds the scalar only for this call — shares are the durable custody units.
 */
export function frostKeygen(
  threshold: number,
  participants: number,
  random?: () => number,
): FrostKeygenResult {
  if (threshold < 1 || participants < threshold) {
    throw new Error("frost: require 1 ≤ k ≤ n");
  }
  const secret = randScalar(random);
  const groupPublicKey = G.multiply(secret).toBytes();

  // Shamir over L: f(x) = secret + a1·x + … + a_{k-1}·x^{k-1}
  const coeffs = [secret, ...Array.from({ length: threshold - 1 }, () => randScalar(random))];
  const shares: FrostKeyShare[] = [];
  for (let i = 1; i <= participants; i++) {
    let y = Fn.ZERO;
    let xp = Fn.ONE;
    const x = Fn.create(BigInt(i));
    for (const c of coeffs) {
      y = Fn.add(y, Fn.mul(c, xp));
      xp = Fn.mul(xp, x);
    }
    shares.push({ x: i, secretShare: y });
  }
  return { groupPublicKey, threshold, shares };
}

/**
 * Open a signing session for a participant set: each provides a nonce commitment R_i,
 * coordinator sums to R and computes the challenge + Lagrange map.
 */
export function frostOpenSession(
  groupPublicKey: Uint8Array,
  message: Uint8Array,
  participantIndices: readonly number[],
  nonceCommitments: readonly Uint8Array[],
): FrostSignSession {
  if (participantIndices.length !== nonceCommitments.length) {
    throw new Error("frost: participant/commitment length mismatch");
  }
  if (participantIndices.length < 1) throw new Error("frost: empty signing set");

  let Rpt = ed25519.Point.ZERO;
  for (const c of nonceCommitments) {
    Rpt = Rpt.add(ed25519.Point.fromBytes(c));
  }
  const R = Rpt.toBytes();
  const challenge = frostChallenge(R, groupPublicKey, message);
  const lambdas = new Map<number, bigint>();
  for (const i of participantIndices) {
    lambdas.set(i, lagrangeCoefficient(i, participantIndices));
  }
  return { R, challenge, lambdas };
}

/** Participant: sample nonce, return commitment R_i = [k_i]B and the nonce scalar (keep local). */
export function frostNonceCommit(random?: () => number): { nonce: bigint; commitment: Uint8Array } {
  const nonce = randScalar(random);
  return { nonce, commitment: G.multiply(nonce).toBytes() };
}

/**
 * Participant partial: z_i = k_i + c · λ_i · s_i  (mod L).
 * Never receives other parties' secret shares.
 */
export function frostPartialSign(
  share: FrostKeyShare,
  session: FrostSignSession,
  nonce: bigint,
): bigint {
  const lambda = session.lambdas.get(share.x);
  if (lambda === undefined) {
    throw new Error(`frost: participant ${String(share.x)} not in signing set`);
  }
  const cShare = Fn.mul(session.challenge, Fn.mul(lambda, share.secretShare));
  return Fn.add(nonce, cShare);
}

/**
 * Coordinator: combine partial z-shares into a standard 64-byte Ed25519 signature (R || S).
 * Does not take secret shares — only partials and R.
 */
export function frostCombine(session: FrostSignSession, partials: readonly bigint[]): Uint8Array {
  let z = Fn.ZERO;
  for (const p of partials) z = Fn.add(z, p);
  return concatBytes(session.R, numberToBytesLE(z, 32));
}

/** Verify a threshold-produced signature against the group public key (standard Ed25519). */
export function frostVerify(
  groupPublicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  return ed25519.verify(signature, message, groupPublicKey);
}

/**
 * End-to-end threshold sign for tests/CLI: runs commit → open → partial → combine.
 * Secret shares are only used inside frostPartialSign (never summed to the dealer scalar).
 */
export function frostThresholdSign(
  groupPublicKey: Uint8Array,
  shares: readonly FrostKeyShare[],
  message: Uint8Array,
  random?: () => number,
  threshold?: number,
): Uint8Array {
  const k = threshold ?? shares.length;
  if (shares.length < k) {
    throw new Error(`frost: need at least ${String(k)} shares, got ${String(shares.length)}`);
  }
  const used = shares.slice(0, k);
  const indices = used.map((s) => s.x);
  const nonces = used.map(() => frostNonceCommit(random));
  const session = frostOpenSession(
    groupPublicKey,
    message,
    indices,
    nonces.map((n) => n.commitment),
  );
  const partials = used.map((s, i) => frostPartialSign(s, session, nonces[i]!.nonce));
  return frostCombine(session, partials);
}
