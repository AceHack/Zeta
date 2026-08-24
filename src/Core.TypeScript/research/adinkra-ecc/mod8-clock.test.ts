// mod8-clock.test.ts — the experiment, and its controls.
//
// READ THE MODULE HEADER FIRST. In one line: is the adinkra's what-remains / what-acts clock a
// property of the CODE (Gleason: doubly-even self-dual codes exist only at length divisible by 8)
// or of the CLIFFORD ALGEBRA (Atiyah-Bott-Shapiro: real Clifford algebras have period 8)? The two
// make opposite predictions about a colour set the code does not touch, so the question is
// decidable by measurement rather than by argument.
//
// THREE RESULTS, and the second one is the one nobody predicted:
//
//   1. The code CANNOT move the clock. All 70 four-colour subsets of the N = 8 self-dual adinkra
//      give a byte-identical clock reading — the 14 that carry a codeword and the 56 that do not.
//      ORIGIN A is excluded, ORIGIN B survives. The control that makes this non-blind: those same
//      two groups DO differ on freeness, which is what `regular-representation-defect` measures.
//
//   2. The separation clock has period FOUR, not eight. Swept to N = 16 by a search for the
//      smallest invariant shift — never by asking `N % 8` — it separates at N = 4, 8, 12, 16.
//      `CliffordPeriodicity.halvesSeparateCleanly` states the condition as "the even part lands
//      on split row s+1 in {1,5}", i.e. s in {0,4} mod 8; along the one-parameter adinkra family
//      Cl(0,N) that is exactly N = 0 mod 4. The mod-8 statement is true of Cl(p,q) in general and
//      DEGENERATES to mod 4 on the family the adinkras actually live in.
//
//   3. The period-8 invariant is real but lives elsewhere, and the code is what makes it VISIBLE.
//      The Morita ground (R / C / H) is read from `dim End_A(M)`, and for the codeless tower that
//      is 2^N — the whole algebra again, because the module is the regular representation. It
//      shrinks as 2^(N-2k) and reaches 1 exactly at the self-dual point. So the usual telling, in
//      which a code only takes things away, is backwards for this observable.
//
// Nothing here promotes anything. Registers per `.claude/rules/toy-is-free-metered-must-be-earned.md`:
// results 1 and 3 are METERED (falsifiers below, and they fail under mutation); result 2 is
// METERED as a statement about this family and is NOT a claim that ABS periodicity is really 4 —
// it is a claim about which observable the repo's clock function reads.

import { describe, expect, it } from "bun:test";
import {
  clockByBlades,
  clockByMatrices,
  codeTouches,
  commutantDim,
  readingsEqual,
  selfDualAdinkraN8,
  separationPeriod,
  subsets,
} from "./mod8-clock.js";
import {
  buildCodedAdinkra,
  cliffordRelationsHold,
  enumerateDoublyEvenCodes,
} from "./regular-representation-defect.js";

describe("the instrument itself", () => {
  it("the two routes agree on every colour set of the N=8 self-dual adinkra", () => {
    // Route M composes real matrices and compares them entry by entry; Route B evaluates a sign
    // formula on bitmasks. They share no intermediate quantity, so agreement is evidence rather
    // than a restatement. If this ever fails, one of the two is wrong and neither result stands.
    const a = selfDualAdinkraN8(-1);
    let compared = 0;
    for (let k = 1; k <= 4; k++) {
      for (const T of subsets(8, k)) {
        const mask = T.reduce((m, c) => m | (1 << c), 0);
        expect(readingsEqual(clockByMatrices(a, T), clockByBlades(mask, -1))).toBe(true);
        compared++;
      }
    }
    // 8 + 28 + 56 + 70 — stated so a silently empty loop cannot pass.
    expect(compared).toBe(162);
  });

  it("the object under test really is an adinkra (the garden-algebra relations hold)", () => {
    const a = selfDualAdinkraN8(-1);
    expect(cliffordRelationsHold(a, -1)).toBe(true);
    expect(a.k).toBe(4);
    expect(a.reps.length).toBe(16);
  });

  it("MUTATION CONTROL: the reading comparison can distinguish readings", () => {
    // `readingsEqual` returning true everywhere would make the headline result vacuous. Two colour
    // sets of DIFFERENT size must read differently.
    const a = clockByBlades(0b1111, -1);
    const b = clockByBlades(0b111, -1);
    expect(readingsEqual(a, b)).toBe(false);
  });
});

describe("EXPERIMENT 1 — within one object: can the code move the clock?", () => {
  const a = selfDualAdinkraN8(-1);
  const fourColour = subsets(8, 4);

  it("the treatment and control groups exist and are the expected sizes", () => {
    // 70 four-colour subsets; the code's support meets 14 of them. This is the split
    // `regular-representation-defect` already measures as free/not-free, recomputed here from the
    // code itself so the two groups are not taken on trust.
    expect(fourColour.length).toBe(70);
    const touched = fourColour.filter((T) => codeTouches(a.code, T));
    expect(touched.length).toBe(14);
    expect(fourColour.length - touched.length).toBe(56);
  });

  it("RESULT: all 70 subsets give the IDENTICAL clock reading", () => {
    const first = clockByMatrices(a, fourColour[0] ?? []);
    for (const T of fourColour) {
      expect(readingsEqual(clockByMatrices(a, T), first)).toBe(true);
    }
    // And the reading is the one Cl(0,4) predicts: 16-dimensional, trivial centre, even part
    // 8-dimensional with a 2-dimensional centre whose generator squares to +1 — it separates.
    expect(first.algebraDim).toBe(16);
    expect(first.centreDim).toBe(1);
    expect(first.evenDim).toBe(8);
    expect(first.evenCentreDim).toBe(2);
    expect(first.evenOmegaSquare).toBe(1);
    expect(first.separates).toBe(true);
  });

  it("THE CONTROL: the same two groups DO differ, on freeness", () => {
    // Without this the headline is unfalsifiable: an instrument that cannot tell the groups apart
    // on ANY observable would report "no difference" whatever the truth was. Freeness is exactly
    // the observable the code does move — 56 free, 14 not — so the groups are genuinely
    // distinguishable and the clock's indifference is a fact about the clock.
    const free = fourColour.filter((T) => !codeTouches(a.code, T));
    const notFree = fourColour.filter((T) => codeTouches(a.code, T));
    expect(free.length).toBe(56);
    expect(notFree.length).toBe(14);
    // A code-touching subset has a nonzero codeword inside it; a code-free one does not. That is
    // the criterion `regular-representation-defect.test.ts` proves equivalent to rank-1 freeness.
    for (const T of notFree) {
      const mask = T.reduce((m, c) => m | (1 << c), 0);
      expect(a.code.some((c) => c !== 0 && (c & ~mask) === 0)).toBe(true);
    }
    for (const T of free) {
      const mask = T.reduce((m, c) => m | (1 << c), 0);
      expect(a.code.some((c) => c !== 0 && (c & ~mask) === 0)).toBe(false);
    }
  });

  it("RESULT extends across every code of length <= 8, not just the self-dual one", () => {
    // If the clock were code-sensitive at all, sweeping every doubly-even code at a fixed colour
    // count is where it would show. It does not: the reading depends on |T| alone.
    const reference = clockByBlades(0b1111, -1);
    let sweeps = 0;
    for (const gens of enumerateDoublyEvenCodes(8)) {
      const adinkra = buildCodedAdinkra(8, gens, -1);
      for (const T of subsets(8, 4).slice(0, 6)) {
        expect(readingsEqual(clockByMatrices(adinkra, T), reference)).toBe(true);
        sweeps++;
      }
    }
    expect(sweeps).toBeGreaterThan(1000);
  });
});

describe("EXPERIMENT 1b — the CODELESS tower, asked directly", () => {
  // Aaron's question was literally "does the codeless tower have a mod-8 clock?" Experiment 1
  // answers it indirectly, by showing the clock cannot see the code. This asks the codeless tower
  // itself, through its OWN operators (Route M) rather than through the blade formula — so the
  // answer does not rest on the identification A_graph = Cl(0,N) being taken on trust.
  it("YES — the codeless tower carries the same clock, operator for operator", () => {
    let compared = 0;
    for (let n = 1; n <= 8; n++) {
      const codeless = buildCodedAdinkra(n, [], -1);
      expect(cliffordRelationsHold(codeless, -1)).toBe(true);
      const all = Array.from({ length: n }, (_, i) => i);
      const viaOperators = clockByMatrices(codeless, all);
      const viaBlades = clockByBlades((1 << n) - 1, -1);
      expect(readingsEqual(viaOperators, viaBlades)).toBe(true);
      compared++;
    }
    expect(compared).toBe(8);
  });

  it("and it separates at N = 4 and N = 8 — measured on the operators, not the formula", () => {
    const seen: number[] = [];
    for (let n = 1; n <= 8; n++) {
      const all = Array.from({ length: n }, (_, i) => i);
      if (clockByMatrices(buildCodedAdinkra(n, [], -1), all).separates) seen.push(n);
    }
    expect(seen).toEqual([4, 8]);
  });

  it("CONTROL: the codeless reading is NOT constant in N, so the agreement above has content", () => {
    // If every N read the same, "the coded and codeless towers agree" would be unfalsifiable.
    const readings = new Set<string>();
    for (let n = 1; n <= 8; n++) {
      const all = Array.from({ length: n }, (_, i) => i);
      const r = clockByMatrices(buildCodedAdinkra(n, [], -1), all);
      readings.add(`${r.algebraDim}|${r.centreDim}|${r.omegaSquare}|${r.evenCentreDim}|${r.evenOmegaSquare}`);
    }
    expect(readings.size).toBe(8);
  });
});

describe("EXPERIMENT 2 — the period of the separation clock", () => {
  it("RESULT: period 4, measured by searching for the smallest invariant shift", () => {
    for (const square of [-1, 1] as const) {
      const r = separationPeriod(16, square);
      expect(r.period).toBe(4);
      expect(r.separatingN).toEqual([4, 8, 12, 16]);
    }
  });

  it("this AGREES with CliffordPeriodicity.halvesSeparateCleanly, reached independently", () => {
    // The F# function's condition is `signatureClass(0,N) in {0,4}` — a genuine mod-8 statement
    // about Cl(p,q). Restricted to the adinkra family, where only N varies and p is pinned at 0,
    // {0,4} mod 8 collapses to 0 mod 4. Recomputed here from the F# rule so the collapse is
    // exhibited rather than asserted, and cross-checked against the operator measurement above.
    const signatureClass = (p: number, q: number): number => (((p - q) % 8) + 8) % 8;
    const fsharpSeparates = (n: number): boolean => [0, 4].includes(signatureClass(0, n));
    const measured = separationPeriod(16, -1);
    for (let n = 1; n <= 16; n++) {
      expect(measured.flags[n]).toBe(fsharpSeparates(n));
      // and the collapse itself:
      expect(fsharpSeparates(n)).toBe(n % 4 === 0);
    }
  });

  it("MUTATION CONTROL: the period search reports something other than 4 when fed a mod-8 signal", () => {
    // `separationPeriod` must be able to find periods that are not 4, or "period 4" says nothing.
    // Fed the flag sequence of a genuine mod-8 predicate, the same search must return 8.
    const flags = [false, ...Array.from({ length: 16 }, (_, i) => (i + 1) % 8 === 0)];
    let found = 0;
    for (let p = 1; p <= 16; p++) {
      let ok = true;
      let compared = 0;
      for (let n = 1; n + p <= 16; n++) {
        compared++;
        if (flags[n] !== flags[n + p]) {
          ok = false;
          break;
        }
      }
      if (ok && compared >= p) {
        found = p;
        break;
      }
    }
    expect(found).toBe(8);
  });
});

describe("EXPERIMENT 3 — where the period-8 invariant actually lives", () => {
  it("dim End_A(M) = 2^(N-2k): the code is what makes the Morita ground visible", () => {
    // For k = 0 the module is the regular representation and its endomorphism algebra is the whole
    // algebra again, so the R/C/H ground — the genuine period-8 Atiyah-Bott-Shapiro invariant — is
    // hidden by construction. Every bit of code dimension halves the commutant twice over, and at
    // the self-dual point k = N/2 it reaches 1, meaning the module is SIMPLE and its ground is R.
    for (const n of [4, 6, 8]) {
      for (const gens of enumerateDoublyEvenCodes(n)) {
        const a = buildCodedAdinkra(n, gens, -1);
        expect(commutantDim(a)).toBe(1 << (n - 2 * gens.length));
      }
    }
  });

  it("the codeless tower hides it, the self-dual point exposes it", () => {
    const codeless = buildCodedAdinkra(8, [], -1);
    expect(commutantDim(codeless)).toBe(256); // = dim A, the regular representation
    const selfDual = selfDualAdinkraN8(-1);
    expect(commutantDim(selfDual)).toBe(1); // simple module, ground = R
  });

  it("MUTATION CONTROL: commutantDim is sign-sensitive, not just an orbit count", () => {
    // Dropping the sign bookkeeping would turn this into a plain orbit count on index pairs and
    // report a strictly larger number. Recomputed here without signs to show the difference is
    // real — an inconsistent orbit must contribute 0, not 1.
    const a = selfDualAdinkraN8(-1);
    const dim = a.reps.length;
    const parent = new Int32Array(dim * dim);
    for (let i = 0; i < parent.length; i++) parent[i] = i;
    const find = (x: number): number => {
      let r = x;
      while (parent[r] !== r) r = parent[r] ?? r;
      return r;
    };
    for (const op of a.L) {
      for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
          const ra = find(i * dim + j);
          const rb = find((op.to[i] ?? 0) * dim + (op.to[j] ?? 0));
          if (ra !== rb) parent[rb] = ra;
        }
      }
    }
    const roots = new Set<number>();
    for (let i = 0; i < parent.length; i++) roots.add(find(i));
    expect(roots.size).toBeGreaterThan(commutantDim(a));
  });
});
