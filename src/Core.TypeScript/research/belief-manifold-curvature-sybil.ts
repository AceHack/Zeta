/**
 * The curvature of the belief manifold CliffordAntiSybil actually embeds, and what it costs the
 * rotor Sybil test (Lumen, 2026-08-20).
 *
 * ## The question, and the correction to it
 *
 * The prompt was: our belief manifold's canonical metric is Fisher-Rao (Rao 1945; Cencov 1982
 * uniqueness under sufficient statistics), and on a CATEGORICAL simplex the substitution
 * p -> 2*sqrt(p) carries Fisher-Rao to the round sphere of radius 2 -- constant curvature +1/4.
 * So should `src/Bayesian/CliffordAntiSybil.fs` move from flat Cl(3,0) to a SPHERICAL embedding?
 *
 * It should not, and the reason is that CliffordAntiSybil does not embed a categorical belief.
 * It embeds `Zeta.Bayesian.Gaussian` -- `Cl3.vector belief.PrecisionMean belief.Precision 0.0`.
 * The Fisher-Rao geometry of the univariate Gaussian family is HYPERBOLIC, not spherical:
 * constant Gaussian curvature K = -1/2 (computed here two independent ways). Same theorem
 * (Fisher-Rao is canonical), OPPOSITE SIGN of curvature, because it is a different family.
 *
 * That distinction is the whole result, so it is stated before any number: the earlier falsifier
 * (docs/research/2026-08-18-falsifier-1-fails-*.md) worked on `BeliefConvergence`, which IS the
 * categorical family and IS the sphere. `CliffordAntiSybil` is the location-scale family and is
 * the hyperboloid. Carrying the sphere over would have been the right theorem on the wrong module.
 *
 * ## What is computed here (nothing below is asserted)
 *
 *  1. The Fisher metric of the Gaussian family in (mu, sigma): diag(1/s^2, 2/s^2), checked
 *     against finite differences of the exact KL divergence.
 *  2. K = -1/2, from the Brioschi/orthogonal-metric curvature formula on that metric,
 *     numerically, at many points -- and independently from the closed-form Rao distance.
 *  3. The Rao distance closed form (Atkinson & Mitchell 1981), cross-checked against direct
 *     numerical integration of arc length along the mu = const geodesic, where it must equal
 *     sqrt(2) * |log(s2/s1)|.
 *  4. A faithful TypeScript port of `CliffordAntiSybil.computeGeometricCorrelation`, and the
 *     closed form it reduces to: corr = rho^2 * exp(-(1 - rho^2)/2), where rho is the circular
 *     MEAN RESULTANT LENGTH (Mardia & Jupp, Directional Statistics) of the cross-stream angles.
 *     This is what makes the whole detector analysable rather than a black box.
 *  5. The TWO-TERM ERROR BUDGET that answers "is flat a legitimate local approximation":
 *       - a CHART term, zeroth order, which does NOT vanish as steps shrink; and
 *       - a CURVATURE (holonomy) term, second order, which does.
 *     Both are measured.
 *  6. Clone-vs-independent separation for the flat score against a Fisher-Rao-native score, on
 *     synthetic Bayesian update streams, so the practical cost is a number and not a vibe.
 *
 * ## The geometry, stated once
 *
 * `Gaussian` is stored in NATURAL parameters nu = mu*tau, tau = 1/sigma^2 (see
 * src/Bayesian/Message.fs). The natural parameters of N(mu, sigma^2) are theta = (nu, -tau/2), so
 * the plane CliffordAntiSybil draws its vectors in is an affine image of theta-space. That affine
 * structure is CANONICAL -- it is Amari's e-connection, flat, with theta as its affine
 * coordinates, and Bayesian updating (`Gaussian.( * )` adds natural parameters) is literally
 * translation in it. What is NOT canonical is the EUCLIDEAN METRIC laid on top of that chart, and
 * the rotor test consumes exactly the metric: norms, angles, rotors. So the honest split is
 * "affine structure earned, metric unearned", and everything below measures the second half.
 *
 * In (mu, sigma) coordinates the Fisher-Rao line element is ds^2 = (dmu^2 + 2 dsigma^2)/sigma^2.
 * Setting y = sqrt(2)*sigma gives ds^2 = 2 (dmu^2 + dy^2)/y^2 -- twice the Poincare half-plane
 * metric, hence K = -1/2, and Rao distance = sqrt(2) * (hyperbolic distance in (mu, y)).
 *
 * Because that half-plane form is CONFORMAL to the Euclidean metric, angles at a point in the
 * (mu, y) chart are already the true Fisher-Rao angles -- no correction needed. That is why the
 * chart term below is a statement about (nu, tau) vs (mu, y) and nothing else.
 *
 * ## Register discipline
 *
 * THEOREM (borrowed, checked): Fisher-Rao uniqueness (Cencov 1982); Gaussian family is hyperbolic
 * with K = -1/2 (Atkinson & Mitchell 1981; Costa, Santos & Strapasson 2015); holonomy around a
 * loop equals the integral of K over the enclosed region (Gauss-Bonnet, do Carmo).
 * COMPUTED: every number this module returns.
 * ARGUED (not proven): that the statistically meaningful Sybil masking group is the ax+b group of
 * sample-space relabelings. That is a modelling claim about adversaries, not a theorem.
 * UNEARNED: any claim that a curved detector is BETTER in production. This module measures
 * separation on synthetic streams only; that is a toy under
 * .claude/rules/toy-is-free-metered-must-be-earned.md until it runs on real streams.
 *
 * Anchors: Rao 1945 (Bull. Calcutta Math. Soc. 37, 81-91) -- Fisher metric as a Riemannian metric;
 * Cencov/Chentsov 1982 (AMS Transl. Math. Monographs 53) -- uniqueness under Markov morphisms;
 * Amari & Nagaoka 2000, Methods of Information Geometry -- dually flat structure, e/m connections;
 * Atkinson & Mitchell 1981 (Sankhya A 43, 345-365) -- closed-form Rao distance for the univariate
 * normal; Costa, Santos & Strapasson 2015 (Discrete Appl. Math. 197) -- the K = -1/2 reading;
 * Bhattacharyya 1943 -- the 2*sqrt(p) sphere embedding (the categorical case, for contrast);
 * Mardia & Jupp 2000, Directional Statistics -- mean resultant length; Doran & Lasenby 2003,
 * Geometric Algebra for Physicists -- Spin(2,1) and the hyperboloid; Douceur 2002 -- the Sybil
 * attack.
 */

// -- Gaussian beliefs, in both charts -------------------------------------------------------------

/** A Gaussian belief in the natural parameters `src/Bayesian/Message.fs` stores. */
export interface NatGaussian {
  /** precision-mean nu = mu * tau */
  readonly nu: number;
  /** precision tau = 1 / sigma^2 */
  readonly tau: number;
}

/** The same belief in mean/standard-deviation coordinates. */
export interface MomentGaussian {
  readonly mu: number;
  readonly sigma: number;
}

export function toMoment(g: NatGaussian): MomentGaussian {
  return { mu: g.nu / g.tau, sigma: 1 / Math.sqrt(g.tau) };
}

export function toNatural(g: MomentGaussian): NatGaussian {
  const tau = 1 / (g.sigma * g.sigma);
  return { nu: g.mu * tau, tau };
}

/** Exact KL(p || q) for univariate Gaussians, in nats. */
export function klGaussian(p: MomentGaussian, q: MomentGaussian): number {
  const dm = p.mu - q.mu;
  return Math.log(q.sigma / p.sigma) + (p.sigma * p.sigma + dm * dm) / (2 * q.sigma * q.sigma) - 0.5;
}

/**
 * Fisher information metric of the univariate Gaussian family in (mu, sigma) coordinates,
 * returned as [[g_mm, g_ms], [g_sm, g_ss]]. Closed form: diag(1/s^2, 2/s^2).
 */
export function fisherMomentMetric(p: MomentGaussian): number[][] {
  const inv = 1 / (p.sigma * p.sigma);
  return [
    [inv, 0],
    [0, 2 * inv],
  ];
}

/**
 * The same metric obtained WITHOUT the closed form: the Fisher metric is the Hessian of
 * KL(p || q) in q at q = p (Amari & Nagaoka 2000, section 3.2). Second-order central differences.
 */
export function fisherMomentMetricNumeric(p: MomentGaussian, h = 1e-4): number[][] {
  const at = (dm: number, ds: number): number => klGaussian(p, { mu: p.mu + dm, sigma: p.sigma + ds });
  const gmm = (at(h, 0) - 2 * at(0, 0) + at(-h, 0)) / (h * h);
  const gss = (at(0, h) - 2 * at(0, 0) + at(0, -h)) / (h * h);
  const gms = (at(h, h) - at(h, -h) - at(-h, h) + at(-h, -h)) / (4 * h * h);
  return [
    [gmm, gms],
    [gms, gss],
  ];
}

/**
 * The Fisher metric pushed into the (nu, tau) chart CliffordAntiSybil actually draws in.
 * Obtained by pulling back through the coordinate change, so the Jacobian is honest rather than
 * hand-derived. This is the object the flat code silently replaces with the identity matrix.
 */
export function fisherNaturalMetric(g: NatGaussian): number[][] {
  const p = toMoment(g);
  const gm = fisherMomentMetric(p);
  // d(mu, sigma)/d(nu, tau) for mu = nu/tau, sigma = tau^{-1/2}
  const dmu_dnu = 1 / g.tau;
  const dmu_dtau = -g.nu / (g.tau * g.tau);
  const dsig_dnu = 0;
  const dsig_dtau = -0.5 * Math.pow(g.tau, -1.5);
  const j = [
    [dmu_dnu, dmu_dtau],
    [dsig_dnu, dsig_dtau],
  ];
  // g'_ab = J^T g J
  const out = [
    [0, 0],
    [0, 0],
  ];
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      let s = 0;
      for (let i = 0; i < 2; i++) {
        for (let k = 0; k < 2; k++) {
          s += (j[i]?.[a] ?? 0) * (gm[i]?.[k] ?? 0) * (j[k]?.[b] ?? 0);
        }
      }
      const row = out[a];
      if (row !== undefined) row[b] = s;
    }
  }
  return out;
}

// -- Curvature ------------------------------------------------------------------------------------

/**
 * Gauss curvature of an ORTHOGONAL 2-metric ds^2 = E du^2 + G dv^2, by the classical formula
 *   K = -1/(2 sqrt(EG)) [ d_u( G_u / sqrt(EG) ) + d_v( E_v / sqrt(EG) ) ]
 * evaluated numerically. Applied to the Fisher-Rao metric of the Gaussian family in (mu, sigma),
 * where E = 1/s^2 and G = 2/s^2 (both mu-independent), this must return exactly -1/2.
 */
export function gaussCurvatureMomentChart(p: MomentGaussian, h = 1e-4): number {
  // E and G ignore mu -- that mu-independence is the reason K comes out CONSTANT, so the unused
  // parameter is load-bearing documentation rather than an oversight.
  const E = (_mu: number, s: number): number => 1 / (s * s);
  const G = (_mu: number, s: number): number => 2 / (s * s);
  const rootEG = (mu: number, s: number): number => Math.sqrt(E(mu, s) * G(mu, s));
  const Gu = (mu: number, s: number): number => (G(mu + h, s) - G(mu - h, s)) / (2 * h);
  const Ev = (mu: number, s: number): number => (E(mu, s + h) - E(mu, s - h)) / (2 * h);
  const termA = (mu: number, s: number): number => Gu(mu, s) / rootEG(mu, s);
  const termB = (mu: number, s: number): number => Ev(mu, s) / rootEG(mu, s);
  const dTermA = (termA(p.mu + h, p.sigma) - termA(p.mu - h, p.sigma)) / (2 * h);
  const dTermB = (termB(p.mu, p.sigma + h) - termB(p.mu, p.sigma - h)) / (2 * h);
  return (-1 / (2 * rootEG(p.mu, p.sigma))) * (dTermA + dTermB);
}

/**
 * Rao (Fisher-Rao geodesic) distance between two univariate Gaussians, closed form.
 * Atkinson & Mitchell 1981: with y = sqrt(2) sigma the family is the Poincare half-plane scaled by
 * 2, so d = sqrt(2) * arccosh(1 + ((dmu)^2 + 2 (dsigma)^2) / (4 s1 s2)).
 */
export function raoDistance(p: MomentGaussian, q: MomentGaussian): number {
  const dm = q.mu - p.mu;
  const ds = q.sigma - p.sigma;
  const arg = 1 + (dm * dm + 2 * ds * ds) / (4 * p.sigma * q.sigma);
  return Math.SQRT2 * Math.acosh(Math.max(1, arg));
}

/**
 * Independent check of `raoDistance` with no hyperbolic geometry used: numerically integrate the
 * Fisher-Rao arc length along the straight mu = const path, which IS a geodesic of this metric
 * (vertical lines are geodesics of the half-plane). Must equal sqrt(2) |log(s2/s1)|.
 */
export function raoDistanceVerticalNumeric(_mu: number, s1: number, s2: number, n = 200000): number {
  const step = (s2 - s1) / n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const s = s1 + step * (i + 0.5);
    // ds_FR = sqrt(2 dsigma^2 / sigma^2) = sqrt(2) |dsigma| / sigma
    acc += (Math.SQRT2 * Math.abs(step)) / s;
  }
  return acc;
}

// -- The hyperboloid model in R^{2,1}, and its rotors ---------------------------------------------

/** A point of the unit hyperboloid in R^{2,1}, metric diag(+1, +1, -1). */
export interface Hyp {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

/** Minkowski inner product of signature (+, +, -). */
export function mink(a: Hyp, b: Hyp): number {
  return a.x * b.x + a.y * b.y - a.t * b.t;
}

/**
 * Belief -> hyperboloid. Uses the half-plane coordinates (mu, y = sqrt(2) sigma) and the standard
 * half-plane -> hyperboloid map. The resulting point satisfies <X, X> = -1 exactly.
 */
export function beliefToHyperboloid(p: MomentGaussian): Hyp {
  const a = p.mu;
  const b = Math.SQRT2 * p.sigma;
  const r = a * a + b * b;
  return { x: (r - 1) / (2 * b), y: a / b, t: (r + 1) / (2 * b) };
}

/**
 * Rao distance read off the hyperboloid: d = sqrt(2) * arccosh(-<X, Y>). A third, independent
 * route to the same number, which is what makes the hyperbolic identification CHECKED rather than
 * cited.
 */
export function raoDistanceHyperboloid(p: MomentGaussian, q: MomentGaussian): number {
  const inner = -mink(beliefToHyperboloid(p), beliefToHyperboloid(q));
  return Math.SQRT2 * Math.acosh(Math.max(1, inner));
}

// -- Cl(3,0), enough of it to port the F# detector faithfully -------------------------------------

/** A Cl(3,0) multivector in the blade-mask order src/Core/Cl3.fs uses. */
export type Mv3 = readonly [number, number, number, number, number, number, number, number];

const ZERO3: Mv3 = [0, 0, 0, 0, 0, 0, 0, 0];

/** Grade-1 vector, matching `Cl3.vector`. */
export function vec3(x: number, y: number, z: number): Mv3 {
  return [0, x, y, 0, z, 0, 0, 0];
}

function reorderSign(a: number, b: number): number {
  let aShift = a >> 1;
  let swaps = 0;
  while (aShift !== 0) {
    let v = aShift & b;
    while (v !== 0) {
      swaps += v & 1;
      v >>= 1;
    }
    aShift >>= 1;
  }
  return swaps % 2 === 0 ? 1 : -1;
}

/** Geometric product in Cl(3,0) -- all basis squares +1, matching `Cl3.gp`. */
export function gp3(a: Mv3, b: Mv3): Mv3 {
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const ai = a[i] ?? 0;
    if (ai === 0) continue;
    for (let j = 0; j < 8; j++) {
      const bj = b[j] ?? 0;
      if (bj === 0) continue;
      const mask = i ^ j;
      out[mask] = (out[mask] ?? 0) + reorderSign(i, j) * ai * bj;
    }
  }
  return out as unknown as Mv3;
}

export function add3(a: Mv3, b: Mv3): Mv3 {
  return a.map((v, i) => v + (b[i] ?? 0)) as unknown as Mv3;
}

export function sub3(a: Mv3, b: Mv3): Mv3 {
  return a.map((v, i) => v - (b[i] ?? 0)) as unknown as Mv3;
}

export function smul3(s: number, a: Mv3): Mv3 {
  return a.map((v) => s * v) as unknown as Mv3;
}

export function norm3(a: Mv3): number {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
}

export function distSq3(a: Mv3, b: Mv3): number {
  return a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0);
}

// -- The detector under test, ported line for line ------------------------------------------------

/**
 * Faithful port of `CliffordAntiSybil.computeGeometricCorrelation`
 * (src/Bayesian/CliffordAntiSybil.fs). Kept structurally identical -- same normalisation, same
 * average rotor, same exp(-variance/2) decay, same |avgRotor|^2 scaling, same clamp -- so any
 * number this module reports about the flat detector is a number about the shipped one.
 */
export function flatGeometricCorrelation(streamA: readonly NatGaussian[], streamB: readonly NatGaussian[]): number {
  if (streamA.length < 2 || streamB.length < 2) return 0;
  const len = Math.min(streamA.length, streamB.length);
  const toVec = (g: NatGaussian): Mv3 => vec3(g.nu, g.tau, 0);
  const vecsA = streamA.slice(0, len).map(toVec);
  const vecsB = streamB.slice(0, len).map(toVec);
  const deltas = (vs: readonly Mv3[]): Mv3[] => vs.slice(0, len - 1).map((v, i) => sub3(vs[i + 1] as Mv3, v));
  const dA = deltas(vecsA);
  const dB = deltas(vecsB);
  const rotors: Mv3[] = [];
  for (const [i, a] of dA.entries()) {
    const b = dB[i];
    if (b === undefined) continue;
    const na = norm3(a);
    const nb = norm3(b);
    if (na < 1e-12 || nb < 1e-12) continue;
    rotors.push(gp3(smul3(1 / nb, b), smul3(1 / na, a)));
  }
  if (rotors.length < 1) return 0;
  const avg = smul3(1 / rotors.length, rotors.reduce(add3, ZERO3));
  const variance = rotors.reduce((s, r) => s + distSq3(r, avg), 0) / rotors.length;
  const corr = Math.exp(-variance * 0.5);
  const n = norm3(avg);
  return Math.max(0, Math.min(1, corr * n * n));
}

/**
 * The closed form the detector reduces to. Every rotor is a UNIT scalar+bivector, so the whole
 * score is a function of one number: the circular mean resultant length rho of the cross-stream
 * angles (Mardia & Jupp 2000). variance = 1 - rho^2 exactly, hence
 *
 *   corr = rho^2 * exp(-(1 - rho^2) / 2)
 *
 * This is what makes the flat and curved variants comparable: they can be made to differ ONLY in
 * how the angles are computed, with the statistic held fixed.
 */
export function scoreFromResultant(rho: number): number {
  return Math.max(0, Math.min(1, rho * rho * Math.exp(-(1 - rho * rho) / 2)));
}

/** Mean resultant length of a set of angles: |mean(e^{i phi})|. */
export function meanResultant(angles: readonly number[]): number {
  if (angles.length === 0) return 0;
  let c = 0;
  let s = 0;
  for (const a of angles) {
    c += Math.cos(a);
    s += Math.sin(a);
  }
  return Math.hypot(c / angles.length, s / angles.length);
}

// -- The two error terms --------------------------------------------------------------------------

/** Angle between two plane vectors under a metric g (defaults to Euclidean when g is identity). */
export function angleUnderMetric(
  u: readonly [number, number],
  v: readonly [number, number],
  g: readonly (readonly number[])[],
): number {
  const ip = (a: readonly [number, number], b: readonly [number, number]): number =>
    a[0] * (g[0]?.[0] ?? 0) * b[0] +
    a[0] * (g[0]?.[1] ?? 0) * b[1] +
    a[1] * (g[1]?.[0] ?? 0) * b[0] +
    a[1] * (g[1]?.[1] ?? 0) * b[1];
  const c = ip(u, v) / Math.sqrt(ip(u, u) * ip(v, v));
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

const IDENTITY2: number[][] = [
  [1, 0],
  [0, 1],
];

/**
 * TERM 1 -- the CHART error, and the finding that decides the whole question.
 *
 * At a single point, with NO curvature involved, the flat code measures angles with the identity
 * matrix while the canonical metric is `fisherNaturalMetric`. This returns the largest angle
 * disagreement over a sweep of tangent-vector pairs at the point. It is a property of the point,
 * not of the step size, so it does NOT shrink as the belief stream slows down -- which is exactly
 * what disqualifies "flat is the first-order approximation" as a defence.
 */
export function maxChartAngleError(g: NatGaussian, samples = 720): number {
  const gf = fisherNaturalMetric(g);
  let worst = 0;
  for (let i = 0; i < samples; i++) {
    const a: [number, number] = [Math.cos((2 * Math.PI * i) / samples), Math.sin((2 * Math.PI * i) / samples)];
    for (let j = 0; j < samples; j += 8) {
      const b: [number, number] = [Math.cos((2 * Math.PI * j) / samples), Math.sin((2 * Math.PI * j) / samples)];
      const flat = angleUnderMetric(a, b, IDENTITY2);
      const fisher = angleUnderMetric(a, b, gf);
      worst = Math.max(worst, Math.abs(flat - fisher));
    }
  }
  return worst;
}

/**
 * TERM 2 -- the CURVATURE (holonomy) error, which DOES vanish with step size.
 *
 * Gauss-Bonnet: parallel transport around a closed loop rotates a tangent vector by exactly the
 * integral of K over the enclosed region. With K = -1/2 constant, the holonomy angle of a geodesic
 * triangle is |K| * area = area/2, and by Gauss-Bonnet the area of a hyperbolic geodesic triangle
 * with K = -1/2 is 2 * (pi - sum of interior angles). We compute the DEFECT directly as the angle
 * sum shortfall of the triangle on the three beliefs -- no transport code required, and it is the
 * same number.
 *
 * Returned: { angleSum, defect, holonomy } with holonomy = |K| * area = defect (in radians).
 */
export function triangleHolonomy(
  p: MomentGaussian,
  q: MomentGaussian,
  r: MomentGaussian,
): { angleSum: number; defect: number; sides: [number, number, number] } {
  // Hyperbolic law of cosines on the K = -1 model: our metric is 2x that model, so lengths in the
  // unit-curvature model are the Rao distances divided by sqrt(2).
  const a = raoDistance(q, r) / Math.SQRT2;
  const b = raoDistance(p, r) / Math.SQRT2;
  const c = raoDistance(p, q) / Math.SQRT2;
  const ang = (opp: number, s1: number, s2: number): number => {
    const num = Math.cosh(s1) * Math.cosh(s2) - Math.cosh(opp);
    const den = Math.sinh(s1) * Math.sinh(s2);
    if (den === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, num / den)));
  };
  const A = ang(a, b, c);
  const B = ang(b, a, c);
  const C = ang(c, a, b);
  const angleSum = A + B + C;
  return { angleSum, defect: Math.PI - angleSum, sides: [a, b, c] };
}

// -- Fisher-Rao-native detector -------------------------------------------------------------------

/**
 * The isometry-invariant signature of a discrete trajectory: its TURN ANGLES. At each interior
 * vertex the incoming and outgoing geodesic velocities live in the SAME tangent space, so the
 * angle between them needs no parallel transport and is manifestly invariant under every isometry
 * of the manifold. In the (mu, y) half-plane chart the Fisher-Rao metric is CONFORMAL to the
 * Euclidean one, so the angle equals the Euclidean angle between the two geodesic initial
 * velocities in that chart -- which is what this computes.
 *
 * Geodesic initial velocity in the half-plane, from P to Q: geodesics are vertical lines and
 * semicircles centred on the boundary. We get the initial direction from the circle through P and
 * Q centred on y = 0 (or straight up/down when mu is equal).
 */
export function halfPlaneInitialDirection(from: MomentGaussian, to: MomentGaussian): [number, number] {
  const x1 = from.mu;
  const y1 = Math.SQRT2 * from.sigma;
  const x2 = to.mu;
  const y2 = Math.SQRT2 * to.sigma;
  if (Math.abs(x2 - x1) < 1e-15) return [0, Math.sign(y2 - y1)];
  // Centre c on the boundary equidistant (in Euclidean sense) from both: the geodesic semicircle.
  const c = (x2 * x2 + y2 * y2 - (x1 * x1 + y1 * y1)) / (2 * (x2 - x1));
  // Tangent to the circle at P, oriented toward Q: perpendicular to the radius (x1 - c, y1).
  const rx = x1 - c;
  const ry = y1;
  const t: [number, number] = [-ry, rx];
  // Orient: pick the sign that moves toward Q along the circle.
  const towardQ = (x2 - x1) * t[0] + (y2 - y1) * t[1];
  return towardQ >= 0 ? t : [-t[0], -t[1]];
}

/** Turn angles of a trajectory, measured in the Fisher-Rao geometry. Isometry invariant. */
export function fisherTurnAngles(stream: readonly NatGaussian[]): number[] {
  const pts = stream.map(toMoment);
  const out: number[] = [];
  for (let i = 1; i + 1 < pts.length; i++) {
    const p = pts[i] as MomentGaussian;
    const back = halfPlaneInitialDirection(p, pts[i - 1] as MomentGaussian);
    const fwd = halfPlaneInitialDirection(p, pts[i + 1] as MomentGaussian);
    out.push(Math.atan2(back[0] * fwd[1] - back[1] * fwd[0], back[0] * fwd[0] + back[1] * fwd[1]));
  }
  return out;
}

/** Turn angles of the SAME trajectory in the flat (nu, tau) chart the shipped code uses. */
export function flatTurnAngles(stream: readonly NatGaussian[]): number[] {
  const out: number[] = [];
  for (let i = 1; i + 1 < stream.length; i++) {
    const p = stream[i] as NatGaussian;
    const a = stream[i - 1] as NatGaussian;
    const b = stream[i + 1] as NatGaussian;
    const back: [number, number] = [a.nu - p.nu, a.tau - p.tau];
    const fwd: [number, number] = [b.nu - p.nu, b.tau - p.tau];
    out.push(Math.atan2(back[0] * fwd[1] - back[1] * fwd[0], back[0] * fwd[0] + back[1] * fwd[1]));
  }
  return out;
}

/**
 * Fisher-Rao-native clone score. Identical STATISTIC to the shipped detector
 * (`scoreFromResultant` of a set of angle differences); the ONLY change is that the angles are
 * turn angles measured in the true geometry instead of chart angles measured with the identity
 * matrix. A controlled comparison, one variable.
 */
export function fisherCloneScore(streamA: readonly NatGaussian[], streamB: readonly NatGaussian[]): number {
  const a = fisherTurnAngles(streamA);
  const b = fisherTurnAngles(streamB);
  const n = Math.min(a.length, b.length);
  if (n < 1) return 0;
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) diffs.push((b[i] as number) - (a[i] as number));
  return scoreFromResultant(meanResultant(diffs));
}

/** The same statistic on flat turn angles -- the control arm for the comparison above. */
export function flatTurnCloneScore(streamA: readonly NatGaussian[], streamB: readonly NatGaussian[]): number {
  const a = flatTurnAngles(streamA);
  const b = flatTurnAngles(streamB);
  const n = Math.min(a.length, b.length);
  if (n < 1) return 0;
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) diffs.push((b[i] as number) - (a[i] as number));
  return scoreFromResultant(meanResultant(diffs));
}

// -- Synthetic streams and the unit-rescaling probe -----------------------------------------------

/** Deterministic PRNG so every number here is DST-replayable from a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianSample(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * A belief stream produced by honest Bayesian updating: each observation adds
 * (tauObs * x, tauObs) to the natural parameters -- which is exactly what `Gaussian.( * )` does.
 * So the trajectory in the shipped detector's chart is a random walk whose tau-component is a
 * deterministic ramp; that is a real and slightly awkward property of the chart, reported in the
 * doc rather than hidden here.
 */
export function bayesianStream(opts: {
  readonly steps: number;
  readonly trueMean: number;
  readonly obsSd: number;
  readonly priorTau: number;
  readonly seed: number;
}): NatGaussian[] {
  const rand = mulberry32(opts.seed);
  const tauObs = 1 / (opts.obsSd * opts.obsSd);
  let nu = 0;
  let tau = opts.priorTau;
  const out: NatGaussian[] = [{ nu, tau }];
  for (let i = 0; i < opts.steps; i++) {
    const x = opts.trueMean + opts.obsSd * gaussianSample(rand);
    nu += tauObs * x;
    tau += tauObs;
    out.push({ nu, tau });
  }
  return out;
}

/**
 * Rescale the underlying random variable by k (x -> k x). Under this the natural parameters
 * transform as nu -> nu / k, tau -> tau / k^2. This is a pure change of MEASUREMENT UNIT on the
 * quantity being believed about -- ratings in points versus kilo-points -- and it changes nothing
 * about who is a Sybil. Any honest detector must be invariant under it.
 */
export function rescaleUnits(stream: readonly NatGaussian[], k: number): NatGaussian[] {
  return stream.map((g) => ({ nu: g.nu / k, tau: g.tau / (k * k) }));
}

/**
 * A "rotated clone" in the sense CAS-4 in tests/Bayesian.Tests/CliffordAntiSybil.Tests.fs asserts:
 * apply a Euclidean rotation to the (nu, tau) chart vectors. There is no operation on a belief
 * that does this -- it mixes the precision-mean axis into the precision axis, and it can send tau
 * negative (an improper message). It is kept here precisely so the doc can measure what the flat
 * detector's masking group contains that no adversary could actually perform.
 */
export function chartRotate(stream: readonly NatGaussian[], theta: number): NatGaussian[] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return stream.map((g) => ({ nu: c * g.nu - s * g.tau, tau: s * g.nu + c * g.tau }));
}

/** Sample-space affine relabeling x -> a x + b, the statistically real masking move. */
export function affineRelabel(stream: readonly NatGaussian[], a: number, b: number): NatGaussian[] {
  return stream.map((g) => {
    const m = toMoment(g);
    return toNatural({ mu: a * m.mu + b, sigma: Math.abs(a) * m.sigma });
  });
}

// -- Separation measurement ------------------------------------------------------------------------

/** Area under the ROC curve for scores of positives vs negatives (Mann-Whitney U form). */
export function auc(positives: readonly number[], negatives: readonly number[]): number {
  if (positives.length === 0 || negatives.length === 0) return 0.5;
  let wins = 0;
  for (const p of positives) {
    for (const n of negatives) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

// -- Cl(2,1): the algebra the geometry actually asks for -------------------------------------------

/**
 * A Cl(2,1) multivector, blade-mask order (S, e1, e2, e12, e3, e13, e23, e123), with
 * e1^2 = e2^2 = +1 and e3^2 = -1. Same bitmask machinery as Cl3; only the square of e3 changes.
 *
 * Why this signature and not another -- the identification, by INVARIANTS not by dimension count
 * (.claude/rules/numerology-vs-number-theory.md). Cl(3,0) and Cl(2,1) are both 8-dimensional with
 * 3-dimensional rotor groups, so dimension identifies nothing. What separates them:
 *
 *   invariant                     | Cl(3,0)          | Cl(2,1)            | which one we need
 *   ------------------------------|------------------|--------------------|------------------
 *   rotor group                   | Spin(3) = SU(2)  | Spin+(2,1)=SL(2,R) | must be NON-COMPACT:
 *                                 | COMPACT          | NON-COMPACT        | Rao distance is
 *                                 |                  |                    | unbounded, so isometry
 *                                 |                  |                    | orbits are unbounded
 *   even subalgebra               | quaternions H    | M_2(R)             | must have ZERO DIVISORS
 *                                 | a division ring  | zero divisors      | (checked below)
 *   bivector squares              | all -1           | mixed -1 and +1    | boosts must exist:
 *                                 | rotations only   | rotations + boosts | rescaling a belief is
 *                                 |                  |                    | a translation along a
 *                                 |                  |                    | geodesic = a boost
 *
 * Both discriminators are computed in the test file, so this is an identification and not a
 * coincidence of counts.
 */
export type Mv21 = readonly [number, number, number, number, number, number, number, number];

/** Signature of blade `mask` under e1^2=e2^2=+1, e3^2=-1: (-1)^(number of e3 factors). */
function metricSign21(mask: number): number {
  return (mask & 4) !== 0 ? -1 : 1;
}

/** Geometric product in Cl(2,1). */
export function gp21(a: Mv21, b: Mv21): Mv21 {
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const ai = a[i] ?? 0;
    if (ai === 0) continue;
    for (let j = 0; j < 8; j++) {
      const bj = b[j] ?? 0;
      if (bj === 0) continue;
      const mask = i ^ j;
      const shared = i & j;
      out[mask] = (out[mask] ?? 0) + reorderSign(i, j) * metricSign21(shared) * ai * bj;
    }
  }
  return out as unknown as Mv21;
}

/** Reverse (grade involution ~x): grades 2 and 3 flip sign. */
export function reverse21(a: Mv21): Mv21 {
  const popcount = (n: number): number => {
    let c = 0;
    let v = n;
    while (v !== 0) {
      c += v & 1;
      v >>= 1;
    }
    return c;
  };
  return a.map((v, i) => {
    const g = popcount(i);
    return ((g * (g - 1)) / 2) % 2 === 0 ? v : -v;
  }) as unknown as Mv21;
}

/** Grade-1 vector of Cl(2,1); `t` is the timelike component. */
export function vec21(x: number, y: number, t: number): Mv21 {
  return [0, x, y, 0, t, 0, 0, 0];
}

export function hypToMv(h: Hyp): Mv21 {
  return vec21(h.x, h.y, h.t);
}

export function mvToHyp(m: Mv21): Hyp {
  return { x: m[1], y: m[2], t: m[4] };
}

/**
 * The BOOST rotor in the e1-e3 (spacelike-timelike) plane: R = cosh(phi/2) + sinh(phi/2) e13,
 * because e13^2 = +1 in this signature. A rotor in the e1-e2 plane instead has e12^2 = -1 and
 * gives an ordinary rotation. The presence of BOTH is the whole reason the signature must be
 * mixed -- and it is why Cl(3,0), where every bivector squares to -1, cannot host this geometry.
 */
export function boostRotor13(phi: number): Mv21 {
  return [Math.cosh(phi / 2), 0, 0, 0, 0, Math.sinh(phi / 2), 0, 0];
}

/**
 * The rotor that implements the belief-rescaling isometry `x -> a*x` (so mu -> a*mu,
 * sigma -> |a|*sigma) as the sandwich X -> R X ~R on the hyperboloid. Rapidity is -log(a): the
 * SIGN is a convention of the sandwich orientation, and it is pinned by the test rather than
 * asserted here, because getting it backwards is exactly the mistake that produced the first,
 * wrong version of this function.
 *
 * That this rescaling is a BOOST and not a rotation is the load-bearing structural fact. A Sybil
 * masking itself by relabeling the units of what it believes about is moving along a geodesic of
 * the belief manifold -- an unbounded, non-compact motion. No rotor of the compact Cl(3,0) rotor
 * group can express it, which is the geometric statement of why the shipped flat detector's
 * verdict moves when the units move.
 */
export function beliefScaleRotor(a: number): Mv21 {
  return boostRotor13(-Math.log(Math.abs(a)));
}

/** Hyperboloid point back to a belief. Inverse of `beliefToHyperboloid`. */
export function hyperboloidToBelief(h: Hyp): MomentGaussian {
  const b = 1 / (h.t - h.x);
  return { mu: h.y * b, sigma: b / Math.SQRT2 };
}

/** Apply a rotor: X -> R X ~R. */
export function applyRotor21(r: Mv21, x: Mv21): Mv21 {
  return gp21(gp21(r, x), reverse21(r));
}
