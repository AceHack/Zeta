import type { Grid } from "./grid-skills.ts";

export interface EvaluationResult {
  accuracy: number; // 0.0 to 100.0
  diffPixels: number;
  totalPixels: number;
}

export function evaluateGrid(actual: Grid, expected: Grid): EvaluationResult {
  // If dimensions mismatch, accuracy is 0
  if (actual.length !== expected.length || (expected.length > 0 && actual[0].length !== expected[0].length)) {
    return { accuracy: 0, diffPixels: -1, totalPixels: 0 };
  }

  let totalPixels = 0;
  let correctPixels = 0;

  for (let r = 0; r < expected.length; r++) {
    for (let c = 0; c < expected[r].length; c++) {
      totalPixels++;
      if (actual[r][c] === expected[r][c]) {
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
