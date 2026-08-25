/**
 * Falsifiers for `cd-order-ladder.ts`.
 *
 * READ THE MODULE HEADER FIRST. The claim under test, in one line: the A2 -> D4 -> E8 ladder is
 * NOT a banana split of two independent catamorphisms, because the lattice step reads the algebra;
 * and past the octonion rung it is not even a function, because the completion is three-valued.
 *
 * Every assertion below fails if the corresponding sentence in
 * `docs/research/2026-08-25-banana-split-*.md` is wrong. Two of them are CONTROLS -- checks that
 * exist to prove the other checks can fail:
 *
 *   - "the basis-only profile is vacuous" pins that a weaker (and tempting) version of the
 *     algebra profile would wrongly certify the SEDENIONS as normed and alternative;
 *   - "480 does not discriminate" pins that the root COUNT cannot tell E8+E8 from D16+, so the
 *     rank-16 verdict rests on connectivity and not on a matching number.
 *
 * TIMEOUTS ARE LOAD-BEARING HERE, and this file learned that the expensive way. bunfig's effective
 * per-test cap is 5000ms (see `bunfig.toml` -- the `[test] timeout` key is NOT implemented by bun
 * 1.3.14, so only per-test arguments and `--timeout` work). Four tests here shipped without one,
 * passed on a developer laptop, and timed out at 5.7-7.1s on the CI runner -- reddening BOTH
 * `full-verify` step 17 and `test (TS hermetic)` step 9 from a single cause. The log line that
 * settles it is `^ this test timed out after 5000ms.`, not an assertion diff: nothing here is
 * ordering-dependent, environment-dependent, or non-deterministic, and the durations clustering
 * just above 5000ms is the tell.
 *
 * The repair follows `bunfig.toml`'s own rule -- "a test that is slow BY NATURE carries its own
 * explicit timeout; a test that is slow BY ACCIDENT gets made fast" -- and this file was both:
 * every test touching the exhaustive enumeration now carries `60_000`, AND
 * `doubledHurwitzOverlattices()` memoises the argument-free enumeration that four tests were each
 * paying for in full. Wall time went 36s -> 22s. If you add a test that calls
 * `integralOverlattices`, `octavianCompletions`, `roots`, `profileCdRung` or `completionCount`,
 * give it an explicit timeout.
 *
 * Runtime: ~22s. Exact rational arithmetic throughout; no tolerances anywhere.
 */

import { describe, expect, it } from "bun:test";
import {
  cdBasis,
  cdConj,
  cdDoubleOrder,
  cdIsIntegral,
  cdMul,
  cdMulBaez,
  cdNorm,
  completionCount,
  componentsOfIntegerRoots,
  conjugationAutomorphism,
  d16PlusRoots,
  detRat,
  e8PlusE8RootsDoubled,
  glueSignature,
  gram,
  hurwitzOrder,
  doubledHurwitzOverlattices,
  integralOverlattices,
  lipschitzOrder,
  octavianCompletions,
  profileCdRung,
  rat,
  req,
  rmul,
  rootComponents,
  roots,
  rstr,
  sameLattice,
  splitCCIsIntegral,
  splitCCMul,
  vadd,
  vkey,
  type Vec,
} from "./cd-order-ladder.ts";

describe("the generator: the Cayley-Dickson tower is a total, uniform iterator", () => {
  it("reproduces the classical profile, sedenions included", () => {
    expect(profileCdRung(2)).toMatchObject({ commutative: true, associative: true });
    expect(profileCdRung(4)).toMatchObject({ commutative: false, associative: true, alternative: true });
    expect(profileCdRung(8)).toMatchObject({
      associative: false,
      alternative: true,
      normMultiplicative: true,
    });
    // Hurwitz 1898: the composition (normed) algebras stop at dimension 8. Measured, not cited.
    expect(profileCdRung(16)).toMatchObject({ alternative: false, normMultiplicative: false });
  }, 60_000);

  it("CONTROL: a basis-only profile would wrongly certify the sedenions", () => {
    // This is the vacuous version of the same check. It passes for dim 16, which is why the real
    // profile tests sums e_i + e_j. If this control ever fails, the real test has lost its teeth.
    const e = cdBasis(16);
    let normMultOnBasis = true;
    let altOnBasis = true;
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++) {
        const ij = cdMul(e[i]!, e[j]!);
        if (!req(cdNorm(ij), rat(1))) normMultOnBasis = false;
        if (vkey(cdMul(cdMul(e[i]!, e[i]!), e[j]!)) !== vkey(cdMul(e[i]!, cdMul(e[i]!, e[j]!)))) altOnBasis = false;
      }
    expect(normMultOnBasis).toBe(true);
    expect(altOnBasis).toBe(true);
  });

  it("doubling a lattice is an ORTHOGONAL SUM, so the generator alone can never fuse components", () => {
    const dh = cdDoubleOrder(hurwitzOrder());
    const g = gram(dh);
    for (let i = 0; i < 4; i++) for (let j = 4; j < 8; j++) expect(g[i]![j]!.n).toBe(0n);
  });
});

describe("rung C -> H: the completion is UNIQUE, so here the join really is a least upper bound", () => {
  const lip = lipschitzOrder();
  const overs = integralOverlattices(lip);

  it("has exactly one proper integral overlattice, at index 2", () => {
    const proper = overs.filter((o) => o.index > 1);
    expect(proper.length).toBe(1);
    expect(proper[0]!.index).toBe(2);
    expect(proper[0]!.multiplicativelyClosed).toBe(true);
    expect(rstr(proper[0]!.det)).toBe("4");
  });

  it("and that overlattice IS the Hurwitz order", () => {
    const proper = overs.find((o) => o.index === 2)!;
    expect(sameLattice(proper.basis, hurwitzOrder())).toBe(true);
  });

  it("the glue fuses A1^4 into D4: 8 roots / 4 components -> 24 roots / 1 component", () => {
    const gen = roots(lip, 2);
    expect(gen.length).toBe(8);
    expect(rootComponents(gen)).toBe(4);
    const done = roots(hurwitzOrder(), 2);
    expect(done.length).toBe(24);
    expect(rootComponents(done)).toBe(1);
  }, 60_000);
});

describe("rung H -> O: the completion is THREE-VALUED, so here the join is NOT a lub", () => {
  const dh = cdDoubleOrder(hurwitzOrder());
  const unimodular = doubledHurwitzOverlattices().filter((o) => o.index === 4);

  it("the generator undershoots by index 4 and holds exactly 48 of the 240 roots", () => {
    expect(rstr(detRat(gram(dh)))).toBe("16");
    const gen = roots(dh, 4);
    expect(gen.length).toBe(48);
    expect(rootComponents(gen)).toBe(2);
  }, 60_000);

  it("there are 6 unimodular gluings -- |GL_2(F_2)| = |S_3| -- and exactly 3 are rings", () => {
    expect(unimodular.length).toBe(6);
    expect(unimodular.filter((o) => o.multiplicativelyClosed).length).toBe(3);
  });

  it("THE INVARIANT: a gluing is a ring iff its induced permutation is ODD", () => {
    // This is what makes "3" an identification rather than a matching count. The competitor
    // readings -- "3 because the algebra stopped associating", "3 because D4 has 3 glue classes" --
    // are excluded: the identity gluing has an odd number of nothing and is NOT a ring, and all
    // three 3-cycles fail too. Parity is the discriminator.
    for (const o of unimodular) {
      const sig = glueSignature(o)!;
      expect(sig).not.toBeNull();
      expect(o.multiplicativelyClosed).toBe(sig.parity === "odd");
    }
    // Ordinal, not localeCompare (.claude/rules/culture-invariant-by-default.md).
    const perms = unimodular.map((o) => glueSignature(o)!.permutation).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(perms).toEqual(["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"]);
    // The IDENTITY gluing -- the one a naive `double then glue diagonally` would pick -- fails.
    expect(unimodular.find((o) => glueSignature(o)!.permutation === "ABC")!.multiplicativelyClosed).toBe(false);
  });

  it("all three completions are E8: det 1, 240 roots, one component", () => {
    for (const o of octavianCompletions()) {
      expect(rstr(o.det)).toBe("1");
      const r = roots(o.basis, 4);
      expect(r.length).toBe(240);
      expect(rootComponents(r)).toBe(1);
    }
  }, 60_000);

  it("the three are genuinely DIFFERENT subsets of O, not one lattice counted thrice", () => {
    const c = octavianCompletions();
    expect(c.length).toBe(3);
    expect(sameLattice(c[0]!.basis, c[1]!.basis)).toBe(false);
    expect(sameLattice(c[0]!.basis, c[2]!.basis)).toBe(false);
    expect(sameLattice(c[1]!.basis, c[2]!.basis)).toBe(false);
  }, 60_000);

  it("NO NATURAL CHOICE: conjugation by omega permutes the three cyclically", () => {
    // omega = (1+i+j+k)/2 is a Hurwitz unit; conjugation by it is a *-automorphism of H, so its
    // CD extension is an automorphism of O preserving D(Hurwitz). It moves the three completions
    // in a single orbit -- therefore no selection among them commutes with the automorphisms of
    // the input data, therefore no NATURAL transformation makes the doubling square commute.
    const h = rat(1, 2);
    const omega: Vec = [h, h, h, h];
    const psi = conjugationAutomorphism(omega);
    const e = cdBasis(4);
    expect(vkey(psi([...e[1]!, ...vzero4()]).slice(0, 4))).toBe(vkey(e[2]!)); // i -> j
    const dhb = cdDoubleOrder(hurwitzOrder());
    for (const u of dhb) for (const v of dhb) expect(vkey(psi(cdMul(u, v)))).toBe(vkey(cdMul(psi(u), psi(v)))); // it is an automorphism
    const c = octavianCompletions();
    const image = c.map((r) => c.findIndex((s) => sameLattice(r.basis.map(psi), s.basis)));
    // COPY before sorting (sort mutates), and NUMERIC comparator -- a bare .sort() on numbers is
    // lexicographic, which is a real trap even though it happens to be harmless for 0..2.
    expect([...image].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(image.some((x, i) => x === i)).toBe(false); // with no fixed point: a single 3-orbit
  }, 60_000);

  it("the glue fuses D4+D4 into E8: 48 roots / 2 components -> 240 roots / 1 component", () => {
    const done = octavianCompletions()[0]!;
    expect(rootComponents(roots(done.basis, 4))).toBe(1);
  }, 60_000);
});

function vzero4(): Vec {
  return [rat(0), rat(0), rat(0), rat(0)];
}

describe('CONVENTION INDEPENDENCE: "three" is not an artefact of one sign choice', () => {
  it("Baez's Cayley-Dickson convention is a genuinely DIFFERENT product, not a relabelling", () => {
    const e = cdBasis(8);
    let differing = 0;
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) if (vkey(cdMul(e[i]!, e[j]!)) !== vkey(cdMulBaez(e[i]!, e[j]!))) differing++;
    // A relabelling would leave this near zero. It is 42 of 64: a different multiplication.
    expect(differing).toBeGreaterThan(32);
  });

  it("...and it is still an octonion algebra: normed, alternative, non-associative", () => {
    const e = cdBasis(8);
    const t: Vec[] = [...e];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) t.push(vadd(e[i]!, e[j]!));
    let normed = true;
    let alternative = true;
    for (const x of t)
      for (const y of t) {
        if (!req(cdNorm(cdMulBaez(x, y)), rmul(cdNorm(x), cdNorm(y)))) normed = false;
        if (vkey(cdMulBaez(cdMulBaez(x, x), y)) !== vkey(cdMulBaez(x, cdMulBaez(x, y)))) alternative = false;
      }
    expect(normed).toBe(true);
    expect(alternative).toBe(true);
    let associative = true;
    for (let i = 0; i < 8 && associative; i++)
      for (let j = 0; j < 8 && associative; j++)
        for (let k = 0; k < 8 && associative; k++)
          if (vkey(cdMulBaez(cdMulBaez(e[i]!, e[j]!), e[k]!)) !== vkey(cdMulBaez(e[i]!, cdMulBaez(e[j]!, e[k]!))))
            associative = false;
    expect(associative).toBe(false);
  }, 60_000);

  it("both conventions give THREE completions", () => {
    expect(completionCount(cdMul)).toBe(3);
    expect(completionCount(cdMulBaez)).toBe(3);
  }, 60_000);
});

describe("THE SPLIT CONDITION FAILS: the lattice step reads the algebra", () => {
  // Banana split requires  pi2 . chi = psi . F pi2  -- the lattice successor must be a function of
  // the lattice ALONE. Here is the same Z-module Z^4, with the SAME quadratic form Q = 2 sum x_i^2,
  // in two different ambient algebras. The completions differ. Hence no such psi exists.
  const z4 = lipschitzOrder();

  it("same lattice, same form, two algebras", () => {
    expect(rstr(detRat(gram(z4)))).toBe("16");
    expect(roots(z4, 2).length).toBe(8);
  }, 60_000);

  it("inside H it completes at index 2; inside C x C it is already maximal", () => {
    const inH = integralOverlattices(z4).filter((o) => o.multiplicativelyClosed && o.allIntegral);
    const inCC = integralOverlattices(z4, -1, splitCCMul, splitCCIsIntegral).filter(
      (o) => o.multiplicativelyClosed && o.allIntegral,
    );
    expect(Math.max(...inH.map((o) => o.index))).toBe(2);
    expect(Math.max(...inCC.map((o) => o.index))).toBe(1);
  }, 60_000);

  it("the witness: omega is integral in H and is NOT integral in C x C", () => {
    const h = rat(1, 2);
    const omega: Vec = [h, h, h, h];
    expect(cdIsIntegral(omega)).toBe(true); // Tr = 1, N = 1
    expect(splitCCIsIntegral(omega)).toBe(false); // (1+i)/2 is not a Gaussian integer
  });
});

describe("rank 16: the control PR #15415 asked for, now run", () => {
  it("the CD double of the octavian order is already unimodular -- the join has nothing to do", () => {
    const oct = octavianCompletions()[0]!;
    const d = cdDoubleOrder(oct.basis);
    expect(d.length).toBe(16);
    // det = 1 and an integral overlattice L' satisfies index^2 * det(L') = det(L) with det(L') >= 1,
    // so the index is forced to 1. The glue-index sequence over the tower is 1, 2, 4, 1.
    expect(rstr(detRat(gram(d)))).toBe("1");
  }, 60_000);

  it("CONTROL: the root COUNT does not discriminate -- both rank-16 lattices have 480", () => {
    expect(e8PlusE8RootsDoubled().length).toBe(480);
    expect(d16PlusRoots().length).toBe(480);
  });

  it("connectivity does: E8+E8 has two components, D16+ has one", () => {
    expect(componentsOfIntegerRoots(e8PlusE8RootsDoubled())).toBe(2);
    expect(componentsOfIntegerRoots(d16PlusRoots())).toBe(1);
  }, 60_000);

  it("so the CD route is BLIND to D16+: its output stays decomposable at rank 16", () => {
    // At ranks 4 and 8 the completion fused the generator's orthogonal sum into one component.
    // At rank 16 there is no completion left to do it, so the pattern 4 -> 1, 2 -> 1 becomes 2 -> 2.
    const oct = octavianCompletions()[0]!;
    const d = cdDoubleOrder(oct.basis);
    const g = gram(d);
    for (let i = 0; i < 8; i++) for (let j = 8; j < 16; j++) expect(g[i]![j]!.n).toBe(0n);
  }, 60_000);
});

describe("sanity: the arithmetic is exact and the helpers agree with each other", () => {
  it("conjugation and norm satisfy x conj(x) = N(x) on the octonions", () => {
    const e = cdBasis(8);
    for (let i = 0; i < 8; i++) {
      for (let j = i; j < 8; j++) {
        const x = vadd(e[i]!, e[j]!);
        const xx = cdMul(x, cdConj(x));
        expect(req(xx[0]!, cdNorm(x))).toBe(true);
        expect(xx.slice(1).every((c) => c.n === 0n)).toBe(true);
      }
    }
  });

  it("the Hurwitz order has 24 units and they are exactly its roots", () => {
    expect(roots(hurwitzOrder(), 2).length).toBe(24);
  }, 60_000);
});
