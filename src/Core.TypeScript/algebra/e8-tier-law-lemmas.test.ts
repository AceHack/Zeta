import { describe, expect, test } from "bun:test";

import { allCodewords, e8Roots, gp, reverse } from "./e8-blade-mask-sandwich";

// Part V lemma pins (docs/research/2026-08-12-e8-tier-law-part-v-…md):
// the derivation's load-bearing lemmas, each machine-checked against the
// SAME oracle the Parts I–IV goldens live on. A lemma marked [proved] in
// the doc still gets a pin here — the prose and the oracle must agree.

const roots = e8Roots();
const suppOf = (r: readonly number[]): number[] => r.flatMap((v, i) => (v !== 0 ? [i] : []));

const cwSupports: number[][] = allCodewords()
  .filter((c) => c.reduce((a, b) => a + b, 0) === 4)
  .map((c) => suppOf(c));

const diffSet = (S: readonly number[]): number[] => {
  const H = new Set<number>([0]);
  for (const i of S) for (const j of S) H.add(i ^ j);
  return [...H].sort((a, b) => a - b);
};

describe("Part V §1 — the tier split IS the coset split", () => {
  test("exactly 6 of 14 weight-4 supports are XOR-cosets; their subgroups are H1, H2, H3", () => {
    const cosets = cwSupports.filter((S) => diffSet(S).length === 4);
    expect(cosets).toHaveLength(6);
    const subgroups = new Set(cosets.map((S) => diffSet(S).join(",")));
    expect([...subgroups].sort()).toEqual(["0,1,4,5", "0,2,4,6", "0,3,4,7"]);
  });

  test("the 8 generic supports have 7-element difference sets (maximally non-coset)", () => {
    const generic = cwSupports.filter((S) => diffSet(S).length !== 4);
    expect(generic).toHaveLength(8);
    for (const S of generic) expect(diffSet(S)).toHaveLength(7);
  });

  test("I acts differently on the tiers: H1 pair I-closed; H2/H3 cosets I-SWAPPED", () => {
    // This is Part II's IC-F1 mechanism: versors need q,r in ONE complex
    // line, and only the H1 subgroup (and its coset) is closed under
    // i ↦ i⊕7. The H2/H3 cosets are exchanged by I — no complex line, no
    // versor (Part III L1b).
    for (const S of cwSupports.filter((s) => diffSet(s).length === 4)) {
      const iImage = S.map((m) => m ^ 7).sort((a, b) => a - b);
      const key = diffSet(S).join(",");
      if (key === "0,3,4,7") {
        expect(iImage).toEqual([...S].sort((a, b) => a - b)); // I-closed
      } else {
        // I swaps the coset with its complement (same subgroup)
        expect(iImage.join(",")).not.toBe([...S].sort((a, b) => a - b).join(","));
        expect(diffSet(iImage).join(",")).toBe(key);
      }
    }
  });
});

describe("Part V §2–§3 — support-coset lemma and coefficient quantization", () => {
  test("image of every blade under every odd-root sandwich lies on the coset m⊕D(S)", () => {
    for (const A of roots) {
      const S = suppOf(A);
      if (S.length !== 4) continue;
      const D = diffSet(S);
      const Ar = reverse(A);
      for (let m = 0; m < 8; m += 1) {
        const blade = Array.from({ length: 8 }, (_, i) => (i === m ? 1 : 0));
        const img = gp(gp(A, blade), Ar).map((v) => -v / 4);
        for (let n = 0; n < 8; n += 1) {
          if (img[n] !== 0) expect(D).toContain(n ^ m);
        }
      }
    }
  });

  test("all sandwiched-blade coefficients lie in {0, ±1/2, ±1} — nothing can rebuild a ±2", () => {
    const seen = new Set<number>();
    for (const A of roots) {
      if (suppOf(A).length !== 4) continue;
      const Ar = reverse(A);
      for (let m = 0; m < 8; m += 1) {
        const blade = Array.from({ length: 8 }, (_, i) => (i === m ? 1 : 0));
        for (const v of gp(gp(A, blade), Ar).map((x) => -x / 4)) seen.add(v);
      }
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
});

describe("Part V §4 — the aligned non-versor ℤ[c] arithmetic (H1 supports)", () => {
  // H1-coset supports {0,3,4,7} and {1,2,5,6}: q = d0 + d1·c, r = d2 + d3·c.
  // Non-versor ⟺ d0d3 = d1d2, and then q²+r² = 4·d0d1·c and |q|² = |r|² = 2.
  const H1_SUPPORTS = [
    [0, 3, 4, 7],
    [1, 2, 5, 6],
  ] as const;

  test("non-versor relation forces d0d2 = d1d3 and d2d3 = d0d1 (the derived identities)", () => {
    for (let s = 0; s < 16; s += 1) {
      const d = [0, 1, 2, 3].map((k) => ((s >> k) & 1 ? -1 : 1));
      if (d[0]! * d[3]! !== d[1]! * d[2]!) continue; // versors excluded
      expect(d[0]! * d[2]!).toBe(d[1]! * d[3]!);
      expect(d[2]! * d[3]!).toBe(d[0]! * d[1]!);
    }
  });

  test("A·Ã of an H1 non-versor is 4 + pure residue of total magnitude 4 (the ±4c form)", () => {
    for (const support of H1_SUPPORTS) {
      for (let s = 0; s < 16; s += 1) {
        const A = new Array<number>(8).fill(0);
        support.forEach((m, k) => {
          A[m] = (s >> k) & 1 ? -1 : 1;
        });
        const d = support.map((m) => A[m]!);
        if (d[0]! * d[3]! === -(d[1]! * d[2]!)) continue; // versors excluded
        const aa = gp(A, reverse(A));
        expect(aa[0]).toBe(4); // |q|² + |r|²
        const residue = aa.slice(1).filter((v) => v !== 0);
        expect(residue.length).toBeGreaterThan(0);
        // 2·Vec(rq̄) with the parity relation: total residue magnitude 4
        expect(residue.reduce((a, v) => a + Math.abs(v), 0)).toBe(4);
      }
    }
  });
});
