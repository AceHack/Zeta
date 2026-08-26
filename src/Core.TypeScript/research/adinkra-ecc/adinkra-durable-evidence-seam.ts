/**
 * adinkra-durable-evidence-seam.ts — finite fault-domain model for the
 * `[8,4,4]` room-evidence transport seam.
 *
 * This classifier is intentionally independent of the UDP decoder. It states
 * which coordinate-erasure patterns uniquely identify a codeword. The channel
 * tests compare the real receiver against this model pattern by pattern.
 */

export const ADINKRA_844_SYMBOL_COUNT = 8;

/**
 * Supports of the fourteen non-zero weight-four codewords, represented as
 * coordinate bitmasks. The remaining non-zero codeword is the all-ones word.
 */
export const ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS: readonly number[] = [
  0b1110_0001, 0b1101_0010, 0b1011_0100, 0b0111_1000, 0b0011_0011, 0b0101_0101, 0b1001_1001, 0b0110_0110, 0b1010_1010,
  0b1100_1100, 0b1000_0111, 0b0100_1011, 0b0010_1101, 0b0001_1110,
];

const ambiguousWeight4 = new Set(ADINKRA_844_AMBIGUOUS_WEIGHT4_MASKS);

export type Adinkra844ErasureStatus = "identifiable" | "ambiguous-codeword-support" | "underdetermined";

export interface Adinkra844ErasureClassification {
  readonly mask: number;
  readonly erasedCount: number;
  readonly status: Adinkra844ErasureStatus;
}

function erasedCount(mask: number): number {
  let value = mask;
  let count = 0;
  while (value !== 0) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}

/**
 * Classify one of the 256 coordinate-erasure patterns.
 *
 * Every pattern of at most `d - 1 = 3` erasures is identifiable. A four-erasure
 * pattern is ambiguous exactly when it is the support of a non-zero weight-four
 * codeword. Five or more erasures leave fewer than the four message dimensions
 * visible and are underdetermined.
 */
export function classifyAdinkra844ErasureMask(mask: number): Adinkra844ErasureClassification {
  if (!Number.isInteger(mask) || mask < 0 || mask >= 1 << ADINKRA_844_SYMBOL_COUNT) {
    throw new RangeError(`erasure mask must be an integer in [0, ${(1 << ADINKRA_844_SYMBOL_COUNT) - 1}]`);
  }
  const count = erasedCount(mask);
  const status: Adinkra844ErasureStatus =
    count <= 3
      ? "identifiable"
      : count === 4 && !ambiguousWeight4.has(mask)
        ? "identifiable"
        : count === 4
          ? "ambiguous-codeword-support"
          : "underdetermined";
  return { mask, erasedCount: count, status };
}

export function adinkra844ErasureCensus(): readonly string[] {
  const rows = new Map<number, { identifiable: number; total: number }>();
  for (let mask = 0; mask < 1 << ADINKRA_844_SYMBOL_COUNT; mask++) {
    const classification = classifyAdinkra844ErasureMask(mask);
    const row = rows.get(classification.erasedCount) ?? { identifiable: 0, total: 0 };
    row.total++;
    if (classification.status === "identifiable") row.identifiable++;
    rows.set(classification.erasedCount, row);
  }
  return [...rows.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([count, row]) => `${count}: ${row.identifiable}/${row.total}`);
}
