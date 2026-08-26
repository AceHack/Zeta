/**
 * Falsifiers for Q4, the conformal embedding, and the curvature budget (2026-08-26).
 *
 * Each block pins a claim from
 * `docs/research/2026-08-26-cga-is-m2-of-the-in-tree-clifford-q4-answered-*.md` against
 * something known in closed form, so a transcription error goes RED rather than producing a
 * plausible number.
 *
 * The load-bearing ones are the negative controls: `Cl(8,0)` must NOT match `Cl(4,1)`'s
 * class, hexagons-only must NOT close, and the cube's edge count must NOT equal the
 * curvature budget for any other solid. Without those, every test here would pass on a
 * table that said "everything is M_1(R)".
 */

import { expect, it } from "bun:test";
import {
  ALPHA_STAR,
  LP_RATE,
  type CliffordType,
  CL30_ONE,
  type Cl30,
  TOWER_REDUCTION,
  classify,
  classifyDegenerate,
  conformalDot,
  curvatureBudget,
  dimensionOfType,
  edgeCount,
  embedPoint,
  geometricProduct,
  isZero,
  evenSubalgebraClass,
  lcg,
  lpRateAgreesWithExponent,
  realDimension,
  showType,
  signatureClass,
  squaredDistance,
  trivalentEulerCharacteristic,
} from "./conformal-embedding-and-curvature-budget.ts";

// ===== THE CLOCK ========================================================================

it("normalises p-q into 0..7 even when q > p (the `+ 8` is load-bearing)", () => {
  // JS `%` is remainder: (1-3) % 8 === -2. An unnormalised value indexes the wrong row.
  expect(signatureClass(1, 3)).toBe(6);
  expect(signatureClass(3, 1)).toBe(2);
  expect(signatureClass(0, 8)).toBe(0);
  for (let p = 0; p <= 20; p += 1) {
    for (let q = 0; q <= 20; q += 1) {
      const s = signatureClass(p, q);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(8);
    }
  }
});

it("reconstructs 2^(p+q) from the Morita type for every signature -- the table's own meter", () => {
  // This is the invariant `CliffordPeriodicity.fs` uses. The per-row exponents cannot be
  // permuted without it going red, which is what makes the transcription trustworthy.
  const failures: string[] = [];
  for (let p = 0; p <= 12; p += 1) {
    for (let q = 0; q <= 12; q += 1) {
      if (dimensionOfType(classify(p, q)) !== realDimension(p, q)) failures.push(`Cl(${p},${q})`);
    }
  }
  expect(failures).toEqual([]);
});

it("reproduces the four independently-known small algebras", () => {
  // The same four the F# test suite pins against -- known from the classification, not
  // from this table, so agreeing with them is evidence rather than restatement.
  expect(showType(classify(0, 1))).toBe("M_1(C)"); // Cl(0,1) ~= C
  expect(showType(classify(0, 2))).toBe("M_1(H)"); // Cl(0,2) ~= H (quaternions)
  expect(showType(classify(1, 3))).toBe("M_2(H)"); // spacetime algebra, one convention
  expect(showType(classify(3, 1))).toBe("M_4(R)"); // ... and the other
});

it("REFUSES a negative signature rather than wrapping it", () => {
  expect(() => classify(-1, 0)).toThrow(RangeError);
});

// ===== Q4: THE SUSPENSION ISOMORPHISM ===================================================

it("Cl(p+1,q+1) ~= M_2(Cl(p,q)) -- same ground, same split, double the matrix dim", () => {
  const failures: string[] = [];
  for (let p = 0; p <= 10; p += 1) {
    for (let q = 0; q <= 10; q += 1) {
      const a: CliffordType = classify(p, q);
      const b: CliffordType = classify(p + 1, q + 1);
      if (a.ground !== b.ground || a.isSplit !== b.isSplit || b.matrixDim !== 2 * a.matrixDim) {
        failures.push(`Cl(${p},${q}) -> Cl(${p + 1},${q + 1})`);
      }
    }
  }
  expect(failures).toEqual([]);
});

it("Q4: CGA(3D) = Cl(4,1) is M_2 of the in-tree Cl(3,0), not a distinct algebra", () => {
  const cga = classify(4, 1);
  const inTree = classify(3, 0);

  // Same clock position, same ground field, neither split.
  expect(signatureClass(4, 1)).toBe(3);
  expect(signatureClass(3, 0)).toBe(3);
  expect(cga.ground).toBe(inTree.ground);
  expect(cga.isSplit).toBe(inTree.isSplit);

  // And exactly one suspension step apart.
  expect(cga.matrixDim).toBe(2 * inTree.matrixDim);
  expect(showType(cga)).toBe("M_4(C)");
  expect(showType(inTree)).toBe("M_2(C)");
  expect(dimensionOfType(cga)).toBe(32);
  expect(dimensionOfType(inTree)).toBe(8);
  expect(dimensionOfType(cga)).toBe(4 * dimensionOfType(inTree)); // M_2 over it
});

it("NEGATIVE CONTROL: Cl(8,0) is a DIFFERENT class -- the clock discriminates", () => {
  // Without this, a table that returned one constant type would pass every test above.
  const e8 = classify(8, 0);
  expect(signatureClass(8, 0)).toBe(0);
  expect(e8.ground).toBe("R");
  expect(e8.ground).not.toBe(classify(4, 1).ground);
  expect(showType(e8)).toBe("M_16(R)");
});

it("the CGA ROTOR path does NOT inherit: Cl^0(4,1) is quaternionic where Cl(3,0) is complex", () => {
  // Cl^0(p,q) ~= Cl(p, q-1), so Cl^0(4,1) ~= Cl(4,0) -- clock position 4, ground H.
  expect(evenSubalgebraClass(4, 1)).toBe(4);
  expect(classify(4, 0).ground).toBe("H");
  expect(classify(3, 0).ground).toBe("C");
  // This is the one genuine cost in the Q4 answer: new rotor arithmetic, not a reuse.
  expect(classify(4, 0).ground).not.toBe(classify(3, 0).ground);
  expect(showType(classify(4, 0))).toBe("M_2(H)");
});

it("REFUSES an even subalgebra at q = 0 rather than wrapping to s = 7", () => {
  expect(evenSubalgebraClass(3, 0)).toBeNull();
});

// ===== THE CONFORMAL EMBEDDING ==========================================================

it("P(x).P(y) = -1/2 |x-y|^2 in every dimension from 1 to 256", () => {
  // The identity that makes "spatial reasoning generalises to n dimensions over any
  // distance metric" a property of the construction rather than an aspiration.
  const next = lcg(4); // COMMON_SEED -- deterministic, replayable (discipline #4)
  let worst = 0;
  for (const n of [1, 2, 3, 4, 8, 16, 24, 64, 256]) {
    for (let trial = 0; trial < 50; trial += 1) {
      const x = Array.from({ length: n }, next);
      const y = Array.from({ length: n }, next);
      const lhs = conformalDot(embedPoint(x), embedPoint(y));
      const rhs = -0.5 * squaredDistance(x, y);
      worst = Math.max(worst, Math.abs(lhs - rhs) / Math.max(1, Math.abs(rhs)));
    }
  }
  expect(worst).toBeLessThan(1e-12);
});

it("embedded points lie on the null cone: P(x).P(x) = 0 exactly", () => {
  const next = lcg(4);
  for (const n of [1, 3, 8, 24, 64]) {
    for (let trial = 0; trial < 50; trial += 1) {
      const p = embedPoint(Array.from({ length: n }, next));
      expect(Math.abs(conformalDot(p, p))).toBeLessThan(1e-9);
    }
  }
});

it("NEGATIVE CONTROL: dropping the 1/2|x|^2 term breaks the identity", () => {
  // Pins that the embedding's specific shape is what produces the distance, so a
  // mis-transcribed coefficient cannot pass as correct.
  const x = [1, 2, 3];
  const y = [4, 5, 6];
  const wrong = { x, a: 1, b: 0 } as const; // no ninf component
  const right = embedPoint(y);
  expect(conformalDot(wrong, right)).not.toBeCloseTo(-0.5 * squaredDistance(x, y), 6);
});

it("REFUSES a dimension mismatch rather than silently truncating", () => {
  expect(() => conformalDot(embedPoint([1, 2]), embedPoint([1, 2, 3]))).toThrow(RangeError);
  expect(() => squaredDistance([1], [1, 2])).toThrow(RangeError);
});

// ===== THE CURVATURE BUDGET =============================================================

const SOLIDS: [string, Record<number, number>][] = [
  ["tetrahedron", { 3: 4 }],
  ["cube (hexahedron)", { 4: 6 }],
  ["dodecahedron", { 5: 12 }],
  ["truncated tetrahedron", { 3: 4, 6: 4 }],
  ["truncated octahedron", { 4: 6, 6: 8 }],
  ["truncated icosahedron (C60)", { 5: 12, 6: 20 }],
  ["C70 fullerene", { 5: 12, 6: 25 }],
  ["C240 fullerene", { 5: 12, 6: 110 }],
];

it("every closed trivalent solid pays a curvature budget of exactly 12", () => {
  for (const [name, faces] of SOLIDS) {
    expect(`${name}: ${curvatureBudget(faces)}`).toBe(`${name}: 12`);
    expect(`${name}: chi=${trivalentEulerCharacteristic(faces)}`).toBe(`${name}: chi=2`);
  }
});

it("NEGATIVE CONTROL: hexagons alone pay 0 and close into a TORUS, at any count", () => {
  // The result the reservoir-walls thread turns on. If this ever passed as a sphere, the
  // budget arithmetic would be meaningless.
  for (const h of [20, 100, 1000, 100000]) {
    expect(curvatureBudget({ 6: h })).toBe(0);
    expect(trivalentEulerCharacteristic({ 6: h })).toBe(0); // chi = 0 is a torus
  }
});

it("the cube and the buckyball are the SAME closure, differently financed", () => {
  // 6 squares x (6-4)=2 == 12 pentagons x (6-5)=1. This is what dissolves the apparent
  // conflict between HexCore's hexahedron and Aaron's buckyball.
  expect(curvatureBudget({ 4: 6 })).toBe(curvatureBudget({ 5: 12, 6: 20 }));
  expect(curvatureBudget({ 3: 4 })).toBe(curvatureBudget({ 4: 6 }));
});

it("COINCIDENCE, NOT IDENTIFICATION: edges == budget at the cube and nowhere else", () => {
  // `.claude/rules/numerology-vs-number-theory.md` -- HexCore.fs has 12 edges and the
  // budget is 12. The check that keeps that a coincidence rather than a belief.
  expect(edgeCount({ 4: 6 })).toBe(curvatureBudget({ 4: 6 })); // the cube: EQUAL
  const elsewhere = SOLIDS.filter(([n]) => n !== "cube (hexahedron)").map(
    ([n, f]) => `${n}: ${edgeCount(f) === curvatureBudget(f)}`,
  );
  expect(elsewhere).toEqual([
    "tetrahedron: false",
    "dodecahedron: false",
    "truncated tetrahedron: false",
    "truncated octahedron: false",
    "truncated icosahedron (C60): false",
    "C70 fullerene: false",
    "C240 fullerene: false",
  ]);
});

// ===== THE SPHERE-PACKING CONSTANTS =====================================================

it("alpha* and the LP rate are the SAME statement: 2^(-alpha*) == sqrt(e/2pi)", () => {
  expect(lpRateAgreesWithExponent()).toBe(0);
  expect(ALPHA_STAR).toBeCloseTo(0.604401, 6);
  expect(LP_RATE).toBeCloseTo(0.657745, 6);
});

it("alpha* exceeds the Kabatianskii-Levenshtein 1978 exponent -- but barely", () => {
  const KL_1978 = 0.599; // cited from standing knowledge, not page-checked
  expect(ALPHA_STAR).toBeGreaterThan(KL_1978);
  // The honest size of the improvement: half a percent of the exponent. Anyone reading
  // this as a large gain is reading it wrong.
  expect(ALPHA_STAR - KL_1978).toBeLessThan(0.01);
  // And it is invisible below d ~ 100: the bound tightens by under 1.5x at d = 64.
  expect(2 ** ((ALPHA_STAR - KL_1978) * 64)).toBeLessThan(1.5);
});

// ===== CROSS-ORACLE: the transcription vs the F# authority ==============================

it("CROSS-ORACLE: agrees with Zeta.Core.CliffordPeriodicity on every row, ND and DG", async () => {
  // The strongest available check on the transcription: the golden vector is emitted BY THE
  // F# MODULE (`testdata/dump-clifford-grid.fsx`), never by this TypeScript, so agreement is
  // evidence rather than self-consistency. Text, not binary -- no-binary-in-proof-lineage.
  //
  // Two row kinds. `ND` pins the ABS clock; `DG` pins `classifyDegenerate`, which exists
  // because the clock is INAPPLICABLE to a degenerate signature rather than merely
  // unimplemented. Both must agree or the two implementations have drifted.
  const text = await Bun.file(
    new URL("./testdata/clifford-periodicity-grid.golden.txt", import.meta.url),
  ).text();
  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));

  const nd = rows.filter((r) => r.startsWith("ND "));
  const dg = rows.filter((r) => r.startsWith("DG "));
  // If the golden file were empty, truncated, or lost a whole section, every assertion below
  // would vacuously pass. Pin both counts first.
  expect(nd.length).toBe(169);
  expect(dg.length).toBe(245);
  expect(nd.length + dg.length).toBe(rows.length); // no unrecognised row kind slipped in

  const divergences: string[] = [];

  for (const row of nd) {
    const [, p, q, s, ground, dim, split] = row.split(/\s+/);
    const P = Number(p);
    const Q = Number(q);
    const t = classify(P, Q);
    const tsSplit = t.isSplit ? "True" : "False"; // F# `bool` prints capitalised
    if (
      String(signatureClass(P, Q)) !== s ||
      t.ground !== ground ||
      String(t.matrixDim) !== dim ||
      tsSplit !== split
    ) {
      divergences.push(
        `ND Cl(${p},${q}) F#: s=${s} ${ground} dim=${dim} split=${split} | ` +
          `TS: s=${signatureClass(P, Q)} ${t.ground} dim=${t.matrixDim} split=${tsSplit}`,
      );
    }
  }

  for (const row of dg) {
    const [, p, q, r, dim, radical, qGround, qDim, qSplit] = row.split(/\s+/);
    const d = classifyDegenerate(Number(p), Number(q), Number(r));
    const tsQSplit = d.semisimpleQuotient.isSplit ? "True" : "False";
    if (
      String(d.realDimension) !== dim ||
      String(d.radicalDimension) !== radical ||
      d.semisimpleQuotient.ground !== qGround ||
      String(d.semisimpleQuotient.matrixDim) !== qDim ||
      tsQSplit !== qSplit
    ) {
      divergences.push(
        `DG Cl(${p},${q},${r}) F#: dim=${dim} rad=${radical} ${qGround} qdim=${qDim} qsplit=${qSplit} | ` +
          `TS: dim=${d.realDimension} rad=${d.radicalDimension} ${d.semisimpleQuotient.ground} ` +
          `qdim=${d.semisimpleQuotient.matrixDim} qsplit=${tsQSplit}`,
      );
    }
  }

  expect(divergences).toEqual([]);

  // And the row the whole tower argument rests on is present, not merely consistent.
  expect(dg).toContain("DG 3 0 1 16 8 C 2 False"); // PGA(3D) — GATr's 16
});

// ===== DEGENERATE SIGNATURES: where the clock does not reach ============================

it("dim Cl(p,q,r) = 2^(p+q+r), and r=0 reduces to the non-degenerate case exactly", () => {
  for (let p = 0; p <= 6; p += 1) {
    for (let q = 0; q <= 6; q += 1) {
      for (let r = 0; r <= 4; r += 1) {
        const d = classifyDegenerate(p, q, r);
        expect(`Cl(${p},${q},${r}) dim`).toBe(`Cl(${p},${q},${r}) dim`);
        expect(d.realDimension).toBe(2 ** (p + q + r));
        // The radical is everything the semisimple quotient throws away.
        expect(d.realDimension - d.radicalDimension).toBe(2 ** (p + q));
        if (r === 0) {
          expect(d.radicalDimension).toBe(0);
          expect(d.isDegenerate).toBe(false);
          expect(d.semisimpleQuotient).toEqual(classify(p, q));
        } else {
          expect(d.isDegenerate).toBe(true);
          expect(d.radicalDimension).toBeGreaterThan(0);
        }
      }
    }
  }
});

it("PGA(3D) = Cl(3,0,1) is 16-dimensional — GATr's published multivector space", () => {
  // An EXTERNAL check on the structure theorem: Qualcomm's GATr states a 16-dimensional
  // projective geometric algebra. If Cl(p,q,r) ~= Cl(p,q) (x) Lambda(R^r) is right, then
  // dim = 8 * 2 = 16 and this number is predicted, not fitted.
  const pga = classifyDegenerate(3, 0, 1);
  expect(pga.realDimension).toBe(16);
  expect(pga.isDegenerate).toBe(true);
  // Half of it is nilpotent — which is exactly why the ABS clock cannot classify it.
  expect(pga.radicalDimension).toBe(8);
  expect(pga.realDimension - pga.radicalDimension).toBe(8); // = dim Cl(3,0)
});

it("ALL THREE towers reduce to the in-tree Cl(3,0) — so it is upstream of the choice", () => {
  const inTree = classify(3, 0); // M_2(C)
  // VGA: the algebra itself.
  expect(classifyDegenerate(3, 0, 0).semisimpleQuotient).toEqual(inTree);
  // PGA: Cl(3,0) tensor an exterior algebra — same semisimple quotient.
  expect(classifyDegenerate(3, 0, 1).semisimpleQuotient).toEqual(inTree);
  // CGA: 2x2 matrices over it — one suspension step, checked in the Q4 test above.
  expect(classify(4, 1).matrixDim).toBe(2 * inTree.matrixDim);
  expect(classify(4, 1).ground).toBe(inTree.ground);
});

it("NEGATIVE CONTROL: a degenerate algebra is NOT classified by the ABS clock", () => {
  // The load-bearing distinction. `classify(3,0)` and `classify(3,0+1)` are both defined and
  // both WRONG answers for Cl(3,0,1) — the first ignores the null generator, the second
  // pretends it squares to -1. Neither equals the true dimension.
  expect(classifyDegenerate(3, 0, 1).realDimension).toBe(16);
  expect(dimensionOfType(classify(3, 0))).toBe(8); // ignoring r: too small
  expect(dimensionOfType(classify(3, 1))).toBe(16); // r as a negative generator: right DIM...
  // ...but structurally different: Cl(3,1) is semisimple with an EMPTY radical, while
  // Cl(3,0,1) is half nilpotent. Matching dimension is not matching algebra — the same
  // numerology-vs-number-theory trap the curvature-budget tests guard.
  expect(classifyDegenerate(3, 1, 0).radicalDimension).toBe(0);
  expect(classifyDegenerate(3, 0, 1).radicalDimension).toBe(8);
});

it("REFUSES a negative degenerate signature", () => {
  expect(() => classifyDegenerate(3, 0, -1)).toThrow(RangeError);
  expect(() => classifyDegenerate(-1, 0, 1)).toThrow(RangeError);
});

it("the tower roster is non-empty and every entry classifies", () => {
  // Guards the vacuity case: an empty roster would make the table-driven claims above
  // pass over nothing.
  expect(TOWER_REDUCTION.length).toBeGreaterThanOrEqual(5);
  for (const t of TOWER_REDUCTION) {
    const [p, q, r] = t.signature;
    expect(classifyDegenerate(p, q, r).realDimension).toBe(2 ** (p + q + r));
  }
});

// ===== CAN A MULTIVECTOR SATISFY IMessage<'M>? ==========================================

it("the geometric product is a MONOID — Product/Uniform come free for IMessage", () => {
  const a: Cl30 = [1, 2, 0, -1, 0, 3, 0, 1];
  const b: Cl30 = [0, 1, 1, 0, 2, 0, -1, 0];
  const c: Cl30 = [2, 0, -1, 1, 0, 1, 0, -2];
  // identity
  expect(geometricProduct(a, CL30_ONE)).toEqual(a);
  expect(geometricProduct(CL30_ONE, a)).toEqual(a);
  // associativity — the property IMessage.Product needs and never states
  const left = geometricProduct(geometricProduct(a, b), c);
  const right = geometricProduct(a, geometricProduct(b, c));
  for (let i = 0; i < 8; i += 1) expect(left[i]).toBeCloseTo(right[i] ?? 0, 9);
});

it("BUT the geometric product has ZERO DIVISORS — so IMessage.Divide cannot be total", () => {
  // (1 + e1)(1 - e1) = 1 - e1^2 = 0 in Cl(3,0), where e1^2 = +1.
  const onePlusE1: Cl30 = [1, 1, 0, 0, 0, 0, 0, 0];
  const oneMinusE1: Cl30 = [1, -1, 0, 0, 0, 0, 0, 0];
  expect(isZero(onePlusE1)).toBe(false);
  expect(isZero(oneMinusE1)).toBe(false);
  expect(isZero(geometricProduct(onePlusE1, oneMinusE1))).toBe(true);
  // A non-zero element with a non-zero annihilator has no inverse. `Divide` is the EP
  // cavity and is not optional, so a Clifford message algebra must restrict its carrier to
  // the INVERTIBLE multivectors — the Clifford GROUP. Same restriction the literature
  // makes, reached from our interface rather than from their paper.
});

it("a VERSOR is invertible: v * v/|v|^2 = 1 — the carrier that would satisfy Divide", () => {
  // Any non-null vector inverts, which is why versors (products of such) form a group.
  const v: Cl30 = [0, 3, 4, 0, 0, 0, 0, 0]; // |v|^2 = 25
  const normSq = geometricProduct(v, v)[0];
  expect(normSq).toBeCloseTo(25, 9);
  const vInv: Cl30 = [0, 3 / 25, 4 / 25, 0, 0, 0, 0, 0];
  const prod = geometricProduct(v, vInv);
  expect(prod[0]).toBeCloseTo(1, 9);
  for (let i = 1; i < 8; i += 1) expect(prod[i]).toBeCloseTo(0, 9);
});

it("CROSS-ORACLE: the geometric product agrees with Zeta.Core.Cl3 on 200 products", async () => {
  // Same discipline as the periodicity grid: the golden vector is emitted BY `Cl3.fs` and
  // consumed here, so agreement is evidence rather than self-consistency. F#'s `Mv` field
  // order is MASK order; ours is basis order — the remap is the BLADE_MASK permutation, and
  // getting it wrong is itself a way this test goes red.
  const text = await Bun.file(
    new URL("./testdata/cl3-geometric-products.golden.txt", import.meta.url),
  ).text();
  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
  expect(rows.length).toBe(200); // vacuity guard: an emptied golden must not pass

  const MASK = [0, 1, 2, 4, 3, 5, 6, 7];
  const fromFSharp = (csv: string): Cl30 =>
    MASK.map((m) => Number(csv.split(",")[m])) as unknown as Cl30;

  let worst = 0;
  for (const row of rows) {
    const [aS, bS, pS] = row.split("|");
    const got = geometricProduct(fromFSharp(aS ?? ""), fromFSharp(bS ?? ""));
    const want = fromFSharp(pS ?? "");
    for (let i = 0; i < 8; i += 1) {
      const scale = Math.max(1, Math.abs(want[i] ?? 0));
      worst = Math.max(worst, Math.abs((got[i] ?? 0) - (want[i] ?? 0)) / scale);
    }
  }
  expect(worst).toBeLessThan(1e-12);
});
