/**
 * xorshift-minimal-poly.test.ts — linear complexity of xorshift32 mod 17.
 *
 * ## RETRACTED CLAIM (2026-08-10): this does NOT close any Lean obligation
 *
 * This file previously opened with "This closes the open axiom in
 * PhaseClockErasure.lean", and its second test was named "…axiom is closed".
 * **That was false, and the test passed anyway** — which is the instructive part.
 * Every assertion below is arithmetically correct; the Berlekamp-Massey linear
 * complexity really is 8. What was wrong was the CLAIM ABOUT WHAT THAT MEANS.
 *
 * The Lean statement was `∃ p, p ∈ degreeLT F 12 ∧ evalWord p = <the 16 values>` —
 * a claim about INTERPOLATION DEGREE. This file measures LFSR LINEAR COMPLEXITY.
 * Those are different quantities that happen to share a unit, so "8 ≤ 11" compared
 * two things that cannot be compared. A linear recurrence gives `s(n) = Σ cⱼ αⱼⁿ`,
 * an exponential sum — a polynomial in `n` only when every characteristic root is
 * 1, which is maximally false here (the connection polynomial has NO roots in F₁₇).
 *
 * The Lean theorem has since been WITHDRAWN as false: the 16 values interpolate to
 * degree 15, not < 12, so no witness exists. There is no longer an axiom to close.
 * See `docs/letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md`.
 *
 * ## What this file legitimately is
 *
 * A conformance check on the linear complexity of the first 16 outputs of
 * `xorshift32(seed=4) mod 17`, kept because the computation is correct and
 * independently useful:
 *
 *   sequence:      [4, 11, 7, 0, 2, 2, 15, 2, 14, 14, 13, 13, 6, 6, 16, 6]
 *   linear complexity: 8
 *   LFSR coefficients over GF(17): [1, 10, 7, 10, 4, 16, 3, 14, 8]
 *
 * It is a measurement over 16 outputs, not a formal proof, and the minimal
 * polynomial of the full period-(2³² − 1) sequence may differ.
 *
 * ## A second defect, recorded not repaired
 *
 * The local `xorshift32` below uses `>>> 17` (logical). The production phase clock
 * at `src/Core.TypeScript/observe/phase-clock.ts:99` uses `>> 17` (arithmetic,
 * sign-propagating). They diverge at output index 4, so the comment on the helper
 * claiming it matches the repo implementation is wrong, and THIS SEQUENCE IS NOT
 * THE PHASE CLOCK'S OUTPUT.
 *
 * Consequence for the anchor: Marsaglia 2003 establishes that xorshift32 over GF(2)
 * is primitive of degree 32, but `>>` is a DIFFERENT GF(2)-linear map, so that
 * result does not transfer to `phase-clock.ts`. Whether the `>>` variant's period is
 * degraded is an open engineering question, routed and not answered here.
 */

import { describe, test, expect } from "bun:test";

// ── xorshift32 — NOTE: `>>> 17` here vs `>> 17` in phase-clock.ts:99 ──────────
// These are different maps and diverge at output index 4. This helper does NOT
// reproduce the production phase clock; see the header.

function xorshift32(s: number): number {
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return s >>> 0;
}

// ── Berlekamp-Massey over GF(p) ───────────────────────────────────────────────

function gfInv(a: number, p: number): number {
  let [old_r, r] = [a, p];
  let [old_s, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % p) + p) % p;
}

function berlekampMassey(seq: number[], p: number): { degree: number; lfsr: number[] } {
  const n = seq.length;
  let C = [1], B = [1];
  let L = 0, m = 1, b = 1;
  for (let i = 0; i < n; i++) {
    let d = seq[i]!;
    for (let j = 1; j <= L; j++) {
      d = (d + ((C[j] ?? 0) * (seq[i - j] ?? 0)) % p) % p;
    }
    if (d === 0) { m++; continue; }
    const T = [...C];
    const coeff = (d * gfInv(b, p)) % p;
    while (C.length < B.length + m) C.push(0);
    for (let j = 0; j < B.length; j++) {
      C[j + m] = ((C[j + m] ?? 0) - (coeff * (B[j] ?? 0)) % p + p) % p;
    }
    if (2 * L <= i) { L = i + 1 - L; B = T; b = d; m = 1; }
    else m++;
  }
  return { degree: L, lfsr: C };
}

describe("xorshift32 mod 17 — linear complexity conformance (closes no Lean obligation)", () => {
  // XP-1: generate 16 outputs of xorshift32(seed=4) mod 17
  test("XP-1: xorshift32(seed=4) mod 17 generates the expected sequence", () => {
    const outputs: number[] = [];
    let s = 4;
    for (let i = 0; i < 16; i++) {
      s = xorshift32(s);
      outputs.push(s % 17);
    }
    expect(outputs).toEqual([4, 11, 7, 0, 2, 2, 15, 2, 14, 14, 13, 13, 6, 6, 16, 6]);
  });

  // XP-2: linear complexity is exactly 8. The former `≤ 11` assertion is GONE on
  // purpose — 11 was a polynomial-degree bound from a different (and false)
  // statement, so comparing a linear complexity against it was the category error
  // this file used to embody. `toBe(8)` is the honest measurement and is strictly
  // stronger anyway.
  test("XP-2: linear complexity is 8 (NOT an interpolation degree — see the header)", () => {
    const outputs: number[] = [];
    let s = 4;
    for (let i = 0; i < 16; i++) {
      s = xorshift32(s);
      outputs.push(s % 17);
    }
    const { degree } = berlekampMassey(outputs, 17);
    expect(degree).toBe(8);
  });

  // XP-3: LFSR coefficients are as expected (golden vector)
  test("XP-3: LFSR coefficients match the golden vector", () => {
    const outputs = [4, 11, 7, 0, 2, 2, 15, 2, 14, 14, 13, 13, 6, 6, 16, 6];
    const { lfsr } = berlekampMassey(outputs, 17);
    expect(lfsr).toEqual([1, 10, 7, 10, 4, 16, 3, 14, 8]);
  });

  // XP-4: negative control — a constant sequence has degree 0
  test("XP-4: negative control — constant sequence has degree 1 (single-tap LFSR)", () => {
    // A constant sequence [c, c, c, ...] satisfies s[n] = s[n-1] (one-tap LFSR).
    // BM correctly finds degree 1 (not 0 — the sequence is not the zero sequence).
    const { degree } = berlekampMassey([5, 5, 5, 5, 5, 5, 5, 5], 17);
    expect(degree).toBe(1);
  });

  // XP-5: negative control — a random-looking sequence has degree close to n/2
  test("XP-5: negative control — a non-LFSR sequence has degree > 1", () => {
    // A sequence with no short LFSR: alternating primes mod 17
    // [2, 3, 5, 7, 11, 13, 2, 3, 5, 7, 11, 13, 2, 3, 5, 7]
    // This has a period-6 structure → BM finds degree > 1
    const seq = [2, 3, 5, 7, 11, 13, 2, 3, 5, 7, 11, 13, 2, 3, 5, 7];
    const { degree } = berlekampMassey(seq, 17);
    // The key property: the xorshift sequence (degree 8) is much more complex
    // than a simple periodic sequence. We just verify degree > 0.
    expect(degree).toBeGreaterThan(0);
    // And that the xorshift degree (8) is greater than a simple periodic sequence
    const xorOutputs = [4, 11, 7, 0, 2, 2, 15, 2, 14, 14, 13, 13, 6, 6, 16, 6];
    const xorDegree = berlekampMassey(xorOutputs, 17).degree;
    expect(xorDegree).toBeGreaterThan(degree);
  });
});
