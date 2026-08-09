#!/usr/bin/env bun
// e8-blade-mask-sandwich.ts — the FROZEN-CORE §B measurement: how much of
// E8's root-system symmetry survives the Cl(3,0) blade-mask bridge's
// versor-formula sandwich? (Promised in docs/letters/from-otto-tangle-math-
// reply.md — "implement the reflections as conjugations in the bridged
// algebra; either result is a banked measurement" — and sharpening the
// route-B disclaimer in CliffordE8Bridge.fs / Soraya's routing doc.)
//
// RESULT (golden, asserted in the test): the blade-mask sandwich
// s_A(x) = −A·x·Ã / ⟨A·Ã⟩₀ over all 240×240 bridged-root pairs is NOT a
// reflection action (the classical baseline preserves 57,600/57,600; the
// sandwich preserves 11,776) — but it is NOT structureless either:
//   - exactly 32 bridged roots are versor-normed (A·Ã scalar), and EVERY
//     one of them preserves ALL 240 roots — a perfect 32-element
//     root-symmetry fragment inside the bridge;
//   - the other 208 quantize crisply: 160 preserve 0 roots, 32 preserve
//     exactly 64, 16 preserve exactly 128;
//   - the 32 are exactly the 8 single-blade supports (±2·blade) plus the
//     TWO weight-4 codewords whose supports align with Cl(3,0)'s own
//     structure: {1,2,5,6} = {e₁,e₂,e₁₃,e₂₃} and its complement
//     {0,3,4,7} = {S,e₁₂,e₃,e₁₂₃}.
//
//     WHAT ACTUALLY DISTINGUISHES THEM — pseudoscalar CLOSURE, not
//     XOR-closure and not grade-completeness. Head-to-head over the 14
//     weight-4 codewords (computed; see the regression test):
//       XOR-closed subgroup        -> 3 matches  ({0,1,4,5},{0,2,4,6},{0,3,4,7})
//       contains pseudoscalar e₁₂₃ -> 7 matches
//       CLOSED UNDER i ↦ i⊕7       -> EXACTLY 2  ({0,3,4,7} and {1,2,5,6})  ✔
//
//     Two earlier explanations were tried and are WRONG; the test below
//     pins them so neither can come back:
//       * "XOR-closed subalgebra + its coset" — under-determined (3 pairs).
//       * "the unique GRADE-COMPLETE subalgebra {0,1,2,3}" — explains only
//         HALF the answer. The other survivor {1,2,5,6} has grades
//         {1,1,2,2} and contains neither the scalar nor the pseudoscalar,
//         so grade-completeness cannot be the criterion.
//
//     Why closure is the right notion: {1,2,5,6} = 1 ⊕ {0,3,4,7} is the
//     COSET, and closure under i ↦ i⊕7 is COSET-INVARIANT (if S is closed
//     then so is x ⊕ S) whereas "contains 7" is not. One criterion, both
//     survivors — which is exactly what an explanation has to do.
//
//     The algebraic content (Lumen, math review 2026-08-09): with
//     Cl(3,0) ≅ ℂ ⊗ℝ ℍ and I = e₁₂₃ central, A = q + I·p is versor-normed
//     iff q and p are ℝ-collinear — i.e. A is a DECOMPOSABLE element of
//     ℂ⊗ℍ. Collinearity forces span(q) = span(p), so the support must be
//     closed under multiplication by I. Support-level talk is a lossy
//     projection regardless: only 8 of the 16 sign patterns on each of
//     these supports is versor-normed (16 single blades + 8 + 8 = 32).
// So route-B's "the Cl(3,0) sandwich implements NO W(E8) reflection"
// upgrades from a grading argument to a measured statement: it implements
// EXACTLY a 32-element Clifford-aligned subset of E8 roots that individually
// preserve all 240 roots under the sandwich, and nothing more.
//
// TWO CAVEATS THAT MUST TRAVEL WITH THE NUMBER 32 (Lumen, math review):
//  1. 32 counts ROOT-VECTORS, not symmetries. They induce only 8 DISTINCT
//     maps, generating a group of order 16 (≅ D₄ × C₂) inside W(E8) —
//     index 43,545,600. Their reflection closure is 48 roots = D₄ ⊕ D₄, a
//     Borel–de Siebenthal maximal-rank subsystem; the 32 are 32 of those 48
//     and are NOT themselves a closed sub-root-system.
//  2. 32 IS LABELLING-DEPENDENT. Sweeping all 8! relabellings of code
//     coordinates onto blade indices, the versor-normed count is 16 in
//     ~47% of labellings and 32 in only ~30%. ONLY THE 16 SINGLE BLADES ARE
//     LABELLING-INVARIANT. So "32" is a fact about this pairing of two
//     independent coordinate conventions (AdinkraCode's generator ×
//     Cl3's blade indexing), NOT about E8 and Cl(3,0) as such. Do not put
//     32 into FROZEN-CORE without this caveat attached.
//     (Sweep measured by Lumen; not independently re-run here.)
//
// Constructions replicated byte-faithfully from the F# oracles:
//   - AdinkraCode.fs: [8,4] extended Hamming generator, systematic [I₄|A].
//   - E8Lattice.fs: Construction A — 16 even roots (±2eᵢ) + 224 odd roots
//     (weight-4 codewords, all 16 sign patterns).
//   - Cl3.fs: geometric product by mask-XOR + reorderSign; reverse flips
//     grades 2,3. Integer arithmetic throughout (roots have norm² = 4 and
//     even inner products; the only division is by ⟨A·Ã⟩₀ = 4).
//
// Anchors: Dechant 2016/2017 (root systems + Coxeter groups as Clifford
// versors — in Cl(8,0), where the TRUE reflection action lives; workitem
// 081KYXCM1WK carries that construction); Conway–Sloane SPLAG (Construction
// A); Gates et al. (adinkra ↔ doubly-even self-dual codes). This module is
// the measured boundary between the two: what the 2³-blade bridge does and
// does not carry of the 2⁴⁰-sized Weyl group.
//
// Usage: bun src/Core.TypeScript/algebra/e8-blade-mask-sandwich.ts
// (prints the measurement report; the test asserts the golden numbers).

// ── [8,4] extended Hamming code (AdinkraCode.fs) ────────────────────────────

const GENERATOR: readonly (readonly number[])[] = [
  [1, 0, 0, 0, 0, 1, 1, 1],
  [0, 1, 0, 0, 1, 0, 1, 1],
  [0, 0, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 1, 1, 1, 0],
];

export function allCodewords(): readonly (readonly number[])[] {
  const out: number[][] = [];
  for (let m = 0; m < 16; m += 1) {
    out.push(
      Array.from({ length: 8 }, (_, j) => {
        let acc = 0;
        for (let i = 0; i < 4; i += 1) acc ^= ((m >> i) & 1) & GENERATOR[i]![j]!;
        return acc;
      }),
    );
  }
  return out;
}

// ── E8 roots via Construction A (E8Lattice.fs) ──────────────────────────────

export function e8Roots(): readonly (readonly number[])[] {
  const roots: number[][] = [];
  for (let i = 0; i < 8; i += 1) {
    for (const s of [2, -2]) roots.push(Array.from({ length: 8 }, (_, j) => (j === i ? s : 0)));
  }
  for (const c of allCodewords()) {
    if (c.reduce((a, b) => a + b, 0) !== 4) continue;
    const support = c.flatMap((v, j) => (v === 1 ? [j] : []));
    for (let signs = 0; signs < 16; signs += 1) {
      roots.push(
        Array.from({ length: 8 }, (_, j) => {
          const k = support.indexOf(j);
          return k === -1 ? 0 : (signs >> k) & 1 ? -1 : 1;
        }),
      );
    }
  }
  return roots;
}

// ── Cl(3,0) product on blade-mask coordinates (Cl3.fs conventions) ──────────

export function reorderSign(a: number, b: number): number {
  let aShift = a >> 1;
  let swaps = 0;
  while (aShift !== 0) {
    let x = aShift & b;
    while (x) {
      swaps += x & 1;
      x >>= 1;
    }
    aShift >>= 1;
  }
  return swaps % 2 === 0 ? 1 : -1;
}

export function gp(x: readonly number[], y: readonly number[]): number[] {
  const r = new Array<number>(8).fill(0);
  for (let i = 0; i < 8; i += 1) {
    if (x[i] === 0) continue;
    for (let j = 0; j < 8; j += 1) {
      if (y[j] === 0) continue;
      r[i ^ j]! += reorderSign(i, j) * x[i]! * y[j]!;
    }
  }
  return r;
}

const REVERSE_SIGN = [1, 1, 1, -1, 1, -1, -1, -1] as const; // grades 0,1,1,2,1,2,2,3

export function reverse(x: readonly number[]): number[] {
  return x.map((v, i) => v * REVERSE_SIGN[i]!);
}

// ── The measurement ─────────────────────────────────────────────────────────

export interface Measurement {
  readonly rootCount: number;
  readonly classicalPreserved: number; // baseline: must equal 240·240
  readonly versorNormedCount: number; // A with A·Ã scalar
  readonly versorNormedSupports: readonly string[]; // sorted support signatures
  readonly integerImages: number;
  readonly rootImages: number;
  readonly identityFixedPairs: number;
  readonly versorPreserved: number; // pairs preserved by versor-normed A
  readonly perAHistogram: readonly (readonly [number, number])[]; // [preservedCount, #A]
}

export function measure(): Measurement {
  const roots = e8Roots();
  const rootSet = new Set(roots.map((r) => r.join(",")));

  let classical = 0;
  for (const r of roots) {
    for (const x of roots) {
      const d = x.reduce((a, xi, i) => a + xi * r[i]!, 0);
      const img = x.map((xi, i) => xi - (d / 2) * r[i]!);
      if (rootSet.has(img.join(","))) classical += 1;
    }
  }

  let versorCount = 0;
  const supports = new Set<string>();
  let integerImages = 0;
  let rootImages = 0;
  let identityFixed = 0;
  let versorPreserved = 0;
  const hist = new Map<number, number>();

  for (const A of roots) {
    const Ar = reverse(A);
    const isVersor = gp(A, Ar).slice(1).every((v) => v === 0);
    if (isVersor) {
      versorCount += 1;
      supports.add(A.flatMap((v, i) => (v !== 0 ? [i] : [])).join("+"));
    }
    let preserved = 0;
    for (const x of roots) {
      const img = gp(gp(A, x), Ar).map((v) => -v / 4);
      if (!img.every(Number.isInteger)) continue;
      integerImages += 1;
      if (rootSet.has(img.join(","))) {
        rootImages += 1;
        preserved += 1;
        if (img.join(",") === x.join(",")) identityFixed += 1;
      }
    }
    if (isVersor) versorPreserved += preserved;
    hist.set(preserved, (hist.get(preserved) ?? 0) + 1);
  }

  return {
    rootCount: roots.length,
    classicalPreserved: classical,
    versorNormedCount: versorCount,
    versorNormedSupports: [...supports].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    integerImages,
    rootImages,
    identityFixedPairs: identityFixed,
    versorPreserved,
    perAHistogram: [...hist.entries()].sort((a, b) => a[0] - b[0]),
  };
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /e8-blade-mask-sandwich\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const m = measure();
  console.log(`roots: ${String(m.rootCount)} | classical baseline: ${String(m.classicalPreserved)}/57600`);
  console.log(
    `versor-normed A: ${String(m.versorNormedCount)}/240 (supports: ${m.versorNormedSupports.join(" | ")})`,
  );
  console.log(
    `sandwich images — integer: ${String(m.integerImages)} | roots: ${String(m.rootImages)} | identity-fixed: ${String(m.identityFixedPairs)}`,
  );
  console.log(`versor-normed preserve: ${String(m.versorPreserved)} (all-240 each iff = 32·240 = 7680)`);
  console.log(`per-A histogram [preserved, #A]: ${JSON.stringify(m.perAHistogram)}`);
}
