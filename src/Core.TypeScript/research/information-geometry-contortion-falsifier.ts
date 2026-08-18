/**
 * Falsifier 1 for the contortion-as-order-deviation-metric proposal (Lumen 2026-08-18).
 *
 * The proposal (docs/research/2026-08-18-torsion-not-curvature-is-the-reordering-defect-*.md)
 * rests on: a canonical torsion-free reference connection exists and is unique, so any actual
 * execution differs from it by a CONTORTION, and that contortion measures order-deviation.
 *
 * This module computes the relevant tensors on the one place in the tree where the geometry is
 * genuinely defined -- the belief simplex that src/Core/BeliefConvergence.fs folds over -- and
 * checks the claim. Everything here is standard information geometry (Amari-Nagaoka), computed
 * in closed form and cross-checked against finite differences of the metric, so the numbers are
 * CHECKED, not asserted.
 *
 * ## The geometry, stated once
 *
 * BeliefConvergence.observe is pointwise multiplication of unnormalized weights = addition of
 * log-weights. So the belief manifold is the categorical exponential family in its natural
 * parameters theta (log-weights, reduced chart theta_n = 0), and the fold is TRANSLATION in theta.
 *
 * - potential psi(t) = log(1 + sum_j exp(t_j)), with p_i = d_i psi
 * - Fisher-Rao metric g_ij = d_i d_j psi = diag(p) - p p^T   (Rao 1945; Cencov 1982 uniqueness)
 * - Amari-Chentsov skewness tensor psi_ijk = d_i d_j d_k psi, FULLY SYMMETRIC
 * - alpha-connection, first kind, in theta-coordinates: G(a)_{ij,k} = ((1 - a)/2) * psi_ijk
 *   (a = 0 is the Levi-Civita connection of g; a = 1 is the e-connection, flat, whose affine
 *   coordinates are theta -- i.e. our fold's own connection, because our fold translates theta.)
 *
 * ## What that gives -- the whole result in one line
 *
 * The entire alpha-family is a scalar multiple of ONE fully-symmetric tensor. Symmetric in (i,j)
 * implies torsion == 0 for every member, hence CONTORTION == 0 IDENTICALLY -- while the
 * connections genuinely differ. So contortion is blind to the only deviation that exists here:
 * the difference between the canonical reference (a = 0) and the connection our fold actually
 * uses (a = 1) is PURE NON-METRICITY (disformation), which contortion does not measure.
 *
 * Register: the MATHEMATICS is standard and checked. The MAPPING to our substrate stays a toy
 * under .claude/rules/toy-is-free-metered-must-be-earned.md; this module is the falsifier, not a
 * metric implementation. Nothing here should be cited as "the order-deviation metric".
 *
 * Anchors: Amari and Nagaoka, Methods of Information Geometry (2000) -- alpha-connections, dual
 * flatness; Cencov (Chentsov) 1982 -- Fisher-Rao uniqueness under sufficient statistics; Cartan
 * 1922 -- torsion; Levi-Civita 1917 -- the fundamental theorem (uniqueness needs torsion-free AND
 * metric-compatible, and the proposal supplies only the first).
 */

/** Dense rank-3 tensor over a d-dimensional chart, stored flat in row-major order. */
export interface Tensor3 {
  readonly d: number;
  readonly v: readonly number[];
}

/** Dense rank-2 tensor over a d-dimensional chart, stored flat in row-major order. */
export interface Tensor2 {
  readonly d: number;
  readonly v: readonly number[];
}

/** Total element read on a plain number array (out of range reads as zero). */
function el(a: readonly number[], i: number): number {
  return a[i] ?? 0;
}

/** Component of a rank-3 tensor. */
export function at3(t: Tensor3, i: number, j: number, k: number): number {
  return el(t.v, (i * t.d + j) * t.d + k);
}

/** Component of a rank-2 tensor. */
export function at2(t: Tensor2, i: number, j: number): number {
  return el(t.v, i * t.d + j);
}

/** Softmax over the reduced chart: theta has n-1 free coordinates, the last outcome is the pivot. */
export function probabilities(theta: readonly number[]): number[] {
  let z = 1; // the pivot outcome contributes exp(0) = 1
  const e = theta.map((t) => Math.exp(t));
  for (const v of e) z += v;
  return e.map((v) => v / z);
}

/** psi(theta) = log(1 + sum_j exp(theta_j)) -- log-partition function of the categorical family. */
export function psi(theta: readonly number[]): number {
  let z = 1;
  for (const t of theta) z += Math.exp(t);
  return Math.log(z);
}

/** Fisher-Rao metric g_ij = d_i d_j psi = diag(p) - p p^T on the reduced chart. Positive definite. */
export function fisherMetric(p: readonly number[]): Tensor2 {
  const d = p.length;
  const v: number[] = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) v.push((i === j ? el(p, i) : 0) - el(p, i) * el(p, j));
  }
  return { d, v };
}

/**
 * Amari-Chentsov tensor psi_ijk = d_i d_j d_k psi in closed form:
 *   dij dik p_i - (dij p_i p_k + dik p_i p_j + djk p_j p_i) + 2 p_i p_j p_k
 * Fully symmetric by construction -- which is the load-bearing fact of this whole module.
 */
function skewnessComponent(p: readonly number[], i: number, j: number, k: number): number {
  const pi = el(p, i);
  const pj = el(p, j);
  const pk = el(p, k);
  const dij = i === j ? 1 : 0;
  const dik = i === k ? 1 : 0;
  const djk = j === k ? 1 : 0;
  return dij * dik * pi - (dij * pi * pk + dik * pi * pj + djk * pj * pi) + 2 * pi * pj * pk;
}

export function amariChentsov(p: readonly number[]): Tensor3 {
  const d = p.length;
  const v: number[] = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      for (let k = 0; k < d; k++) v.push(skewnessComponent(p, i, j, k));
    }
  }
  return { d, v };
}

/**
 * Christoffel symbols of the FIRST KIND for the alpha-connection, in theta-coordinates:
 *   G(a)_{ij,k} = ((1 - a)/2) * psi_ijk
 *
 * a = 0 gives Levi-Civita of the Fisher metric (a Hessian metric, so G_{ij,k} = (1/2) d_k g_ij).
 * a = 1 gives the e-connection: identically zero, i.e. theta ARE its affine coordinates -- the
 * precise sense in which our multiplicative fold is parallel transport for this connection.
 */
export function alphaConnection(p: readonly number[], alpha: number): Tensor3 {
  const t = amariChentsov(p);
  const c = (1 - alpha) / 2;
  return { d: t.d, v: t.v.map((x) => c * x) };
}

/**
 * Torsion of a connection given by Christoffels of the first kind, in a coordinate basis
 * (where the coordinate fields commute): T_{ij,k} = G_{ij,k} - G_{ji,k}.
 *
 * Contortion is algebraically determined by torsion, so maxAbs(torsion) = 0 implies contortion 0.
 */
export function torsion(gamma: Tensor3): Tensor3 {
  const d = gamma.d;
  const v: number[] = [];
  for (let row = 0; row < d; row++) {
    for (let col = 0; col < d; col++) {
      for (let k = 0; k < d; k++) {
        v.push(at3(gamma, row, col, k) - at3(gamma, col, row, k));
      }
    }
  }
  return { d, v };
}

/**
 * Elementwise difference of two connections -- the DIFFERENCE TENSOR.
 *
 * Connections form an affine space (a torsor) over the space of difference tensors, so this is
 * REFERENCE-FREE: it does not depend on any choice of canonical base point, while a
 * deviation-from-reference does. This is what survives when falsifier 1 fails.
 */
export function differenceTensor(a: Tensor3, b: Tensor3): Tensor3 {
  return { d: a.d, v: a.v.map((x, i) => x - el(b.v, i)) };
}

/**
 * Non-metricity of the alpha-connection:
 *   Q_{k,ij} = nabla_k g_ij = d_k g_ij - G^l_{ki} g_lj - G^l_{kj} g_il
 * From first-kind symbols directly: d_k g_ij = psi_ijk and G^l_{ki} g_lj = G_{ki,j}, so
 *   Q_{k,ij} = psi_ijk - G_{ki,j} - G_{kj,i}
 * Zero exactly at a = 0 -- the metric-compatible member. Nonzero at a = 1, which is where the
 * deviation of our actual fold from the canonical reference lives.
 */
export function nonMetricity(p: readonly number[], alpha: number): Tensor3 {
  const t = amariChentsov(p);
  const g = alphaConnection(p, alpha);
  const d = t.d;
  const v: number[] = [];
  for (let a = 0; a < d; a++) {
    for (let b = 0; b < d; b++) {
      for (let c = 0; c < d; c++) {
        v.push(at3(t, b, c, a) - at3(g, a, b, c) - at3(g, a, c, b));
      }
    }
  }
  return { d, v };
}

/** Sup-norm of a rank-3 tensor. */
export function maxAbs(t: Tensor3): number {
  let m = 0;
  for (const x of t.v) m = Math.max(m, Math.abs(x));
  return m;
}

/** Central-difference d_k g_ij, used to CHECK the closed-form Amari-Chentsov tensor. */
export function metricDerivativeNumeric(theta: readonly number[], h = 1e-5): Tensor3 {
  const d = theta.length;
  const v: number[] = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      for (let k = 0; k < d; k++) {
        const up = theta.map((t, n) => (n === k ? t + h : t));
        const dn = theta.map((t, n) => (n === k ? t - h : t));
        const gu = at2(fisherMetric(probabilities(up)), i, j);
        const gd = at2(fisherMetric(probabilities(dn)), i, j);
        v.push((gu - gd) / (2 * h));
      }
    }
  }
  return { d, v };
}

// -- The substrate side: what our fold actually does in these coordinates ------------------------

/** observe in natural coordinates: multiplying weights = TRANSLATING theta by the log-likelihood. */
export function observeTheta(theta: readonly number[], logLik: readonly number[]): number[] {
  return theta.map((t, i) => t + el(logLik, i));
}

/** sharpen (weights squared) in natural coordinates: the dilation theta -> 2 theta. */
export function sharpenTheta(theta: readonly number[]): number[] {
  return theta.map((t) => 2 * t);
}

/**
 * The non-commutation residue of sharpen against observe:
 *   sharpen(observe_L(t)) - observe_L(sharpen(t)) = L
 * -- EXACTLY ONE EXTRA COPY of the evidence. That is a MULTIPLICITY defect, which is what
 * BeliefConvergence's own docstring already names as the real hazard. Multiplicity is a counting
 * quantity, not a geometric one, and no torsion or contortion measures it.
 */
export function sharpenObserveResidue(
  theta: readonly number[],
  logLik: readonly number[],
): number[] {
  const a = sharpenTheta(observeTheta(theta, logLik));
  const b = observeTheta(sharpenTheta(theta), logLik);
  return a.map((x, i) => x - el(b, i));
}

/**
 * observe in the EXACT algebra: pointwise product of unnormalized integer weights. This is what
 * src/Core/BeliefConvergence.fs actually runs (int64 arrays), and it commutes EXACTLY -- integer
 * multiplication is commutative and associative with no rounding.
 */
export function observeExact(belief: readonly bigint[], likelihood: readonly bigint[]): bigint[] {
  return belief.map((b, i) => {
    const l = likelihood[i];
    return l === undefined ? b : b * l;
  });
}

/**
 * The float log-domain fold commutes only to within rounding: floating-point addition is
 * commutative but NOT associative, so a reordered fold can differ in the last ULP. That residual is
 * the entire reason the phase-canonical (HLC sort-key) order exists -- it is a float-determinism
 * convention, not a geometric reference. Returns the sup-norm of the gap.
 */
export function foldReorderUlpGap(
  theta: readonly number[],
  a: readonly number[],
  b: readonly number[],
): number {
  const ab = observeTheta(observeTheta(theta, a), b);
  const ba = observeTheta(observeTheta(theta, b), a);
  let m = 0;
  for (const [i, x] of ab.entries()) m = Math.max(m, Math.abs(x - el(ba, i)));
  return m;
}

// -- The pure-geometry counterexample: order-dependence with identically zero torsion ------------

/**
 * Flat R^2 with the standard (zero) connection, so TORSION IS ZERO EVERYWHERE. The vector fields
 * X = d_x and Y = x d_y have bracket [X, Y] = d_y which is nonzero, so their flows do NOT commute:
 * the A-then-B and B-then-A endpoints differ by exactly s*t in y.
 *
 * This is the counterexample to the proposal's central mapping. Order-dependence of the operations
 * is the LIE BRACKET, not the torsion. Torsion is what remains AFTER the bracket is subtracted
 * (T(X,Y) = nabla_X Y - nabla_Y X - [X,Y]), so a torsion-free connection is entirely compatible
 * with wildly non-commuting operations.
 */
export function flowMismatchOnFlatR2(
  x0: number,
  y0: number,
  s: number,
  t: number,
): { xThenY: [number, number]; yThenX: [number, number]; mismatch: [number, number] } {
  const xThenY: [number, number] = [x0 + s, y0 + t * (x0 + s)];
  const yThenX: [number, number] = [x0 + s, y0 + t * x0];
  return { xThenY, yThenX, mismatch: [xThenY[0] - yThenX[0], xThenY[1] - yThenX[1]] };
}
