// tools/research/adinkra-ecc/adinkra-ecc-prototype.ts
//
// 081KRW63S0008QG0R000QJR08H acceptance #3 — "one constructive proof path: small Adinkra → ECC code →
// cryptographic primitive." Toy scale, test-guarded.
//
// The primer (docs/research/2026-05-21-adinkra-primer-for-non-physicists-zeta-substrate-context.md)
// established: an Adinkra's chromotopology IS a hypercube H_n quotiented by a
// doubly-even self-dual binary code C. The smallest interesting case is the
// [8,4,4] extended Hamming code (the unique doubly-even self-dual code of length 8).
//
// This module CONSTRUCTS that code, VERIFIES the two load-bearing properties
// (doubly-even + self-dual — the structural requirements that make it an Adinkra
// code AND give it ECC error-resistance), and derives a deterministic key-seed
// from it (the "code → key" path). The point is the constructive proof that ONE
// structure yields both the ECC (protect-from-errors) and key material
// (protect-from-being-seen) — 081KRW63S0008QG0R000QJR08H's dual-use claim, at toy scale.
//
// SUBSTRATE-HONESTY (per the primer's razor note): deriving key MATERIAL from the
// code is a deterministic construction; turning it into a production key needs a
// real KDF (blake3 per the Lucent-KSK substrate) + the open security questions in
// the primer (indistinguishability / forward-secrecy / non-compromise of the ECC)
// are NOT answered here. This is the proof-of-construction, not a security claim.

import { createHash } from "node:crypto";

/** A length-8 binary codeword as a tuple of 8 bits (0|1). */
export type Bits8 = readonly [number, number, number, number, number, number, number, number];

/**
 * Generator matrix G = [I_4 | A] for the [8,4,4] extended Hamming code, where
 * A = J + I (mod 2) = the 4×4 all-ones-off-diagonal matrix. Each generator row
 * has weight 4 (1 from I + 3 from A) ⇒ doubly-even generators. A·Aᵀ = I (mod 2)
 * ⇒ G·Gᵀ = I + A·Aᵀ = 0 (mod 2) ⇒ self-orthogonal; with dim = n/2 = 4 ⇒ self-dual.
 * (Derivation verified in the module doc / the test below.)
 */
export const EXTENDED_HAMMING_8_4_4_GENERATOR: readonly Bits8[] = [
  [1, 0, 0, 0, 0, 1, 1, 1],
  [0, 1, 0, 0, 1, 0, 1, 1],
  [0, 0, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 1, 1, 1, 0],
];

/** XOR two length-8 bit vectors (GF(2) addition). */
export function xor8(a: Bits8, b: Bits8): Bits8 {
  // Construct the 8-tuple explicitly: literal indices on a Bits8 tuple are
  // exact `number` (not `number | undefined`), so the return type is honest
  // without an `as unknown as Bits8` cast.
  return [
    a[0] ^ b[0], a[1] ^ b[1], a[2] ^ b[2], a[3] ^ b[3],
    a[4] ^ b[4], a[5] ^ b[5], a[6] ^ b[6], a[7] ^ b[7],
  ];
}

/** Hamming weight (number of 1-bits). */
export function weight(c: Bits8): number {
  return c.reduce((acc, bit) => acc + bit, 0);
}

/** Standard inner product mod 2 (used for self-duality / orthogonality). */
export function dotMod2(a: Bits8, b: Bits8): number {
  // Literal indices keep each `&` operand exact `number` (honest under
  // noUncheckedIndexedAccess); the chained XOR is the GF(2) inner product.
  return (
    (a[0] & b[0]) ^ (a[1] & b[1]) ^ (a[2] & b[2]) ^ (a[3] & b[3]) ^
    (a[4] & b[4]) ^ (a[5] & b[5]) ^ (a[6] & b[6]) ^ (a[7] & b[7])
  );
}

/**
 * Enumerate the linear code spanned by `generators` — the SET of distinct
 * codewords, each the GF(2) sum of a subset of rows. For k linearly-independent
 * generators (the [8,4,4] case, whose I_4 block guarantees independence) this is
 * exactly 2^k words. If the rows are NOT independent the code is smaller than
 * 2^k, so duplicate sums are de-duplicated here rather than over-counted — this
 * keeps `isSelfDual`'s `|C| = 2^(n/2)` dimension check honest (a dependent
 * generator set would otherwise inflate `codewords.length` and false-positive).
 */
export function enumerateCodewords(generators: readonly Bits8[]): Bits8[] {
  const k = generators.length;
  const zero: Bits8 = [0, 0, 0, 0, 0, 0, 0, 0];
  const seen = new Set<string>();
  const out: Bits8[] = [];
  for (let mask = 0; mask < 1 << k; mask++) {
    let cw: Bits8 = zero;
    for (let i = 0; i < k; i++) {
      const row = generators[i];
      if (row !== undefined && (mask & (1 << i))) cw = xor8(cw, row);
    }
    const key = cw.join("");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cw);
    }
  }
  return out;
}

/** Doubly-even: EVERY codeword has Hamming weight divisible by 4. */
export function isDoublyEven(codewords: readonly Bits8[]): boolean {
  return codewords.every((c) => weight(c) % 4 === 0);
}

/**
 * Self-dual: C = C⊥. For a length-n code we check (a) self-orthogonal — every
 * pair of codewords is orthogonal under the mod-2 inner product — and (b) the
 * dimension is n/2 (|C| = 2^(n/2)). Self-orthogonal + dim n/2 ⟹ C = C⊥.
 */
export function isSelfDual(codewords: readonly Bits8[], n = 8): boolean {
  const selfOrthogonal = codewords.every((a) => codewords.every((b) => dotMod2(a, b) === 0));
  const correctDimension = codewords.length === 2 ** (n / 2);
  return selfOrthogonal && correctDimension;
}

/**
 * Canonical, order-independent serialization of the code (the set of codewords,
 * sorted) — deterministic key MATERIAL. Same code ⇒ same string, regardless of
 * generator-row order or enumeration order.
 */
export function canonicalCodeMaterial(codewords: readonly Bits8[]): string {
  return codewords
    .map((c) => c.join(""))
    .sort()
    .join("|");
}

/**
 * Derive a deterministic key-seed (hex) from the code material via SHA-256.
 * The "code → key" proof path: the SAME code always yields the SAME seed; a
 * production KDF would substitute blake3 (Lucent-KSK substrate) + add the
 * security properties the primer flags as open research.
 *
 * Uses `node:crypto` `createHash` — the repo-uniform hashing pattern (vs the
 * WebCrypto `crypto.subtle` async path) — so the call is synchronous and
 * consistent with the rest of `tools/`.
 */
export function deriveKeySeed(codewords: readonly Bits8[]): string {
  const material = canonicalCodeMaterial(codewords);
  return createHash("sha256").update(material, "utf8").digest("hex");
}

/** The full constructive proof path, as one object (code → properties → key). */
export function adinkraEccProof(): {
  codewords: Bits8[];
  doublyEven: boolean;
  selfDual: boolean;
  dimension: number;
  keySeed: string;
} {
  const codewords = enumerateCodewords(EXTENDED_HAMMING_8_4_4_GENERATOR);
  return {
    codewords,
    doublyEven: isDoublyEven(codewords),
    selfDual: isSelfDual(codewords),
    dimension: EXTENDED_HAMMING_8_4_4_GENERATOR.length,
    keySeed: deriveKeySeed(codewords),
  };
}
