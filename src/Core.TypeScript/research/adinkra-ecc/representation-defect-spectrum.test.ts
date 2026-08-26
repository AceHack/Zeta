import { describe, expect, test } from "bun:test";
import { PRIMES } from "./regular-representation-defect";
import {
  codewordSupportMasks,
  measureRepresentationDefectSpectrum,
  requireMeasuredRegularity,
} from "./representation-defect-spectrum";

describe("finite Adinkra representation-defect spectrum", () => {
  test("the uncoded and coded full-colour lanes expose defects 1 and 16 by matrix/coset comparison", () => {
    const spectrum = measureRepresentationDefectSpectrum();

    expect(spectrum.uncoded.regularity).toEqual({
      status: "measured",
      carrierDimension: 256,
      operatorDimension: 256,
      defect: 1,
      freeRankOne: true,
    });
    expect(spectrum.coded.codeDimension).toBe(4);
    expect(spectrum.coded.codewordCount).toBe(16);
    expect(spectrum.coded.regularity).toEqual({
      status: "measured",
      carrierDimension: 16,
      operatorDimension: 256,
      defect: 16,
      freeRankOne: false,
    });
  });

  test("the measured full-lane defects are stable across both finite-field rank primes", () => {
    const [first, second] = PRIMES.map((prime) => measureRepresentationDefectSpectrum(-1, prime));
    expect(first?.uncoded.regularity).toEqual(second?.uncoded.regularity);
    expect(first?.coded.regularity).toEqual(second?.coded.regularity);
    expect(first?.colouredResidue.regularity).toEqual(second?.colouredResidue.regularity);
  });

  test("the coloured residue is a non-canonical family: 56 working subsets and balanced colours", () => {
    const residue = measureRepresentationDefectSpectrum().colouredResidue;

    expect(residue.selectedColourCount).toBe(4);
    expect(residue.candidateSubsetCount).toBe(70);
    expect(residue.workingSubsetCount).toBe(56);
    expect(residue.failingSubsetCount).toBe(14);
    expect(residue.perColourWorkingInclusions).toEqual([28, 28, 28, 28, 28, 28, 28, 28]);
    expect(residue.canonicalSelection).toBe(false);
    expect(residue.regularity).toEqual({
      status: "measured",
      carrierDimension: 16,
      operatorDimension: 16,
      defect: 1,
      freeRankOne: true,
    });
  });

  test("fault control: every weight-four codeword support is a failing colour subset", () => {
    const residue = measureRepresentationDefectSpectrum().colouredResidue;
    const byMask = new Map(residue.witnesses.map((witness) => [witness.colourMask, witness]));

    const supports = codewordSupportMasks();
    expect(supports).toHaveLength(14);
    for (const support of supports) {
      const witness = byMask.get(support);
      expect(witness).toBeDefined();
      expect(witness?.freeRankOne).toBe(false);
      expect(witness?.orbitRank).toBeLessThan(16);
    }
  });

  test("fault control: a working subset becomes non-free when replaced by a codeword support", () => {
    const residue = measureRepresentationDefectSpectrum().colouredResidue;
    const working = residue.witnesses.find((witness) => witness.freeRankOne);
    const failing = residue.witnesses.find((witness) => !witness.freeRankOne);

    expect(working).toBeDefined();
    expect(working?.orbitRank).toBe(16);
    expect(failing).toBeDefined();
    expect(failing?.orbitRank).toBeLessThan(16);
  });

  test("the non-quotient bivector/spinor lane refuses a fabricated regularity score", () => {
    const lane = measureRepresentationDefectSpectrum().bivectorSpinor;

    expect(lane.quotientApplied).toBe(false);
    expect(lane.bivectorDimension).toBe(120);
    expect(lane.halfSpinorDimension).toBe(128);
    expect(lane.totalDimension).toBe(248);
    expect(lane.regularity.status).toBe("unmeasured");
    expect(() => requireMeasuredRegularity(lane.regularity)).toThrow("regularity is unmeasured");
  });
});
