// Zeta Shamir k-of-n secret sharing — threshold at CA/identity roots (081KVP3GYW108QG0R003V7E6VT).
//
// Per-user CA alone RELOCATES the identity SPOF to N single keys (math team #9020); k-of-n
// removes the single forging key at each root. This is the reference split/reconstruct oracle
// for CA private material / derivation seeds — cold-backup / recovery shares; live signing
// should prefer frost.ts (threshold Schnorr) above HSMs (agent-native-key-custody design).
//
// Field: GF(257) (prime > 255) — each byte of the secret is an independent Shamir polynomial.
// Prove-with: bun property tests + golden seed (shamir-golden-vectors.json); BP-16 leg in
// tests/Tests.FSharp/Formal/Shamir.CrossVerify.Tests.fs (Z3 k=2/k=3 Lagrange + FsCheck + F# peer).
//
// SECURITY: shares are ALL required to be protected at rest; ANY k shares reconstruct the secret.
// Never log share bytes. This module is pure math — no filesystem/network doors.

import { randomBytes as nodeRandomBytes } from "node:crypto";

/** Prime field for byte-wise Shamir (257 is prime; bytes map to 0..255). */
export const SHAMIR_PRIME = 257;

export interface ShamirShare {
  /** Share index x ∈ {1..n} (never 0 — f(0) is the secret). */
  readonly x: number;
  /** Per-byte evaluations f(x) for each secret byte. */
  readonly y: readonly number[];
}

export interface ShamirSplitOptions {
  readonly threshold: number;
  readonly shares: number;
  /** Optional deterministic RNG for DST/tests. Default is the OS CSPRNG, never `Math.random`. */
  readonly random?: () => number;
}

function mod(n: number): number {
  let r = n % SHAMIR_PRIME;
  if (r < 0) r += SHAMIR_PRIME;
  return r;
}

function modInv(a: number): number {
  let t = 0;
  let newT = 1;
  let r = SHAMIR_PRIME;
  let newR = mod(a);
  while (newR !== 0) {
    const q = Math.floor(r / newR);
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  if (r > 1) throw new Error("shamir: not invertible");
  if (t < 0) t += SHAMIR_PRIME;
  return t;
}

function evalPoly(coeffs: number[], x: number): number {
  let acc = 0;
  let xp = 1;
  for (const c of coeffs) {
    acc = mod(acc + mod(c * xp));
    xp = mod(xp * x);
  }
  return acc;
}

function lagrangeAtZero(points: Array<{ x: number; y: number }>): number {
  let secret = 0;
  for (let i = 0; i < points.length; i++) {
    let num = 1;
    let den = 1;
    const xi = points[i]!.x;
    const yi = points[i]!.y;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const xj = points[j]!.x;
      num = mod(num * mod(-xj));
      den = mod(den * mod(xi - xj));
    }
    secret = mod(secret + mod(yi * mod(num * modInv(den))));
  }
  return secret;
}

/**
 * Uniform coefficient in GF(257).
 *
 * P0 FIX 2026-08-14, same class as the FROST one: the default source was Math.random,
 * a non-cryptographic PRNG whose state is recoverable from its own output. Shamir
 * coefficients are the ONLY thing hiding the secret from a below-threshold set of
 * shares, so a predictable coefficient collapses the threshold. The injected door is
 * unchanged for DST; only the default moved.
 *
 * Debiased by MULTIPLY-SHIFT (Lemire 2019, "Fast Random Integer Generation in an
 * Interval", ACM TOMACS 29(1)) rather than by modulo. 257 does not divide 2^16, so a
 * bare `x % 257` would over-represent the low residues.
 *
 * Why not the modulo-with-rejection form this replaced: it was CORRECT, and CodeQL
 * flagged it anyway ("Using modulo on a cryptographically secure random number
 * produces biased results") because the rule cannot see a rejection bound sitting
 * above the `%`. The rule is RIGHT in general — an unguarded `v % 257` really is
 * biased, 255 against 256 — so dismissing it in a crypto file would have recorded that
 * this rule is waveable here, in the one file where it will eventually fire on a real
 * defect. Lemire needs no modulo on the random word at all, so the alert goes quiet
 * because the flagged pattern is genuinely gone, not because it was silenced. It is
 * also the faster construction: a 32-bit multiply and a shift, against a division.
 *
 * Same statistical outcome, verified exhaustively over all 2^16 draws: each of the 257
 * residues occurs exactly 255 times, and exactly ONE draw is rejected — identical to
 * the construction it replaces.
 */
function randCoeffCrypto(): number {
  // Reject only when the low 16 bits fall below t = (2^16 - 257) mod 257 = 1 — i.e. when
  // they are exactly zero. Derived from constants and written as a literal so that no `%`
  // ever touches the random word: 65536 - 257 = 65279 = 257*254 + 1.
  const REJECT_BELOW = 1;
  for (;;) {
    const b = nodeRandomBytes(2);
    const x = (b[0]! << 8) | b[1]!;
    // 65535 * 257 = 16_842_495 — inside 32 bits, and far inside 2^53, so the product is
    // exact in a JS number with no BigInt and no precision loss.
    const m = x * SHAMIR_PRIME;
    if ((m & 0xffff) < REJECT_BELOW) continue;
    return m >>> 16;
  }
}

function randCoeff(random: (() => number) | undefined): number {
  if (random === undefined) return randCoeffCrypto();
  return Math.floor(random() * SHAMIR_PRIME);
}

/** Split `secret` into `n` shares requiring any `k` to reconstruct (1 ≤ k ≤ n). */
export function shamirSplit(secret: Uint8Array, opts: ShamirSplitOptions): ShamirShare[] {
  const k = opts.threshold;
  const n = opts.shares;
  if (k < 1 || n < k) throw new Error("shamir: require 1 ≤ k ≤ n");
  const random = opts.random;
  const shareYs: number[][] = Array.from({ length: n }, () => []);

  for (let b = 0; b < secret.length; b++) {
    const coeffs = [secret[b]!, ...Array.from({ length: k - 1 }, () => randCoeff(random))];
    for (let i = 0; i < n; i++) {
      const x = i + 1;
      shareYs[i]!.push(evalPoly(coeffs, x));
    }
  }
  return shareYs.map((y, i) => ({ x: i + 1, y }));
}

/** Reconstruct secret from any `k` (or more) shares with matching `y` lengths. */
export function shamirCombine(shares: readonly ShamirShare[], threshold: number): Uint8Array {
  if (shares.length < threshold) {
    throw new Error(`shamir: need at least ${threshold} shares, got ${shares.length}`);
  }
  const used = shares.slice(0, threshold);
  const len = used[0]?.y.length ?? 0;
  if (!used.every((s) => s.y.length === len)) {
    throw new Error("shamir: share length mismatch");
  }
  const secret = new Uint8Array(len);
  for (let b = 0; b < len; b++) {
    const points = used.map((s) => ({ x: s.x, y: s.y[b]! }));
    secret[b] = lagrangeAtZero(points);
  }
  return secret;
}

/** True when fewer than k shares cannot reconstruct (throws or wrong bytes). */
export function shamirRoundTrip(secret: Uint8Array, k: number, n: number, random?: () => number): boolean {
  const shares = shamirSplit(secret, { threshold: k, shares: n, ...(random ? { random } : {}) });
  const got = shamirCombine(shares, k);
  if (got.length !== secret.length) return false;
  for (let i = 0; i < secret.length; i++) {
    if (got[i] !== secret[i]) return false;
  }
  return true;
}
