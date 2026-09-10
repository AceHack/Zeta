/**
 * representation-layer-rank3-exactness.ts — DOES EXACTNESS SURVIVE AT RANK 3?
 *
 * The 8D pipeline's best property is that its arithmetic is EXACT: E8's roots are integer
 * vectors in doubled coordinates, so inner products, face bivectors and Lambert numerators
 * all close over `Z`, and irrationality is confined to one named `sqrt(6)` at readout.
 *
 * That property is the strongest argument for keeping the extra dimensions, and it is worth
 * asking precisely what buys it. **The claim this module tests: exactness comes from the
 * roots being algebraic integers in a ring closed under multiplication — not from the
 * dimension being 8.** If a RANK-3 root system has the same property, then exactness is
 * available natively in 3D, with no projection anywhere, and the 8D was never what paid for
 * it.
 *
 * The rank-3 candidate is not arbitrary. **H3 — the icosahedral Coxeter group, 30 roots in
 * `R^3`** — is the rank-3 generator of the very chain that produces E8: H3's spinors in
 * `Cl+(3,0) = H` form H4 (the 600-cell, 120 roots), and E8's 240 roots are the icosian ring
 * `2I` union `phi * 2I` over `Q(sqrt 5)`. So H3 is not a competitor to E8; **it is what E8
 * is built from**, and it lives in three dimensions where a renderer can use it directly.
 *
 * Anchors, as recorded and corrected in `docs/research/2026-08-01-icosahedron-to-e8-*.md`
 * — where the load-bearing correction is that the 3->4 step (Dechant's spinor induction) and
 * the 4->8 step (the icosian golden doubling) are DIFFERENT theorems, and running them
 * together as one induction would itself be numerology:
 *
 * - **Pierre-Philippe Dechant**, *Rank-3 root systems induce root systems of rank 4 via a
 *   new Clifford spinor construction*, J. Phys. Conf. Ser. 597 (2015) 012027.
 * - **Dechant**, *The birth of E8 out of the (Clifford) algebra of the icosahedron*,
 *   Proc. R. Soc. A 472 (2016) 20150504.
 * - **Conway & Sloane**, SPLAG Section 8.2 (the icosian ring and E8);
 *   **Elser & Sloane**, J. Phys. A 20 (1987).
 *
 * Those are CITED from the in-tree verdict that metered them, not reproven here. What IS
 * run here is only the arithmetic: that H3's roots close under reflection without ever
 * leaving `Z[phi]`.
 *
 * ## Register
 *
 * - `metered` — everything this module returns. Exact `bigint` arithmetic in `Z[phi]`, no
 *   floating point anywhere, pure functions, byte-identical on replay.
 * - **NOT established here:** that H3-derived geometry reproduces rung 6's exact SHADING.
 *   This module measures the ring, not the light. That remains `toy` and the falsifier is
 *   named in the companion research document.
 */

/**
 * An element of `Z[phi]`, the ring of integers of `Q(sqrt 5)`: `[a, b]` denotes `a + b*phi`
 * with `phi^2 = phi + 1`.
 *
 * This is the rank-3 analogue of the doubled-integer trick E8 uses. Both keep every
 * coordinate an algebraic integer, so every inner product is exact; the only difference is
 * which ring, and `Z[phi]` is closed under multiplication exactly as `Z` is.
 */
export type Zphi = readonly [bigint, bigint];

/** The rational integer `n`, as an element of `Z[phi]`. */
export function zint(n: bigint): Zphi {
  return [n, 0n];
}

/** `phi` itself. */
export const PHI: Zphi = [0n, 1n];

/** `1/phi = phi - 1`. Exact, and the reason the icosahedral coordinates stay in the ring. */
export const INV_PHI: Zphi = [-1n, 1n];

/** Addition in `Z[phi]`. */
export function zAdd(x: Zphi, y: Zphi): Zphi {
  return [x[0] + y[0], x[1] + y[1]];
}

/** Subtraction in `Z[phi]`. */
export function zSub(x: Zphi, y: Zphi): Zphi {
  return [x[0] - y[0], x[1] - y[1]];
}

/** Negation in `Z[phi]`. */
export function zNeg(x: Zphi): Zphi {
  return [-x[0], -x[1]];
}

/**
 * Multiplication in `Z[phi]`, reducing `phi^2` to `phi + 1`.
 *
 * `(a + b*phi)(c + d*phi) = ac + (ad + bc)phi + bd*phi^2 = (ac + bd) + (ad + bc + bd)phi`.
 */
export function zMul(x: Zphi, y: Zphi): Zphi {
  return [x[0] * y[0] + x[1] * y[1], x[0] * y[1] + x[1] * y[0] + x[1] * y[1]];
}

/** Exact halving; `null` when the element is not divisible by two in the ring. */
export function zHalf(x: Zphi): Zphi | null {
  if (x[0] % 2n !== 0n || x[1] % 2n !== 0n) return null;
  return [x[0] / 2n, x[1] / 2n];
}

/** A vector over `Z[phi]`. */
export type VecZphi = readonly Zphi[];

/** Exact inner product. */
export function zDot(a: VecZphi, b: VecZphi): Zphi {
  let s: Zphi = zint(0n);
  for (let i = 0; i < a.length; i++) s = zAdd(s, zMul(a[i] as Zphi, b[i] as Zphi));
  return s;
}

/** Canonical key for set membership; exact, so no epsilon anywhere. */
export function zKey(v: VecZphi): string {
  return v.map((c) => `${c[0]},${c[1]}`).join("|");
}

/** The squared norm of every H3 root in these coordinates: the rational integer 4. */
export const H3_ROOT_NORM_SQUARED: Zphi = [4n, 0n];

/** The number of roots in the H3 root system. */
export const H3_ROOT_COUNT = 30;

/**
 * The 30 roots of H3, as the vertices of the icosidodecahedron in `Z[phi]` coordinates.
 *
 * Two families, exactly as E8's 240 split into two families of 112 and 128:
 *
 *   - `(+-2, 0, 0)` and its coordinate permutations                    -> 6
 *   - `(+-1, +-1/phi, +-phi)` under EVEN (cyclic) permutations         -> 24
 *
 * Every coordinate is in `Z[phi]`, and every squared norm is the rational integer 4 —
 * `1 + phi^2 + (phi-1)^2 = 1 + (phi+1) + (phi^2 - 2phi + 1) = 4`, using `phi^2 = phi + 1`.
 * The `phi` components cancel exactly, which is the property that makes the arithmetic close.
 */
export function h3Roots(): VecZphi[] {
  const out: VecZphi[] = [];

  for (let axis = 0; axis < 3; axis++)
    for (const s of [2n, -2n]) {
      const v: Zphi[] = [zint(0n), zint(0n), zint(0n)];
      v[axis] = zint(s);
      out.push(v);
    }

  for (const sx of [1, -1])
    for (const sy of [1, -1])
      for (const sz of [1, -1]) {
        const a = sx === 1 ? zint(1n) : zNeg(zint(1n));
        const b = sy === 1 ? INV_PHI : zNeg(INV_PHI);
        const c = sz === 1 ? PHI : zNeg(PHI);
        out.push([a, b, c]);
        out.push([c, a, b]);
        out.push([b, c, a]);
      }

  return out;
}

/**
 * Reflect `x` in the hyperplane orthogonal to root `a`: `x - 2(x.a)/(a.a) a`.
 *
 * With `a.a = 4` this is `x - ((x.a)/2) a`, so the whole operation stays in `Z[phi]`
 * **provided `(x.a)` is divisible by two in the ring** — which is the exact analogue of the
 * integrality condition that makes E8's reflections close over `Z`. Returns `null` when it
 * is not, so a failure surfaces rather than being rounded away.
 *
 * This is the Clifford versor sandwich in its vector form: `x -> -a x a / |a|^2`.
 */
export function h3Reflect(x: VecZphi, a: VecZphi): VecZphi | null {
  const h = zHalf(zDot(x, a));
  if (h === null) return null;
  return x.map((c, i) => zSub(c, zMul(h, a[i] as Zphi)));
}

/** What the closure probe found. */
export interface Rank3ExactnessResult {
  /** Distinct roots declared before closure. */
  readonly declared: number;
  /** Distinct roots after closing under all reflections. */
  readonly closure: number;
  /** Rounds needed to reach the fixed point. */
  readonly rounds: number;
  /** True when no reflection ever left `Z[phi]`. */
  readonly stayedExact: boolean;
  /** Distinct squared norms in the closure, as `Z[phi]` keys. One class is simply-laced. */
  readonly distinctSquaredNorms: readonly string[];
  /** Dimension of the span. Three is the point: no projection is involved anywhere. */
  readonly rank: number;
}

/**
 * Close the H3 roots under their own reflections and report whether exactness survived.
 *
 * The falsifier this is built to fail: if any reflection produced a non-integral coefficient,
 * or if the closure exceeded 30, the rank-3 exactness claim would be refuted and the 8D's
 * exactness would be a property of dimension after all.
 */
export function measureRank3Exactness(): Rank3ExactnessResult {
  const seed = h3Roots();
  const declared = new Map<string, VecZphi>();
  for (const r of seed) declared.set(zKey(r), r);

  const set = new Map<string, VecZphi>(declared);
  let frontier = [...declared.values()];
  let rounds = 0;
  let stayedExact = true;

  while (frontier.length > 0 && rounds < 32) {
    const next: VecZphi[] = [];
    for (const x of frontier)
      for (const a of declared.values()) {
        const r = h3Reflect(x, a);
        if (r === null) {
          stayedExact = false;
          continue;
        }
        const k = zKey(r);
        if (!set.has(k)) {
          set.set(k, r);
          next.push(r);
        }
      }
    frontier = next;
    rounds++;
  }

  const norms = new Set<string>();
  for (const r of set.values()) norms.add(zKey([zDot(r, r)]));

  // Rank: how many coordinates carry a nonzero value somewhere in the closure. Three here,
  // and stated because "rank 3" is the entire reason this module exists.
  let rank = 0;
  for (let i = 0; i < 3; i++)
    for (const r of set.values()) {
      const c = r[i] as Zphi;
      if (c[0] !== 0n || c[1] !== 0n) {
        rank++;
        break;
      }
    }

  return {
    declared: declared.size,
    closure: set.size,
    rounds,
    stayedExact,
    distinctSquaredNorms: [...norms].sort(),
    rank,
  };
}
