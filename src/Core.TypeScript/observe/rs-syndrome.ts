/**
 * rs-syndrome.ts — Reed-Solomon syndrome computation for error DETECTION.
 *
 * The RS [16,12] erasure decoder (rs-phase-codec.ts) trusts all received symbols.
 * If a symbol is silently corrupted (wrong value, not marked as erased), the decoder
 * produces a wrong answer without warning. This module adds DETECTION:
 *
 *   syndrome(word) = [S_1, S_2, S_3, S_4]
 *
 * A valid RS codeword has all-zero syndrome. A non-zero syndrome proves at least
 * one symbol is corrupted — the decoder should NOT be trusted for that block.
 *
 * ## What this detects vs what it corrects
 *
 * - Detection: up to d-1 = 4 errors (any pattern of ≤ 4 corrupted symbols)
 * - Correction: 0 errors (this module only DETECTS; correction needs Berlekamp-Massey
 *   or Euclidean algorithm, which is a larger project)
 * - The erasure decoder handles the correction case when positions ARE known
 *
 * ## Usage in the pipeline
 *
 * Before trusting a block from `data/rs-blocks.jsonl`:
 *   1. Compute `syndrome(block.coded)`
 *   2. If all zeros → block is valid, proceed with decode/query
 *   3. If non-zero → block is corrupted, DO NOT trust the decoded values
 *
 * ## Connection to the Lean4 proof
 *
 * The RS [16,12] code has minimum distance d = 5 (proven in ErasureDistance.lean).
 * Any two distinct codewords differ in at least 5 positions. Therefore:
 *   - 1-4 corrupted symbols → guaranteed non-zero syndrome (detected)
 *   - 5+ corrupted symbols → MIGHT look like a different valid codeword (undetected)
 *
 * ## The math
 *
 * For RS over GF(17) with evaluation points 0..15 and generator polynomial
 * g(x) = (x-α)(x-α²)(x-α³)(x-α⁴) where α is a primitive root of GF(17):
 *
 * The syndrome S_j = Σᵢ received[i] * αⁱʲ for j = 1..4
 *
 * But since our evaluation points are 0..15 (not powers of a primitive root),
 * we use the parity-check approach: a valid codeword w satisfies H·w = 0
 * where H is the 4×16 parity-check matrix.
 *
 * Simpler equivalent: a word w is in rsCode iff it's the evaluation of some
 * degree-< 12 polynomial. So: interpolate from all 16 points, check if the
 * resulting polynomial has degree < 12. If it does, the word is valid.
 * If it doesn't, it's corrupted.
 *
 * Even simpler: interpolate from any 12 points, evaluate at the other 4.
 * If the evaluations match the received values, the word is consistent.
 * If they don't, corruption is detected.
 */

import { mod, polyEval, lagrangeInterpolate, EVAL_POINTS, K, N } from "./rs-phase-codec";

// ═══ Syndrome Computation ═════════════════════════════════════════════════════

/**
 * The syndrome of a received word: check if it lies on a degree-< 12 polynomial.
 *
 * Method: interpolate through the FIRST 12 symbols (positions 0..11), then
 * evaluate the resulting polynomial at positions 12..15. The differences
 * between the evaluated values and the received values at those positions
 * ARE the syndrome.
 *
 * All zeros → valid codeword (consistent with a degree-< 12 polynomial).
 * Non-zero → at least one symbol is corrupted.
 */
export function syndrome(word: readonly number[]): number[] {
  if (word.length !== N) {
    throw new Error(`syndrome requires a ${N}-symbol word, got ${word.length}`);
  }

  // Reduce all values to GF(17)
  const w = word.map(mod);

  // Interpolate through the first K=12 symbols
  const points = w.slice(0, K).map((y, i) => ({ x: EVAL_POINTS[i]!, y }));
  const coeffs = lagrangeInterpolate(points);

  // Evaluate at the parity positions (12, 13, 14, 15) and compute differences
  const syndromes: number[] = [];
  for (let i = K; i < N; i++) {
    const expected = polyEval(coeffs, EVAL_POINTS[i]!);
    const received = w[i]!;
    syndromes.push(mod(received - expected));
  }

  return syndromes;
}

/**
 * Check whether a word is a valid RS codeword (all-zero syndrome).
 */
export function isValidCodeword(word: readonly number[]): boolean {
  return syndrome(word).every((s) => s === 0);
}

/**
 * Verify a block record's integrity. Returns a diagnostic.
 */
export interface BlockIntegrity {
  readonly valid: boolean;
  /** The 4-element syndrome vector (all zeros = valid). */
  readonly syndrome: readonly number[];
  /** Human-readable summary. */
  readonly summary: string;
}

export function verifyBlockIntegrity(coded: readonly number[]): BlockIntegrity {
  if (coded.length !== N) {
    return {
      valid: false,
      syndrome: [],
      summary: `wrong length: expected ${N}, got ${coded.length}`,
    };
  }

  // Validate all values are in GF(17) range
  if (!coded.every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 16)) {
    return {
      valid: false,
      syndrome: [],
      summary: "contains values outside GF(17) range [0,16]",
    };
  }

  const s = syndrome(coded);
  const valid = s.every((v) => v === 0);

  return {
    valid,
    syndrome: s,
    summary: valid
      ? "valid codeword (syndrome = [0,0,0,0])"
      : `CORRUPTED — syndrome = [${s.join(",")}] (at least one symbol is wrong)`,
  };
}
