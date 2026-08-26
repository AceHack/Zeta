// Finite representation-defect spectrum for the four Adinkra/Clifford lanes.
//
// Design rule: only lanes exposing both an operator algebra and a carrier receive a numerical
// rank-one defect. The spinorial E8 decomposition is deliberately `unmeasured`: 120 + 128 = 248
// checks dimensions, but does not supply an algebra-to-carrier module map.

import {
  PRIMES,
  algebraDimension,
  buildCodedAdinkra,
  enumerateCode,
  freeOverSubalgebra,
  popcount,
  type Mask,
} from "./regular-representation-defect";

export const EXT_HAMMING_8_4_4_ROWS = [
  [1, 0, 0, 0, 0, 1, 1, 1],
  [0, 1, 0, 0, 1, 0, 1, 1],
  [0, 0, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 1, 1, 1, 0],
] as const;

export const EXT_HAMMING_8_4_4_MASKS: Mask[] = EXT_HAMMING_8_4_4_ROWS.map((row) =>
  row.reduce<number>((mask, bit, index) => mask | (bit << index), 0),
);

export interface MeasuredRegularity {
  readonly status: "measured";
  readonly carrierDimension: number;
  readonly operatorDimension: number;
  readonly defect: number;
  readonly freeRankOne: boolean;
}

export interface UnmeasuredRegularity {
  readonly status: "unmeasured";
  readonly reason: string;
  readonly missingWitnesses: readonly string[];
}

export type RegularityMeasurement = MeasuredRegularity | UnmeasuredRegularity;

export interface FullColourLane {
  readonly id: "uncoded-cube" | "coded-quotient";
  readonly colourCount: number;
  readonly codeDimension: number;
  readonly codewordCount: number;
  readonly regularity: MeasuredRegularity;
}

export interface ColourResidueWitness {
  readonly colours: readonly number[];
  readonly colourMask: number;
  readonly orbitRank: number;
  readonly freeRankOne: boolean;
}

export interface ColouredResidueLane {
  readonly id: "coloured-residue";
  readonly colourCount: number;
  readonly selectedColourCount: number;
  readonly candidateSubsetCount: number;
  readonly workingSubsetCount: number;
  readonly failingSubsetCount: number;
  readonly perColourWorkingInclusions: readonly number[];
  readonly canonicalSelection: false;
  readonly witnesses: readonly ColourResidueWitness[];
  readonly regularity: MeasuredRegularity;
}

export interface BivectorSpinorLane {
  readonly id: "bivector-spinor";
  readonly ambientVectorDimension: 16;
  readonly bivectorDimension: 120;
  readonly halfSpinorDimension: 128;
  readonly totalDimension: 248;
  readonly quotientApplied: false;
  readonly regularity: UnmeasuredRegularity;
}

export interface RepresentationDefectSpectrum {
  readonly uncoded: FullColourLane;
  readonly coded: FullColourLane;
  readonly colouredResidue: ColouredResidueLane;
  readonly bivectorSpinor: BivectorSpinorLane;
}

function choose(values: readonly number[], count: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, picked: number[]): void => {
    if (picked.length === count) {
      out.push(picked);
      return;
    }
    for (let index = start; index < values.length; index++) {
      const value = values[index];
      if (value !== undefined) walk(index + 1, [...picked, value]);
    }
  };
  walk(0, []);
  return out;
}

function colourMask(colours: readonly number[]): number {
  return colours.reduce((mask, colour) => mask | (1 << colour), 0);
}

function measured(carrierDimension: number, operatorDimension: number): MeasuredRegularity {
  return {
    status: "measured",
    carrierDimension,
    operatorDimension,
    defect: operatorDimension / carrierDimension,
    freeRankOne: operatorDimension === carrierDimension,
  };
}

export function requireMeasuredRegularity(measurement: RegularityMeasurement): MeasuredRegularity {
  if (measurement.status === "unmeasured") {
    throw new Error(`regularity is unmeasured: ${measurement.reason}`);
  }
  return measurement;
}

export function measureRepresentationDefectSpectrum(
  square: 1 | -1 = -1,
  prime: number = PRIMES[0],
): RepresentationDefectSpectrum {
  const uncoded = buildCodedAdinkra(8, [], square);
  const coded = buildCodedAdinkra(8, EXT_HAMMING_8_4_4_MASKS, square);

  const candidateSubsets = choose(
    Array.from({ length: coded.n }, (_, index) => index),
    coded.n - coded.k,
  );
  const witnesses: ColourResidueWitness[] = candidateSubsets.map((colours) => {
    const orbitRank = freeOverSubalgebra(coded, colours, prime);
    return {
      colours,
      colourMask: colourMask(colours),
      orbitRank,
      freeRankOne: orbitRank === coded.reps.length,
    };
  });
  const working = witnesses.filter((witness) => witness.freeRankOne);
  const perColourWorkingInclusions = Array.from(
    { length: coded.n },
    (_, colour) => working.filter((witness) => witness.colours.includes(colour)).length,
  );

  const bivectorDimension = (16 * 15) / 2;
  const halfSpinorDimension = 2 ** (16 / 2 - 1);
  const totalDimension = bivectorDimension + halfSpinorDimension;
  if (totalDimension !== 248) throw new Error(`unexpected spinorial E8 dimension: ${totalDimension}`);

  return {
    uncoded: {
      id: "uncoded-cube",
      colourCount: uncoded.n,
      codeDimension: 0,
      codewordCount: 1,
      regularity: measured(uncoded.reps.length, algebraDimension(uncoded, prime)),
    },
    coded: {
      id: "coded-quotient",
      colourCount: coded.n,
      codeDimension: coded.k,
      codewordCount: enumerateCode(EXT_HAMMING_8_4_4_MASKS).length,
      regularity: measured(coded.reps.length, algebraDimension(coded, prime)),
    },
    colouredResidue: {
      id: "coloured-residue",
      colourCount: coded.n,
      selectedColourCount: coded.n - coded.k,
      candidateSubsetCount: witnesses.length,
      workingSubsetCount: working.length,
      failingSubsetCount: witnesses.length - working.length,
      perColourWorkingInclusions,
      canonicalSelection: false,
      witnesses,
      regularity: measured(coded.reps.length, 1 << (coded.n - coded.k)),
    },
    bivectorSpinor: {
      id: "bivector-spinor",
      ambientVectorDimension: 16,
      bivectorDimension: 120,
      halfSpinorDimension: 128,
      totalDimension,
      quotientApplied: false,
      regularity: {
        status: "unmeasured",
        reason: "120 + 128 = 248 is a decomposition, not an algebra-to-carrier regular-module map",
        missingWitnesses: [
          "an implemented finite basis and Lie bracket",
          "a declared carrier module",
          "an explicit action of the operator algebra on that carrier",
          "an injectivity and rank-one-freeness test",
        ],
      },
    },
  };
}

export function codewordSupportMasks(): readonly number[] {
  return enumerateCode(EXT_HAMMING_8_4_4_MASKS)
    .filter((word) => word !== 0)
    .map((word) => word)
    .filter((word) => popcount(word) === 4);
}
