import type { Grid } from "./grid-skills.ts";

export interface EvaluationResult {
  accuracy: number; // 0.0 to 100.0
  diffPixels: number;
  totalPixels: number;
}

export function evaluateGrid(actual: Grid, expected: Grid): EvaluationResult {
  // Rows are read through local bindings rather than indexed twice. Under
  // `noUncheckedIndexedAccess` every `grid[i]` is `Row | undefined`, and the original code indexed
  // straight through (`actual[0].length`, `actual[r][c]`) — which typechecks only if you assume
  // the index is in range. For a ragged or shorter `actual` that assumption is exactly what fails,
  // and this function's whole job is comparing grids that may not match.
  const expectedFirst = expected[0];
  const actualFirst = actual[0];
  if (
    actual.length !== expected.length ||
    (expectedFirst !== undefined && actualFirst?.length !== expectedFirst.length)
  ) {
    return { accuracy: 0, diffPixels: -1, totalPixels: 0 };
  }

  let totalPixels = 0;
  let correctPixels = 0;

  for (let r = 0; r < expected.length; r++) {
    const expectedRow = expected[r];
    const actualRow = actual[r];
    if (expectedRow === undefined) continue;
    for (let c = 0; c < expectedRow.length; c++) {
      totalPixels++;
      // A missing cell counts as a mismatch rather than throwing: a ragged row is a wrong answer,
      // not a crash, and scoring is meant to survive whatever the solver produced.
      if (actualRow?.[c] === expectedRow[c]) {
        correctPixels++;
      }
    }
  }

  const accuracy = totalPixels === 0 ? 100 : (correctPixels / totalPixels) * 100;

  return {
    accuracy,
    diffPixels: totalPixels - correctPixels,
    totalPixels
  };
}
