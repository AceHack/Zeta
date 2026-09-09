import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { e8Roots, gossetEdges } from "./clifford-e8-coxeter-projection.ts";
import { reflect } from "./clifford-e8-eigenlayer-tessellation.ts";
import { faceBivector, faceNormals3d, triangleFaces, type Face } from "./clifford-e8-face-lattice.ts";
import {
  applyVersorExact,
  bivectorMultivector,
  bladeGrade,
  compareCosines,
  contractVectorBivector,
  cosineSquared,
  cosineToNumber,
  edgeFaceIncidence,
  EDGE_FACE_INCIDENCE,
  FACE_NORMAL_NORM_SQUARED,
  faceNormal8d,
  geometricProduct,
  gradesPresent,
  intensityHistogram,
  isOrientationDetermined,
  LAMBERT_DENOMINATOR_SQUARED,
  lambertCosine,
  lightFromRootIndex,
  mirrorInFacePlane,
  multivectorVector,
  planeIllumination,
  projectedNormalIsTripleCentroid,
  reflectInHyperplane,
  reflectRootExact,
  renderLitObj,
  reorderSign,
  reverse,
  rotorFromRoots,
  shadeFaces,
  specularCosine,
  TRIVECTOR_INDICES,
  vectorMultivector,
  wedgeVectorBivector,
} from "./clifford-e8-shading.ts";

const ROOTS = e8Roots();
const FACES = triangleFaces(ROOTS);
const LIGHT = lightFromRootIndex(0, ROOTS);

const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, k) => s + x * (b[k] ?? 0), 0);
const key = (f: Face): number => (f[0] * 256 + f[1]) * 256 + f[2];

/**
 * The measured Lambert numerator census under a root light. Nine values in steps of 4, and
 * the distribution is symmetric because roots come in +- pairs. Counted by this module.
 */
const MEASURED_LAMBERT_CENSUS: ReadonlyArray<readonly [number, number]> = [
  [-16, 756],
  [-12, 4032],
  [-8, 7560],
  [-4, 12096],
  [0, 11592],
  [4, 12096],
  [8, 7560],
  [12, 4032],
  [16, 756],
];

/** The measured two-sided census: five brightness levels, which is what `renderLitObj` emits. */
const MEASURED_TWO_SIDED_CENSUS: ReadonlyArray<readonly [number, number]> = [
  [0, 11592],
  [4, 24192],
  [8, 15120],
  [12, 8064],
  [16, 1512],
];

/** Faces whose 3D plane contains the origin. Rung 5's number, re-measured here, not copied. */
const MEASURED_3D_UNDETERMINED = 768;

describe("rung 6 — shading derived from the Clifford substrate", () => {
  // ── FALSIFIER 1: THE ALGEBRA IS GENERATED, AND IT IS A CLIFFORD ALGEBRA ──
  //
  // No multiplication table. If the generated sign rule is wrong, e_i e_i = 1 fails, the
  // algebra is not associative, and every sandwich below is meaningless.
  it("generates Cl(8,0): generators square to +1, anticommute, and the product associates", () => {
    for (let i = 0; i < 8; i++) {
      const e = vectorMultivector(Array.from({ length: 8 }, (_, k) => (k === i ? 1 : 0)));
      const square = geometricProduct(e, e);
      expect(square[0]).toBe(1);
      expect(gradesPresent(square)).toEqual([0]);
    }
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        expect(reorderSign(1 << i, 1 << j)).toBe(1);
        expect(reorderSign(1 << j, 1 << i)).toBe(-1);
      }
    // Associativity on a triple drawn from the actual objects this rung multiplies.
    const a = vectorMultivector(ROOTS[3] ?? []);
    const b = bivectorMultivector(faceBivector(ROOTS[0] ?? [], ROOTS[1] ?? [], ROOTS[2] ?? []));
    const c = vectorMultivector(ROOTS[11] ?? []);
    expect(geometricProduct(geometricProduct(a, b), c)).toEqual(geometricProduct(a, geometricProduct(b, c)));
    // Grade counting is the blade's subset size, and the reversion sign follows from it.
    expect(bladeGrade(0)).toBe(0);
    expect(bladeGrade(0b10110)).toBe(3);
    expect(reverse(b)).toEqual(b.map((x) => (x === 0 ? 0 : -x)));
  });

  // ── FALSIFIER 2: THE VERSOR SANDWICH IS A REFLECTION ──────────────────────
  //
  // `-a v a / |a|^2` must be an involution and must agree with the classical vector formula
  // that rung 3 already ships. Two mechanisms; a bug in either is visible as disagreement.
  it("reflects by the GA sandwich, involutively, and agrees with rung 3's vector formula", () => {
    let checked = 0;
    for (let ai = 0; ai < 240; ai += 17) {
      const axis = ROOTS[ai] ?? [];
      for (let vi = 0; vi < 240; vi += 13) {
        const v = ROOTS[vi] ?? [];
        const image = reflectRootExact(v, axis);
        // Independent mechanism: rung 3's `reflect` is the classical `v - 2<v,a>a/<a,a>`.
        expect(image).toEqual(reflect(v, axis).map((x) => (x === 0 ? 0 : x)));
        // Involution, exactly.
        expect(reflectRootExact(image, axis)).toEqual([...v]);
        // A reflection of a root in a root is a root: the Weyl group acts on the root set.
        expect(dot(image, image)).toBe(8);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
    // The un-normalised form carries its denominator honestly rather than rounding.
    const raw = reflectInHyperplane(ROOTS[0] ?? [], ROOTS[5] ?? []);
    expect(raw.denominator).toBe(8);
    // And it refuses rather than rounds when the exact form is not integral: e1 reflected in
    // the all-ones root lands on quarters. A defensive throw nothing reaches is not a guard.
    expect(() => reflectRootExact([1, 0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1, 1])).toThrow(/not integral/);
  });

  // ── FALSIFIER 3: THE ROTOR PRESERVES THE QUADRATIC FORM, EXACTLY ──────────
  it("rotates by R v R~ preserving norms exactly, and permutes the 240 roots", () => {
    const rotor = rotorFromRoots(ROOTS[3] ?? [], ROOTS[11] ?? []);
    expect(rotor.normSquared).toBe(64);
    expect(gradesPresent(rotor.versor).every((g) => g % 2 === 0)).toBe(true);
    const images = ROOTS.map((r) => applyVersorExact(rotor, r));
    for (let i = 0; i < ROOTS.length; i++) {
      expect(dot(images[i] ?? [], images[i] ?? [])).toBe(dot(ROOTS[i] ?? [], ROOTS[i] ?? []));
    }
    // A permutation of the root set: 240 distinct images, all of them roots.
    const rootKeys = new Set(ROOTS.map((r) => r.join(",")));
    const imageKeys = new Set(images.map((r) => r.join(",")));
    expect(imageKeys.size).toBe(240);
    for (const k of imageKeys) expect(rootKeys.has(k)).toBe(true);
    // It is not the identity — a rotor that moved nothing would pass everything above.
    expect(images.filter((img, i) => img.join(",") !== (ROOTS[i] ?? []).join(",")).length).toBeGreaterThan(0);
    // The exact form refuses a non-integral image rather than rounding it. A rotor built
    // from two half-integer-family roots sends e1 to eighths, which is the case that
    // exercises the guard instead of leaving it decorative.
    const halfInteger = rotorFromRoots(ROOTS[130] ?? [], ROOTS[190] ?? []);
    expect(() => applyVersorExact(halfInteger, [1, 0, 0, 0, 0, 0, 0, 0])).toThrow(/not integral/);
    // It still permutes the roots, so the refusal above is about the input, not the rotor.
    expect(new Set(ROOTS.map((r) => applyVersorExact(halfInteger, r).join(","))).size).toBe(240);
  });

  // ── FALSIFIER 4: THE NORMAL IS DERIVED, AND IT NEVER DEGENERATES ──────────
  //
  // The claim is an exact integer identity on all 60,480 faces: `a + b + c` is orthogonal to
  // both edge vectors and has squared norm 48. Rung 5's 3D gauge failed on 768 faces; this
  // one fails on none, and the zero is asserted rather than hoped for.
  it("derives an exactly-orthogonal, never-degenerate normal for every face", () => {
    expect(FACES.length).toBe(60480);
    let undetermined = 0;
    const norms = new Set<number>();
    for (const face of FACES) {
      const a = ROOTS[face[0]] ?? [];
      const b = ROOTS[face[1]] ?? [];
      const c = ROOTS[face[2]] ?? [];
      const n = faceNormal8d(face, ROOTS);
      const u = b.map((x, k) => x - (a[k] ?? 0));
      const v = c.map((x, k) => x - (a[k] ?? 0));
      expect(dot(n, u)).toBe(0);
      expect(dot(n, v)).toBe(0);
      norms.add(dot(n, n));
      if (!isOrientationDetermined(n)) undetermined++;
    }
    expect([...norms]).toEqual([FACE_NORMAL_NORM_SQUARED]);
    expect(undetermined).toBe(0);
    // The predicate's false branch is unreachable from the derived face set BY THEOREM, so
    // it is exercised on a synthetic input instead. Without this it would be a check that
    // cannot fail, which is the defect rung 5 found in its own rank filter.
    expect(isOrientationDetermined([0, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(isOrientationDetermined([0, 0, 0, 1, 0, 0, 0, 0])).toBe(true);
  });

  // ── FALSIFIER 5: THE SHADING IS EXACT, AND POSTERISED BY CONSTRUCTION ─────
  it("shades every face with an exact integer numerator over sqrt(384)", () => {
    const shaded = shadeFaces(LIGHT, FACES, ROOTS);
    expect(shaded.length).toBe(60480);
    const census = new Map<number, number>();
    for (const s of shaded) {
      expect(Number.isInteger(s.lambert.numerator)).toBe(true);
      expect(s.lambert.denominatorSquared).toBe(LAMBERT_DENOMINATOR_SQUARED);
      expect(s.twoSided.numerator).toBe(Math.abs(s.lambert.numerator));
      census.set(s.lambert.numerator, (census.get(s.lambert.numerator) ?? 0) + 1);
    }
    expect([...census.entries()].sort((a, b) => a[0] - b[0])).toEqual(MEASURED_LAMBERT_CENSUS.map(([k, v]) => [k, v]));
    expect([...intensityHistogram(shaded).entries()]).toEqual(MEASURED_TWO_SIDED_CENSUS.map(([k, v]) => [k, v]));
    // Both branches of `lit` are exercised by the real data — a clamp nothing ever trips is
    // a check that cannot fail.
    expect(shaded.filter((s) => s.lit).length).toBe(60480 - 11592);
    expect(shaded.filter((s) => !s.lit).length).toBe(11592);
    // The brightest face is 16 / sqrt(384) = sqrt(2/3), never 1: no face faces a root.
    const brightest = Math.max(...shaded.map((s) => s.twoSided.numerator));
    expect(brightest).toBe(16);
    expect(cosineToNumber({ numerator: 16, denominatorSquared: 384 })).toBeCloseTo(Math.sqrt(2 / 3), 12);
    expect(cosineSquared({ numerator: 16, denominatorSquared: 384 })).toEqual({ numerator: 256, denominator: 384 });
  });

  // ── FALSIFIER 6: EXACT ORDERING WITHOUT A SQUARE ROOT ─────────────────────
  it("orders cosines exactly, agreeing with the float evaluation it never performs", () => {
    const samples = [-16, -12, -8, -4, 0, 4, 8, 12, 16].map((numerator) => ({
      numerator,
      denominatorSquared: LAMBERT_DENOMINATOR_SQUARED,
    }));
    for (const a of samples)
      for (const b of samples) {
        const exact = compareCosines(a, b);
        const float = Math.sign(cosineToNumber(a) - cosineToNumber(b));
        expect(exact).toBe(float);
      }
    // Different denominators is the case a naive numerator comparison gets wrong.
    const wide = { numerator: 4, denominatorSquared: 8 };
    const narrow = { numerator: 12, denominatorSquared: 384 };
    expect(compareCosines(wide, narrow)).toBe(Math.sign(cosineToNumber(wide) - cosineToNumber(narrow)));
    expect(compareCosines(narrow, wide)).toBe(-compareCosines(wide, narrow));
    // Negatives: the magnitude comparison has to invert on the negative side.
    const a = { numerator: -16, denominatorSquared: 384 };
    const b = { numerator: -4, denominatorSquared: 384 };
    expect(compareCosines(a, b)).toBe(-1);
  });

  // ── FALSIFIER 7: THE TWO SHADING QUANTITIES COHERE ────────────────────────
  //
  // `contractVectorBivector` and `wedgeVectorBivector` are specialised routines; the general
  // generated product is the second mechanism. Then the Pythagorean split and the
  // cross-quantity inequality tie the plane term to the Lambert term on every face.
  it("splits the light against each face plane, exactly, on all 60,480 faces", () => {
    // Two mechanisms for the split, on a sample: specialised vs the full geometric product.
    for (let i = 0; i < FACES.length; i += 4801) {
      const f = FACES[i] ?? ([0, 0, 0] as const);
      const bivector = faceBivector(ROOTS[f[0]] ?? [], ROOTS[f[1]] ?? [], ROOTS[f[2]] ?? []);
      const product = geometricProduct(vectorMultivector(LIGHT), bivectorMultivector(bivector));
      expect(multivectorVector(product)).toEqual(contractVectorBivector(LIGHT, bivector));
      const wedge = wedgeVectorBivector(LIGHT, bivector);
      const fromProduct = TRIVECTOR_INDICES.map(([p, q, r]) => product[(1 << p) | (1 << q) | (1 << r)] ?? 0);
      expect(wedge).toEqual(fromProduct.map((x) => (x === 0 ? 0 : x)));
    }
    // The whole surface: Pythagoras and the inequality, both exact integers.
    const planeCensus = new Map<number, number>();
    for (const face of FACES) {
      const bivector = faceBivector(ROOTS[face[0]] ?? [], ROOTS[face[1]] ?? [], ROOTS[face[2]] ?? []);
      const contraction = contractVectorBivector(LIGHT, bivector);
      const wedge = wedgeVectorBivector(LIGHT, bivector);
      const wedgeNorm = dot(wedge, wedge);
      expect(dot(contraction, contraction) + wedgeNorm).toBe(LAMBERT_DENOMINATOR_SQUARED);
      const lambert = lambertCosine(face, LIGHT, ROOTS).numerator;
      // <L,n>^2 <= |L ^ B|^2: the outward normal is one direction in a 6-dimensional
      // complement, so it can never account for more of the light than the whole rejection.
      expect(lambert * lambert).toBeLessThanOrEqual(wedgeNorm);
      const illumination = planeIllumination(face, LIGHT, ROOTS);
      expect(illumination.denominator).toBe(LAMBERT_DENOMINATOR_SQUARED);
      expect(illumination.numerator).toBe(wedgeNorm);
      planeCensus.set(wedgeNorm, (planeCensus.get(wedgeNorm) ?? 0) + 1);
    }
    // Measured: three values. The inequality above is not vacuous — 10,080 faces have a zero
    // Lambert term while the light is entirely out of their plane, which is the case that
    // proves the two quantities are genuinely different rather than one rescaled.
    expect([...planeCensus.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [0, 1512],
      [256, 40824],
      [384, 18144],
    ]);
  });

  // ── FALSIFIER 8: THE MIRROR IS AN INVOLUTION AND KEEPS THE PLANE FIXED ────
  it("mirrors the light in a face plane, involutively, with the derived sign", () => {
    for (let i = 0; i < FACES.length; i += 6047) {
      const f = FACES[i] ?? ([0, 0, 0] as const);
      const a = ROOTS[f[0]] ?? [];
      const b = ROOTS[f[1]] ?? [];
      const c = ROOTS[f[2]] ?? [];
      const bivector = faceBivector(a, b, c);
      const mirror = mirrorInFacePlane(LIGHT, bivector);
      expect(mirror.denominator).toBe(48);
      // Norm preserved exactly: |m|^2 = |L|^2 * |B|^4.
      expect(dot(mirror.components, mirror.components)).toBe(dot(LIGHT, LIGHT) * 48 * 48);
      // Involution: mirroring the (scaled) image again returns the (scaled) original.
      const again = mirrorInFacePlane(mirror.components, bivector);
      expect(again.components).toEqual(LIGHT.map((x) => x * 48 * 48));
      // The derived sign: the mirror keeps the in-plane part and flips the rest, so
      // `mirror + L = 2 * L_parallel`, which must lie in the face's plane — i.e. its wedge
      // with the bivector vanishes.
      const twiceParallel = mirror.components.map((x, k) => x + 48 * (LIGHT[k] ?? 0));
      expect(wedgeVectorBivector(twiceParallel, bivector).every((x) => x === 0)).toBe(true);
    }
    // The specular term is EXACTLY RATIONAL, unlike the Lambert term: both operands are
    // roots, so their norms multiply to a rational.
    const face = FACES[0] ?? ([0, 0, 0] as const);
    const view = lightFromRootIndex(50, ROOTS);
    const spec = specularCosine(face, LIGHT, view, ROOTS);
    expect(Number.isInteger(spec.numerator)).toBe(true);
    expect(spec.denominator).toBe(LAMBERT_DENOMINATOR_SQUARED);
    expect(Math.abs(spec.numerator)).toBeLessThanOrEqual(spec.denominator);
    expect(() => specularCosine(face, LIGHT, [1, 0, 0, 0, 0, 0, 0, 0], ROOTS)).toThrow();
  });

  // ── FALSIFIER 9: THE LIGHT GAUGE IS DISCHARGED, NOT ASSERTED ──────────────
  //
  // Which root is the light is a choice. The Weyl group is transitive on roots, so the claim
  // is that the choice cannot change the picture's statistics — measured across three roots
  // from both construction families, and per-face under an explicit rotor.
  it("gives the same intensity census for every choice of light root", () => {
    const reference = intensityHistogram(shadeFaces(LIGHT, FACES, ROOTS));
    for (const index of [1, 137, 200, 239]) {
      const other = intensityHistogram(shadeFaces(lightFromRootIndex(index, ROOTS), FACES, ROOTS));
      expect([...other.entries()]).toEqual([...reference.entries()]);
    }
    // Per-face rotor equivariance: rotate the light AND the face, get the same value.
    const rotor = rotorFromRoots(ROOTS[3] ?? [], ROOTS[11] ?? []);
    const permutation = new Map(ROOTS.map((r, i) => [r.join(","), i]));
    const images = ROOTS.map((r) => permutation.get(applyVersorExact(rotor, r).join(",")) ?? -1);
    expect(images.every((i) => i >= 0)).toBe(true);
    const faceKeys = new Set(FACES.map(key));
    const rotatedLight = applyVersorExact(rotor, LIGHT);
    let moved = 0;
    let nonZero = 0;
    for (let i = 0; i < FACES.length; i += 601) {
      const face = FACES[i] ?? ([0, 0, 0] as const);
      const sorted = [images[face[0]] ?? 0, images[face[1]] ?? 0, images[face[2]] ?? 0].sort((a, b) => a - b);
      const image: Face = [sorted[0] ?? 0, sorted[1] ?? 0, sorted[2] ?? 0];
      // The rotor carries faces to faces — it is an automorphism of the derived face set.
      expect(faceKeys.has(key(image))).toBe(true);
      const value = lambertCosine(face, LIGHT, ROOTS);
      expect(lambertCosine(image, rotatedLight, ROOTS)).toEqual(value);
      if (key(image) !== key(face)) moved++;
      if (value.numerator !== 0) nonZero++;
    }
    // Equivariance under a rotor that moves nothing, or over a cosine that is always zero,
    // would both be vacuous. Both are excluded by measurement.
    expect(moved).toBeGreaterThan(0);
    expect(nonZero).toBeGreaterThan(0);
  });

  // ── FALSIFIER 10: THE TOPOLOGY THAT FORCES TWO-SIDED SHADING ──────────────
  //
  // Rung 5 said in prose that the surface is not a closed manifold. This is the number: a
  // manifold edge carries 2 faces, and every edge here carries 27.
  it("measures 27 faces on every edge, which is what forces the two-sided convention", () => {
    const incidence = edgeFaceIncidence(FACES);
    // The ascending-face invariant the incidence key relies on, asserted rather than assumed.
    for (const [a, b, c] of FACES) {
      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(c);
    }
    expect(incidence.edges).toBe(gossetEdges(ROOTS).length);
    expect(incidence.edges).toBe(6720);
    expect(incidence.min).toBe(EDGE_FACE_INCIDENCE);
    expect(incidence.max).toBe(EDGE_FACE_INCIDENCE);
    expect(EDGE_FACE_INCIDENCE).not.toBe(2);
    // Derived, not tabulated: 3 * f2 = 27 * f1.
    expect(3 * FACES.length).toBe(EDGE_FACE_INCIDENCE * incidence.edges);
  });

  // ── FALSIFIER 11: RUNG 5's 768, HANDLED RATHER THAN INHERITED ─────────────
  //
  // The negative result is the point: importing the 8D orientation into 3D cannot repair the
  // 768, because the projection of `a + b + c` IS three times the projected centroid, so it
  // is the same test. The handling is that the shading never enters 3D at all.
  it("shades the 768 origin-plane faces exactly, and shows why 3D cannot repair them", () => {
    const undetermined = faceNormals3d(FACES, ROOTS).filter((n) => n.orientationUndetermined);
    expect(undetermined.length).toBe(MEASURED_3D_UNDETERMINED);
    // The identity that makes the 3D repair circular. Float, because the projection is.
    const linearity = projectedNormalIsTripleCentroid(FACES, ROOTS);
    expect(linearity.checked).toBe(60480);
    expect(linearity.maxResidual).toBeLessThan(1e-9);
    // And the handling: every one of those 768 faces gets a defined, finite, exact intensity.
    for (const n of undetermined) {
      const normal = faceNormal8d(n.face, ROOTS);
      expect(isOrientationDetermined(normal)).toBe(true);
      expect(dot(normal, normal)).toBe(FACE_NORMAL_NORM_SQUARED);
      const cosine = lambertCosine(n.face, LIGHT, ROOTS);
      expect(Number.isInteger(cosine.numerator)).toBe(true);
      expect(Number.isNaN(cosineToNumber(cosine))).toBe(false);
      expect(Number.isFinite(cosineToNumber(cosine))).toBe(true);
    }
  });

  // ── FALSIFIER 12: THE DEPTH CONVENTION IS ORDER-INDEPENDENT ───────────────
  //
  // The stated convention is that a face's value depends on nothing but the face and the
  // light. A deterministic permutation is the check; if any hidden order-dependence crept
  // in — a running accumulator, a neighbour lookup — the per-face values would move.
  it("shades order-independently, which is the whole depth convention", () => {
    const straight = shadeFaces(LIGHT, FACES, ROOTS);
    const order = FACES.map((_, i) => i).sort((a, b) => ((a * 7919 + 13) % 60480) - ((b * 7919 + 13) % 60480));
    const permuted = shadeFaces(
      LIGHT,
      order.map((i) => FACES[i] ?? ([0, 0, 0] as const)),
      ROOTS,
    );
    expect(order[0]).not.toBe(0);
    for (let p = 0; p < permuted.length; p += 97) {
      const original = straight[order[p] ?? 0];
      expect(permuted[p]?.lambert).toEqual(original?.lambert);
      expect(permuted[p]?.planeIllumination).toEqual(original?.planeIllumination);
      expect(permuted[p]?.normal).toEqual(original?.normal ?? []);
    }
  });

  // ── FALSIFIER 13: THE ARTEFACT, AND ITS FIVE DERIVED MATERIALS ────────────
  it("emits an OBJ whose material count is the shading's own level count", () => {
    const { obj, mtl } = renderLitObj(LIGHT, ROOTS);
    const lines = obj.split("\n");
    expect(lines.filter((l) => l.startsWith("v ")).length).toBe(240);
    expect(lines.filter((l) => l.startsWith("f ")).length).toBe(60480);
    const groups = lines.filter((l) => l.startsWith("usemtl "));
    expect(groups.length).toBe(MEASURED_TWO_SIDED_CENSUS.length);
    expect(mtl.split("\n").filter((l) => l.startsWith("newmtl ")).length).toBe(MEASURED_TWO_SIDED_CENSUS.length);
    // Each group holds exactly the faces the census counted at that level.
    let current = "";
    const counts = new Map<string, number>();
    for (const line of lines) {
      if (line.startsWith("usemtl ")) current = line.slice(7);
      else if (line.startsWith("f ")) counts.set(current, (counts.get(current) ?? 0) + 1);
    }
    for (const [level, count] of MEASURED_TWO_SIDED_CENSUS) expect(counts.get(`lambert_${level}`)).toBe(count);
    // The header states what it is not, because a reader will otherwise assume a solid.
    expect(obj).toContain("NOT a closed manifold");
    expect(obj).toContain(`every edge carries ${EDGE_FACE_INCIDENCE} faces`);
    // The MTL carries the exact form beside the float, so the boundary is visible in the file.
    expect(mtl).toContain("# exact: 16 / sqrt(384)");
  });

  // ── FALSIFIER 14: THE IRRATIONAL BOUNDARY IS ONE CALL SITE ────────────────
  //
  // Comments and string literals are stripped and the CALL form is matched, because prose
  // about confining a square root has satisfied guards of this shape before.
  it("evaluates exactly one square root, inside the function that names itself the boundary", () => {
    const path = new URL("./clifford-e8-shading.ts", import.meta.url).pathname;
    const source = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""');
    const sites = [...source.matchAll(/Math\.sqrt\(/g)];
    expect(sites.length).toBe(1);
    const start = source.indexOf("export function cosineToNumber");
    expect(start).toBeGreaterThan(0);
    const end = source.indexOf("\nexport ", start + 1);
    expect(end).toBeGreaterThan(start);
    expect(sites[0]?.index ?? -1).toBeGreaterThan(start);
    expect(sites[0]?.index ?? Number.MAX_SAFE_INTEGER).toBeLessThan(end);
    // No other irrational-producing call reaches the shading path.
    expect(source).not.toContain("Math.hypot(");
    expect(source).not.toContain("Math.cbrt(");
    expect(source).not.toContain("Math.acos(");
    expect(source).not.toContain("Math.pow(");
    // Control: the stripper must not have eaten the file, and must not have eaten the
    // comparison that exists precisely so the sqrt is avoidable.
    expect(source).toContain("export function compareCosines");
    expect(source).toContain("geometricProduct(");
    expect(source.length).toBeGreaterThan(4000);
  });

  // ── FALSIFIER 15: NONINTERFERENCE (§13) AND DST (§7) ──────────────────────
  it("reaches for no ambient entropy and replays identically", () => {
    const path = new URL("./clifford-e8-shading.ts", import.meta.url).pathname;
    const source = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("new Date(");
    expect(source).not.toContain("performance.now(");
    expect(source).not.toContain("process.env");
    expect(source).toContain("export function shadeFaces");
    const first = shadeFaces(LIGHT, FACES.slice(0, 400), ROOTS);
    expect(shadeFaces(LIGHT, FACES.slice(0, 400), ROOTS)).toEqual(first);
    expect(renderLitObj(LIGHT, ROOTS).obj).toBe(renderLitObj(LIGHT, ROOTS).obj);
  });
});
