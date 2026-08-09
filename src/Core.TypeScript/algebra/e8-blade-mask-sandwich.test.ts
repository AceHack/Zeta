import { describe, expect, test } from "bun:test";

import { e8Roots, gp, measure, reverse } from "./e8-blade-mask-sandwich";

// FROZEN-CORE §B measurement — golden numbers. These constants ARE the banked
// result (2026-08-09): re-running the measurement must reproduce them bit-for-
// bit (integer arithmetic throughout; DST-trivially deterministic).

describe("construction fidelity (against the F# oracles' definitions)", () => {
  test("Construction A over the [8,4] code yields the 240 roots, all norm² = 4", () => {
    const roots = e8Roots();
    expect(roots).toHaveLength(240);
    expect(roots.every((r) => r.reduce((a, c) => a + c * c, 0) === 4)).toBe(true);
    // 16 even + 14·16 odd, and no duplicates.
    expect(new Set(roots.map((r) => r.join(","))).size).toBe(240);
  });

  test("Cl(3,0) product sanity: e1·e1 = 1, e1·e2 = e12 = −e2·e1", () => {
    const e1 = [0, 1, 0, 0, 0, 0, 0, 0];
    const e2 = [0, 0, 1, 0, 0, 0, 0, 0];
    expect(gp(e1, e1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(gp(e1, e2)).toEqual([0, 0, 0, 1, 0, 0, 0, 0]);
    expect(gp(e2, e1)).toEqual([0, 0, 0, -1, 0, 0, 0, 0]);
    // reverse flips grade-2/3 blades only
    expect(reverse([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([1, 2, 3, -4, 5, -6, -7, -8]);
  });
});

describe("the measurement — golden numbers, banked 2026-08-09", () => {
  const m = measure();

  test("baseline: classical R⁸ reflection preserves ALL 57,600 pairs (theorem check)", () => {
    expect(m.classicalPreserved).toBe(57600);
  });

  test("exactly 32 bridged roots are versor-normed, on exactly 10 supports", () => {
    expect(m.versorNormedCount).toBe(32);
    // The 8 single blades + the two Clifford-aligned weight-4 codewords:
    // {1,2,5,6} = {e1,e2,e13,e23} and {0,3,4,7} = {S,e12,e3,e123} — the
    // XOR-closed subgroup {0,3,4,7} (subalgebra of e12,e3) and its coset.
    expect(m.versorNormedSupports).toEqual([
      "0",
      "0+3+4+7",
      "1",
      "1+2+5+6",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
  });

  test("the versor-normed 32 preserve ALL roots — a perfect symmetry fragment", () => {
    expect(m.versorPreserved).toBe(32 * 240);
  });

  test("the sandwich is NOT a reflection action: 11,776 of 57,600 pairs preserved", () => {
    expect(m.integerImages).toBe(33024);
    expect(m.rootImages).toBe(11776);
    expect(m.identityFixedPairs).toBe(352);
  });

  test("quantized per-A preservation: {0:160, 64:32, 128:16, 240:32}", () => {
    expect(m.perAHistogram).toEqual([
      [0, 160],
      [64, 32],
      [128, 16],
      [240, 32],
    ]);
  });
});

describe("Part II — the fragment group and the quantization strata (2026-08-09)", () => {
  test("the 32 generate a group of order 16 ≅ D8 × C2 (invariant profile)", async () => {
    const { fragmentGroup } = await import("./e8-blade-mask-sandwich");
    const g = fragmentGroup();
    expect(g.generatorCount).toBe(32); // A and −A induce the same sandwich
    expect(g.order).toBe(16);
    expect(g.orderHistogram).toEqual([
      [1, 1],
      [2, 11], // 11 involutions — unique to D8 × C2 among order-16 groups
      [4, 4],
    ]);
    expect(g.centerSize).toBe(4);
    expect(g.commutatorCount).toBe(2); // |G'| = 2 — nilpotency class 2
  });

  test("quantization strata follow subalgebra signature", async () => {
    const { strataBySupport } = await import("./e8-blade-mask-sandwich");
    const strata = new Map(strataBySupport());
    // Cl(1,1)-signature subgroup <e12,e3> = {0,3,4,7} and its coset {1,2,5,6}:
    // half the sign patterns are versors preserving 240, the other half 128.
    expect(strata.get("0+3+4+7 [versor]")).toEqual([[240, 8]]);
    expect(strata.get("0+3+4+7")).toEqual([[128, 8]]);
    expect(strata.get("1+2+5+6 [versor]")).toEqual([[240, 8]]);
    expect(strata.get("1+2+5+6")).toEqual([[128, 8]]);
    // Cl(2,0)-signature subgroups <e1,e3> = {0,1,4,5}, <e2,e3> = {0,2,4,6}
    // and their cosets {2,3,6,7}, {1,3,5,7}: half 64, half 0, no versors.
    for (const label of ["0+1+4+5", "0+2+4+6", "1+3+5+7", "2+3+6+7"]) {
      expect(strata.get(label)).toEqual([[0, 8], [64, 8]]);
    }
    // The eight non-subgroup-coset codewords preserve nothing.
    for (const label of [
      "0+1+2+7", "0+1+3+6", "0+2+3+5", "0+5+6+7",
      "1+2+3+4", "1+4+6+7", "2+4+5+7", "3+4+5+6",
    ]) {
      expect(strata.get(label)).toEqual([[0, 16]]);
    }
  });
});
