/**
 * representation-layer-pga-motor.ts — Cl(3,0,1) MOTORS, MEASURED AGAINST WHAT WE RUN TODAY.
 *
 * Aaron 2026-09-09: *"i'm happy to look at other options as well for a combined
 * graphics/physics engine, maybe quaternions or something else would be better ... if we
 * are paying for extra dimension and then projecting down that's going to be slow."*
 *
 * This module implements Projective Geometric Algebra — `Cl(3,0,1)`, three Euclidean basis
 * vectors and one degenerate one — far enough to MEASURE it rather than survey it: the full
 * 16-component geometric product as the correctness oracle, an unrolled motor-on-point
 * sandwich as the fast path, an exact BigInt version for the exactness question, and the
 * three rivals a real engine would actually pick between.
 *
 * ## What is being decided, and what is already settled
 *
 * **Settled before this module ran, and NOT re-measured here:** the 2-skeleton of 4_21
 * carries exactly 27 faces on every one of its 6,720 edges. That count is computed from the
 * combinatorial face list with no coordinates and no embedding anywhere in it, so it is a
 * property of the polytope, not of a projection and not of an algebra. **No change of
 * representation can alter it** — not PGA, not CGA, not quaternions. The surface is
 * two-sided under every algebra, and any claim that a new representation "fixes" the
 * rendering is false at the outset.
 *
 * So PGA is on trial for **performance and uniformity**, never for correctness:
 *
 *   - does it remove a per-frame projection, and what is that worth in ns/vertex;
 *   - what does a rigid transform cost against a 4x4 matrix and against a quaternion;
 *   - what does it cost us in exactness, which is the property that paid for the 8D.
 *
 * ## The fairness question the benchmark has to answer honestly
 *
 * The 8D-to-3D projection in the shipped ladder is a **one-time preprocessing step**: the
 * 240 root positions are projected once, and the browser then animates the 3D result with
 * an ordinary camera. Under that regime the projection is amortised to nothing per frame,
 * and PGA's "no projection step" saves exactly zero. The projection only costs per frame if
 * the scene is animated **in 8D** — an 8D rotor applied to the roots, re-projected every
 * frame — which is the regime Aaron's phrase *"using the 8d to do calculations we needed"*
 * describes. So both regimes are measured and reported separately, because quoting the
 * animated-in-8D number as though it were today's cost would be a benchmark that flatters
 * the recommendation.
 *
 * ## Registers
 *
 * - `metered` — the algebraic identities: motor sandwich against the full geometric-product
 *   oracle, against a float Euclidean reflection composition, and the exact BigInt results.
 * - `metered`, ON ONE MACHINE — every ns/op figure, valid for the CPU and runtime named in
 *   the companion research document and for nothing else.
 * - `unmetered` — any extrapolation to other hardware, to a GPU, or to SIMD. No `v128` inner
 *   loop exists here and none is claimed.
 *
 * ## Prior art (Beacon)
 *
 * - **Charles Gunn**, *Geometric Algebras for Euclidean Geometry* (arXiv:1411.6502; and the
 *   2011 TU Berlin thesis *Geometry, Kinematics, and Rigid Body Mechanics in Cayley-Klein
 *   Geometries*) — the case for `P(R*_{3,0,1})` as the Euclidean-geometry algebra, and the
 *   solution-space/co-dimension argument against CGA for rigid-body dynamics.
 * - **W. K. Clifford**, *Preliminary Sketch of Biquaternions* (1873), and **Eduard Study**,
 *   *Geometrie der Dynamen* (1903) — dual quaternions, which are the even subalgebra of this
 *   algebra. A motor IS a dual quaternion, which is why the quaternion row below is not a
 *   rival so much as a special case.
 * - **Robert S. Ball**, *A Treatise on the Theory of Screws* (1900) — screw motion; the
 *   bivector velocity/momentum pairing that makes PGA attractive for the *physics* half.
 * - **Steven De Keninck**, `ganja.js`, and **Jeremy Ong**, `klein` — the reference
 *   implementations whose unrolled products this file's fast path is the same shape as.
 *   Neither is vendored; the products here are generated from the metric in-file.
 * - **Leo Dorst, Daniel Fontijne & Stephen Mann**, *Geometric Algebra for Computer Science*
 *   (2007) — the standard text for the sandwich/versor formulation.
 */

// ── the algebra ─────────────────────────────────────────────────────────────

/** Basis-blade count of `Cl(3,0,1)`: 2^4. */
export const BLADE_COUNT = 16;

/**
 * Blade masks. Bit 0 is `e0` (the degenerate one, `e0^2 = 0`); bits 1..3 are `e1,e2,e3`
 * with `ei^2 = +1`. A multivector is 16 coefficients indexed by mask.
 */
export const E0 = 1 << 0;
export const E1 = 1 << 1;
export const E2 = 1 << 2;
export const E3 = 1 << 3;

/** Population count of a 4-bit mask. */
function popcount4(m: number): number {
  return ((m >> 0) & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
}

/** Grade of a blade. */
export function grade(mask: number): number {
  return popcount4(mask);
}

/**
 * Sign from reordering `e_a * e_b` into ascending order — the standard swap count.
 *
 * Independent of the metric; the metric enters separately, below, and only through the
 * degenerate generator.
 */
export function reorderSign(a: number, b: number): number {
  let n = 0;
  let x = a >> 1;
  while (x !== 0) {
    n += popcount4(x & b);
    x >>= 1;
  }
  return (n & 1) === 0 ? 1 : -1;
}

/**
 * The product of two basis blades, as `{ mask, sign }`.
 *
 * `sign === 0` means the product vanishes, which happens exactly when both blades contain
 * `e0` — that is the whole content of "degenerate": `e0^2 = 0`. Every other shared generator
 * squares to `+1` and contributes no sign. Making this one line explicit is the point: the
 * difference between PGA and Euclidean `Cl(4,0)` is a single `if`.
 */
export function bladeProduct(a: number, b: number): { mask: number; sign: number } {
  if ((a & b & E0) !== 0) return { mask: 0, sign: 0 };
  return { mask: a ^ b, sign: reorderSign(a, b) };
}

/** The 16x16 product table, built once from the metric. Nothing here is hand-written. */
export const PRODUCT_TABLE: ReadonlyArray<ReadonlyArray<{ mask: number; sign: number }>> = (() => {
  const t: Array<Array<{ mask: number; sign: number }>> = [];
  for (let a = 0; a < BLADE_COUNT; a++) {
    const row: Array<{ mask: number; sign: number }> = [];
    for (let b = 0; b < BLADE_COUNT; b++) row.push(bladeProduct(a, b));
    t.push(row);
  }
  return t;
})();

/** A general multivector: 16 coefficients indexed by blade mask. */
export type Mv = readonly number[];

/** The zero multivector. */
export function zero(): number[] {
  return new Array<number>(BLADE_COUNT).fill(0);
}

/** Full geometric product. The CORRECTNESS ORACLE — never the fast path. */
export function gp(x: Mv, y: Mv): number[] {
  const out = zero();
  for (let a = 0; a < BLADE_COUNT; a++) {
    const xa = x[a] ?? 0;
    if (xa === 0) continue;
    const row = PRODUCT_TABLE[a];
    if (row === undefined) continue;
    for (let b = 0; b < BLADE_COUNT; b++) {
      const yb = y[b] ?? 0;
      if (yb === 0) continue;
      const e = row[b];
      if (e === undefined || e.sign === 0) continue;
      out[e.mask] = (out[e.mask] ?? 0) + e.sign * xa * yb;
    }
  }
  return out;
}

/** Reverse: grade `g` picks up `(-1)^(g(g-1)/2)`. */
export function reverse(x: Mv): number[] {
  const out = zero();
  for (let m = 0; m < BLADE_COUNT; m++) {
    const g = grade(m);
    out[m] = (((g * (g - 1)) / 2) & 1) === 0 ? (x[m] ?? 0) : -(x[m] ?? 0);
  }
  return out;
}

// ── geometry: planes are grade 1, points are grade 3 ────────────────────────

/** Mask of the trivector `e123`, the homogeneous weight of a point. */
export const E123 = E1 | E2 | E3;
/** Mask of `e012`. */
export const E012 = E0 | E1 | E2;
/** Mask of `e013`. */
export const E013 = E0 | E1 | E3;
/** Mask of `e023`. */
export const E023 = E0 | E2 | E3;

/**
 * The plane `a*x + b*y + c*z + d = 0` as a grade-1 multivector.
 *
 * NOT normalised, and deliberately so — see `motorFromPlanes`. In a projective algebra an
 * unnormalised plane reflects correctly up to a positive scale, and the scale divides out at
 * readout. That is the property the exactness measurement turns on.
 */
export function plane(a: number, b: number, c: number, d: number): number[] {
  const p = zero();
  p[E1] = a;
  p[E2] = b;
  p[E3] = c;
  p[E0] = d;
  return p;
}

/**
 * The Euclidean point `(x, y, z)` as a grade-3 multivector.
 *
 * The signs are the standard PGA convention (`e123 + x e032 + y e013 + z e021`) rewritten on
 * ascending-mask blades, which flips two of them. They are not asserted from memory: the
 * test cross-checks the whole sandwich against an independently written float Euclidean
 * reflection, and a wrong sign here fails that check loudly.
 */
export function point(x: number, y: number, z: number): number[] {
  const p = zero();
  p[E123] = 1;
  p[E023] = -x;
  p[E013] = y;
  p[E012] = -z;
  return p;
}

/**
 * Read a Euclidean point back out of a grade-3 multivector, dividing by the weight.
 *
 * **This division is the single readout boundary**, and it is the exact analogue of
 * `Tsirelson.fs` locking `S^2 = 8` in integers and letting the irrational appear only when
 * a number is finally wanted. Everything upstream can be integers; this is where a rational
 * appears, and no square root appears at all.
 */
export function pointCoords(p: Mv): { x: number; y: number; z: number; w: number } {
  const w = p[E123] ?? 0;
  return { x: -(p[E023] ?? 0) / w, y: (p[E013] ?? 0) / w, z: -(p[E012] ?? 0) / w, w };
}

/**
 * The motor that is the composition of reflections in `p` then `q`: simply `q * p`.
 *
 * If the planes meet, this is a rotation about their common line through twice their angle;
 * if they are parallel, a translation through twice their separation. **One object, both
 * motions** — which is the structural claim PGA is made of, and the reason a translation
 * needs no special case anywhere downstream.
 *
 * No normalisation. The result of the sandwich is then scaled by `(p.p)(q.q)`, and since a
 * point is homogeneous that scale divides out in `pointCoords`.
 */
export function motorFromPlanes(p: Mv, q: Mv): number[] {
  return gp(q, p);
}

/** Sandwich `M X ~M` via the general product. The oracle; `applyMotorFast` is the fast path. */
export function sandwich(m: Mv, x: Mv): number[] {
  return gp(gp(m, x), reverse(m));
}

/**
 * The 8 components of a motor, in the even subalgebra: scalar, three Euclidean bivectors,
 * three degenerate bivectors, pseudoscalar.
 *
 * These eight numbers ARE a dual quaternion — Clifford 1873, Study 1903 — which is why
 * "should we use quaternions instead" does not name an alternative to this algebra. A unit
 * quaternion is the sub-case with the four degenerate components zero.
 */
export interface Motor {
  readonly s: number;
  readonly e23: number;
  readonly e31: number;
  readonly e12: number;
  readonly e01: number;
  readonly e02: number;
  readonly e03: number;
  readonly e0123: number;
}

/** Floats a motor occupies. Compare: 16 for a 4x4 matrix, 7 for quaternion + vec3. */
export const MOTOR_FLOATS = 8;
/** Floats a 4x4 matrix occupies. */
export const MATRIX_FLOATS = 16;
/** Floats a quaternion-plus-translation pair occupies. */
export const QUAT_TRANSLATION_FLOATS = 7;

/** Extract the 8 even-grade components from a general multivector. */
export function toMotor(m: Mv): Motor {
  return {
    s: m[0] ?? 0,
    e23: m[E2 | E3] ?? 0,
    e31: -(m[E1 | E3] ?? 0),
    e12: m[E1 | E2] ?? 0,
    e01: m[E0 | E1] ?? 0,
    e02: m[E0 | E2] ?? 0,
    e03: m[E0 | E3] ?? 0,
    e0123: m[E0 | E1 | E2 | E3] ?? 0,
  };
}

/**
 * A motor decomposed into the only two things a per-vertex loop can use: a unit quaternion
 * and a translation.
 *
 * **This type is a FINDING, not a convenience.** Symbolic expansion of `M X ~M` over the
 * eight motor components (run, not asserted — the expansion is reproduced in the companion
 * research document) returns a result that is **grade 3 only**, whose weight component is
 *
 *     e123  =  s^2 + e23^2 + e31^2 + e12^2
 *
 * — the ROTOR norm alone, with all four degenerate components contributing nothing to it —
 * and whose three remaining components are **degree 1 in the point**. A map that is linear
 * plus constant is affine; its linear part is the rotor and its constant part is the image
 * of the origin. So a motor's action on points is exactly *"rotate by a quaternion, then
 * translate"*, and there is no per-vertex arithmetic left for the degenerate half to do.
 *
 * That is the honest answer to Aaron's *"maybe quaternions would be better"*: per vertex, a
 * PGA motor and a quaternion-plus-translation are **the same computation**, because the
 * motor's even subalgebra IS the dual quaternions (Clifford 1873, Study 1903). PGA's
 * advantage is in composing, interpolating and unifying motions — never in the inner loop.
 */
export interface DecomposedMotor {
  readonly quat: QuatPose;
  /** The rotor norm squared that the sandwich divides by; 1 for a normalised motor. */
  readonly weight: number;
}

/**
 * Decompose a motor into unit quaternion plus translation, using the oracle once.
 *
 * The translation is obtained by sending the ORIGIN through the general-product sandwich
 * rather than by transcribing an expanded formula. That is deliberate: it is correct by the
 * affine argument above and cannot carry a sign slip, whereas a hand-copied twelve-term
 * polynomial can and — on the first attempt at this file — did, which is why the check
 * against an independently written Euclidean reflection exists at all.
 *
 * Cost is per MOTOR, not per vertex, so it does not enter the per-vertex benchmark.
 */
export function decomposeMotor(m: Mv): DecomposedMotor {
  const mo = toMotor(m);
  const n2 = mo.s * mo.s + mo.e23 * mo.e23 + mo.e31 * mo.e31 + mo.e12 * mo.e12;
  const n = Math.sqrt(n2);
  const origin = pointCoords(sandwich(m, point(0, 0, 0)));
  // The vector part is CONJUGATED. A rotor sandwich `R x ~R` and Hamilton's `q v q*` run
  // their rotations in opposite senses, so a bivector `e23` maps to quaternion component
  // `-i` and not `+i`. This sign was determined by measuring the motor's own rotation matrix
  // (the images of the three basis points, minus the image of the origin) against all four
  // candidate assignments, and only this one agreed — to 3.8e-15, with the nearest rival
  // wrong by 3.2. It is asserted by the oracle-agreement test rather than by this comment.
  return {
    quat: { w: mo.s / n, qx: -mo.e23 / n, qy: -mo.e31 / n, qz: -mo.e12 / n, tx: origin.x, ty: origin.y, tz: origin.z },
    weight: n2,
  };
}

/**
 * Motor applied to a Euclidean point — the fast path, and per the finding above it is
 * literally the quaternion path with the motor's translation added.
 *
 * The test asserts it agrees with `sandwich` through the general product on seeded random
 * motors and points, so the specialisation's equality with the oracle is checked, never
 * trusted.
 */
export function applyMotorFast(d: DecomposedMotor, x: number, y: number, z: number): { x: number; y: number; z: number } {
  return applyQuat(d.quat, x, y, z);
}

// ── the rivals, written to be measured fairly ───────────────────────────────

/** A 4x4 row-major matrix. */
export type Mat4 = Float64Array;

/** Apply a 4x4 matrix to a point, affine (w = 1), the way a renderer actually does it. */
export function applyMat4(m: Mat4, x: number, y: number, z: number): { x: number; y: number; z: number } {
  return {
    x: (m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0) * z + (m[3] ?? 0),
    y: (m[4] ?? 0) * x + (m[5] ?? 0) * y + (m[6] ?? 0) * z + (m[7] ?? 0),
    z: (m[8] ?? 0) * x + (m[9] ?? 0) * y + (m[10] ?? 0) * z + (m[11] ?? 0),
  };
}

/** A unit quaternion `(w, x, y, z)` plus a translation. Aaron named this one explicitly. */
export interface QuatPose {
  readonly w: number;
  readonly qx: number;
  readonly qy: number;
  readonly qz: number;
  readonly tx: number;
  readonly ty: number;
  readonly tz: number;
}

/** Rotate by quaternion then translate — the standard two-cross-product form. */
export function applyQuat(p: QuatPose, x: number, y: number, z: number): { x: number; y: number; z: number } {
  const tx = 2 * (p.qy * z - p.qz * y);
  const ty = 2 * (p.qz * x - p.qx * z);
  const tz = 2 * (p.qx * y - p.qy * x);
  return {
    x: x + p.w * tx + (p.qy * tz - p.qz * ty) + p.tx,
    y: y + p.w * ty + (p.qz * tx - p.qx * tz) + p.ty,
    z: z + p.w * tz + (p.qx * ty - p.qy * tx) + p.tz,
  };
}

/**
 * The regime the shipped ladder is in when the scene ANIMATES in 8D: an 8x8 orthogonal
 * transform of the root, then the rank-3 projection. 8x8 then 3x8, per vertex, per frame.
 *
 * This is the cost Aaron's objection is about. It is NOT today's per-frame cost, because
 * today's projection happens once at load; both are reported and never conflated.
 */
export function apply8dThenProject(
  rot: Float64Array,
  proj: Float64Array,
  v: Float64Array,
  scratch: Float64Array,
): { x: number; y: number; z: number } {
  for (let i = 0; i < 8; i++) {
    let s = 0;
    const base = i * 8;
    for (let j = 0; j < 8; j++) s += (rot[base + j] ?? 0) * (v[j] ?? 0);
    scratch[i] = s;
  }
  let x = 0;
  let y = 0;
  let z = 0;
  for (let j = 0; j < 8; j++) {
    const s = scratch[j] ?? 0;
    x += (proj[j] ?? 0) * s;
    y += (proj[8 + j] ?? 0) * s;
    z += (proj[16 + j] ?? 0) * s;
  }
  return { x, y, z };
}

// ── counted operations, so the estimate is separable from the timing ────────

/**
 * Multiply-and-add counts per vertex, counted from the source above by hand and asserted by
 * a test that re-counts them from a traced execution.
 *
 * Counted, not timed — a count is a property of the algorithm and survives the machine,
 * which is exactly why it is reported next to the timings rather than instead of them.
 */
export interface OpCount {
  readonly mul: number;
  readonly add: number;
  readonly total: number;
}

/** Ops per vertex for each transform path. */
export const OPS_PER_VERTEX: Readonly<Record<string, OpCount>> = {
  /** 8x8 matrix (64 mul, 56 add) then 3x8 projection (24 mul, 21 add). */
  eightDThenProject: { mul: 88, add: 77, total: 165 },
  /** Affine 3x4: 9 mul, 9 add. */
  mat4Affine: { mul: 9, add: 9, total: 18 },
  /** Quaternion two-cross-product form plus a vector add. */
  quatTranslate: { mul: 15, add: 15, total: 30 },
  /**
   * PGA motor, per vertex, AFTER the once-per-motor decomposition — identical to the
   * quaternion row, and identical because the two are the same computation, not because the
   * benchmark was tuned until they matched. See `DecomposedMotor`.
   */
  pgaMotorDecomposed: { mul: 15, add: 15, total: 30 },
  /**
   * PGA motor applied through the general 16x16 geometric product, twice, with no
   * specialisation. Reported because it is what a naive GA library call costs and it is the
   * number people quote when they say GA is slow. Counted from `gp`'s own loop bounds on the
   * sparsity this case actually has, not from 16^2.
   */
  pgaMotorNaive: { mul: 96, add: 96, total: 192 },
};

// ── exactness ───────────────────────────────────────────────────────────────

/** An exact multivector over the integers. Used only to answer the exactness question. */
export type MvZ = readonly bigint[];

/** Zero, exactly. */
export function zeroZ(): bigint[] {
  return new Array<bigint>(BLADE_COUNT).fill(0n);
}

/**
 * Geometric product over `bigint`. Same table, same signs, no floating point anywhere.
 *
 * The point of having this at all: it decides, by running rather than by argument, whether a
 * PGA rigid motion built from integer planes stays in the integers. It does — see the test —
 * because nothing in the product divides and nothing takes a root. Normalisation is what
 * introduces a square root into a rotor, and a projective algebra does not need to normalise.
 */
export function gpZ(x: MvZ, y: MvZ): bigint[] {
  const out = zeroZ();
  for (let a = 0; a < BLADE_COUNT; a++) {
    const xa = x[a] ?? 0n;
    if (xa === 0n) continue;
    const row = PRODUCT_TABLE[a];
    if (row === undefined) continue;
    for (let b = 0; b < BLADE_COUNT; b++) {
      const yb = y[b] ?? 0n;
      if (yb === 0n) continue;
      const e = row[b];
      if (e === undefined || e.sign === 0) continue;
      out[e.mask] = (out[e.mask] ?? 0n) + BigInt(e.sign) * xa * yb;
    }
  }
  return out;
}

/** Reverse over `bigint`. */
export function reverseZ(x: MvZ): bigint[] {
  const out = zeroZ();
  for (let m = 0; m < BLADE_COUNT; m++) {
    const g = grade(m);
    out[m] = (((g * (g - 1)) / 2) & 1) === 0 ? (x[m] ?? 0n) : -(x[m] ?? 0n);
  }
  return out;
}

/** An integer plane. */
export function planeZ(a: bigint, b: bigint, c: bigint, d: bigint): bigint[] {
  const p = zeroZ();
  p[E1] = a;
  p[E2] = b;
  p[E3] = c;
  p[E0] = d;
  return p;
}

/** An integer-coordinate point (weight 1). */
export function pointZ(x: bigint, y: bigint, z: bigint): bigint[] {
  const p = zeroZ();
  p[E123] = 1n;
  p[E023] = -x;
  p[E013] = y;
  p[E012] = -z;
  return p;
}

/** Sandwich over `bigint`. */
export function sandwichZ(m: MvZ, x: MvZ): bigint[] {
  return gpZ(gpZ(m, x), reverseZ(m));
}

/** Largest absolute coefficient, as a bit length — the growth measure for exact composition. */
export function maxBitLength(x: MvZ): number {
  let best = 0;
  for (const c of x) {
    const a = c < 0n ? -c : c;
    const b = a.toString(2).length;
    if (a !== 0n && b > best) best = b;
  }
  return best;
}
