/**
 * rs-phase-codec.ts — Reed-Solomon phase codec (encode-then-transmit).
 *
 * THE ENGINEERING ANSWER to the retracted xorshift theorem:
 *
 *   If missed phases must be recoverable, IMPOSE the structure rather than
 *   hope to discover it — encode 12 phase values as a degree-< 12 polynomial
 *   and transmit its 16 evaluations. Then `phaseWord ∈ rsCode` holds by
 *   construction and `phase_clock_recoverable_under_erasure` applies with
 *   no new Lean work.
 *
 * ## What this provides
 *
 * Given 12 "information phases" (the actual data a node wants to communicate),
 * produce 16 "coded phases" by evaluating the unique interpolating polynomial
 * at 16 points over GF(17). Any 12 of the 16 coded phases uniquely determine
 * the polynomial (by the RS [16,12] minimum distance = 5, erasure correction
 * capability = 4). So up to 4 missed coded phases can be recovered from the
 * remaining 12.
 *
 * ## Arithmetic: GF(17) = ZMod 17
 *
 * We work in the prime field F_17 = {0,1,...,16}. Addition, subtraction, and
 * multiplication are mod 17. Division is multiplication by the modular inverse.
 * The evaluation points are 0,1,...,15 (the 16 elements of F_17 minus 16, but
 * we use 0..15 since we have exactly 16 points and 17 > 16).
 *
 * ## Connection to the Lean4 proof
 *
 * `ErasureDistance.lean` proves that rsCode (the image of degree-< 12 polynomials
 * evaluated at 16 points) corrects any 4 erasures. This codec PRODUCES words in
 * rsCode by construction — encode() outputs evalWord(p) for some p ∈ degreeLT F 12.
 * The hypothesis of `phase_clock_recoverable_under_erasure` is therefore satisfied
 * without any claim about xorshift or linear recurrences.
 *
 * ## Usage in the phase clock
 *
 * Every 12 ticks, the phase clock bundles its last 12 derived values (mod 17),
 * encodes them into a 16-symbol RS codeword, and the 4 parity symbols are
 * transmitted alongside (or can be reconstructed by any peer holding 12/16).
 * This is the "4th recovery path" — purely structural, no peers needed.
 */

// ═══ Field Arithmetic: GF(17) ═════════════════════════════════════════════════

const P = 17; // The prime field order

/** Modular reduction to [0, P-1]. Handles negative inputs correctly. */
export function mod(a: number): number {
  return ((a % P) + P) % P;
}

/** Modular addition. */
export function add(a: number, b: number): number {
  return mod(a + b);
}

/** Modular subtraction. */
export function sub(a: number, b: number): number {
  return mod(a - b);
}

/** Modular multiplication. */
export function mul(a: number, b: number): number {
  return mod(a * b);
}

/**
 * Modular inverse via Fermat's little theorem: a^(p-2) mod p.
 * Only valid for a ≠ 0 mod p.
 */
export function inv(a: number): number {
  if (mod(a) === 0) throw new Error("Cannot invert zero in GF(17)");
  // a^15 mod 17 (since p-2 = 15)
  let result = 1;
  let base = mod(a);
  let exp = P - 2; // 15
  while (exp > 0) {
    if (exp & 1) result = mul(result, base);
    base = mul(base, base);
    exp >>= 1;
  }
  return result;
}

/** Modular division: a / b = a * b^(-1). */
export function div(a: number, b: number): number {
  return mul(a, inv(b));
}

// ═══ Polynomial Operations over GF(17) ═══════════════════════════════════════

/**
 * Evaluate a polynomial (given as coefficients, lowest degree first) at point x.
 * p(x) = coeffs[0] + coeffs[1]*x + coeffs[2]*x^2 + ...
 */
export function polyEval(coeffs: readonly number[], x: number): number {
  let result = 0;
  let power = 1; // x^0 = 1
  for (const c of coeffs) {
    result = add(result, mul(mod(c), power));
    power = mul(power, x);
  }
  return result;
}

/**
 * Lagrange interpolation: given k points (x_i, y_i), find the unique polynomial
 * of degree < k passing through all of them, and return its coefficients.
 *
 * Returns coefficients in ascending order: [a_0, a_1, ..., a_{k-1}].
 */
export function lagrangeInterpolate(
  points: readonly { x: number; y: number }[],
): number[] {
  const n = points.length;
  // Build the polynomial coefficient-by-coefficient using Lagrange basis
  const coeffs = new Array(n).fill(0) as number[];

  for (let i = 0; i < n; i++) {
    // Compute the i-th Lagrange basis polynomial L_i(x) = Π_{j≠i} (x - x_j)/(x_i - x_j)
    // We need its coefficients, then scale by y_i and accumulate.

    // Start with the constant polynomial [1]
    let basis: number[] = [1];
    let denominator = 1;

    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      // Multiply basis by (x - x_j): convolve [−x_j, 1] with current basis
      const newBasis = new Array(basis.length + 1).fill(0) as number[];
      for (let k = 0; k < basis.length; k++) {
        newBasis[k] = add(newBasis[k]!, mul(basis[k]!, mod(-points[j]!.x)));
        newBasis[k + 1] = add(newBasis[k + 1]!, basis[k]!);
      }
      basis = newBasis;
      // Accumulate denominator: (x_i - x_j)
      denominator = mul(denominator, sub(points[i]!.x, points[j]!.x));
    }

    // Scale basis by y_i / denominator
    const scale = div(points[i]!.y, denominator);
    for (let k = 0; k < basis.length; k++) {
      coeffs[k] = add(coeffs[k]!, mul(basis[k]!, scale));
    }
  }

  return coeffs;
}

// ═══ RS Codec: Encode & Decode ════════════════════════════════════════════════

/** The 16 evaluation points (0..15 in GF(17)). */
export const EVAL_POINTS = Array.from({ length: 16 }, (_, i) => i);

/** The number of information symbols (polynomial degree < 12 means 12 coefficients). */
export const K = 12;

/** The codeword length (16 evaluation points). */
export const N = 16;

/** The number of parity symbols (N - K = 4). */
export const PARITY = N - K;

/**
 * Encode 12 information symbols into a 16-symbol RS codeword.
 *
 * Input: 12 values in GF(17) (each in [0,16]).
 * Output: 16 values — the polynomial evaluated at points 0..15.
 *
 * The input symbols ARE the polynomial coefficients (systematic in coefficient form).
 * This means: the polynomial p(x) = info[0] + info[1]*x + ... + info[11]*x^11,
 * and the codeword is [p(0), p(1), ..., p(15)].
 *
 * This is the simplest encoding: the information is the polynomial itself.
 * Recovery = Lagrange interpolation from any 12 of the 16 evaluations.
 */
export function encode(info: readonly number[]): number[] {
  if (info.length !== K) {
    throw new Error(`encode requires exactly ${K} information symbols, got ${info.length}`);
  }
  // Reduce all inputs mod 17
  const coeffs = info.map(mod);
  // Evaluate at all 16 points
  return EVAL_POINTS.map((x) => polyEval(coeffs, x));
}

/**
 * Decode: given at least 12 of 16 coded symbols (with erasure positions marked),
 * recover the full 16-symbol codeword.
 *
 * Input: an array of 16 entries, each either { value: number } (received) or null (erased).
 * Output: the full 16-symbol codeword, or null if fewer than 12 symbols received.
 *
 * Algorithm: collect the received symbols as (point, value) pairs, interpolate the
 * unique degree-< 12 polynomial through any 12 of them, then re-evaluate at all 16 points.
 */
export function decode(
  received: readonly ({ value: number } | null)[],
): number[] | null {
  if (received.length !== N) {
    throw new Error(`decode requires exactly ${N} entries, got ${received.length}`);
  }

  // Collect received (non-erased) symbols
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const r = received[i];
    if (r !== null) {
      points.push({ x: EVAL_POINTS[i]!, y: mod(r.value) });
    }
  }

  // Need at least K = 12 points to reconstruct
  if (points.length < K) return null;

  // Use exactly K points (the first 12 received — order doesn't matter for interpolation)
  const subset = points.slice(0, K);

  // Interpolate the polynomial
  const coeffs = lagrangeInterpolate(subset);

  // Re-evaluate at all 16 points to get the full codeword
  return EVAL_POINTS.map((x) => polyEval(coeffs, x));
}

/**
 * Extract the original 12 information symbols from a (possibly recovered) codeword.
 *
 * Since we use coefficient-form encoding (info = polynomial coefficients),
 * recovering the coefficients from the evaluations requires interpolation.
 * But we already have the codeword (16 evaluations) — so we interpolate from
 * any 12 of those to get the coefficients back.
 */
export function extractInfo(codeword: readonly number[]): number[] {
  if (codeword.length !== N) {
    throw new Error(`extractInfo requires a ${N}-symbol codeword`);
  }
  // Interpolate from the first 12 points (or all 16 — overdetermined but consistent)
  const points = codeword.slice(0, K).map((y, i) => ({ x: EVAL_POINTS[i]!, y: mod(y) }));
  const coeffs = lagrangeInterpolate(points);
  // The coefficients ARE the information symbols
  return coeffs.slice(0, K);
}

// ═══ Phase Clock Integration ═════════════════════════════════════════════════

/**
 * Bundle 12 phase-derived values into an RS-encoded block.
 *
 * Takes 12 consecutive `phase.derived` values (each reduced mod 17),
 * returns the 16-symbol codeword. The first 12 evaluations encode the data;
 * the last 4 are parity (redundancy for erasure correction).
 *
 * Connection to the Lean proof: the output IS a member of rsCode by construction
 * (it's evalWord(p) for the polynomial with these coefficients). No sorry needed.
 */
export function encodePhaseBlock(derivedValues: readonly number[]): number[] {
  if (derivedValues.length !== K) {
    throw new Error(`encodePhaseBlock requires exactly ${K} derived values`);
  }
  return encode(derivedValues.map((v) => mod(v)));
}

/**
 * Recover missed phases from a partial observation.
 *
 * Given a 16-slot observation where some entries are null (missed/erased),
 * reconstruct the full block if at least 12 are present.
 *
 * Returns: { ok: true, block: number[], recovered: number[] } on success,
 *          { ok: false, reason: string } on failure.
 */
export function recoverPhaseBlock(
  observation: readonly ({ value: number } | null)[],
): { ok: true; block: number[]; recovered: number[] } | { ok: false; reason: string } {
  const receivedCount = observation.filter((x) => x !== null).length;
  if (receivedCount < K) {
    return { ok: false, reason: `only ${receivedCount} of ${K} required symbols received` };
  }

  const decoded = decode(observation);
  if (!decoded) {
    return { ok: false, reason: "decode failed (interpolation error)" };
  }

  // Identify which positions were recovered
  const recovered: number[] = [];
  for (let i = 0; i < N; i++) {
    if (observation[i] === null) recovered.push(i);
  }

  return { ok: true, block: decoded, recovered };
}
