import { describe, expect, test } from "bun:test";
import {
  ADINKRA_DECODER_MUTANTS,
  applyExactAdinkraMutant,
  classifyAdinkraMutationRun,
  runAdinkraDecoderMutationGate,
} from "./adinkra-decoder-mutation-gate";

describe("Adinkra decoder mutation gate", () => {
  test("ADMG-1: the durable-root seam kills every declared decoder mutant", () => {
    const report = runAdinkraDecoderMutationGate(process.cwd());
    expect(report.baselineTests).toBe(9);
    expect(report.outcomes).toHaveLength(4);
    expect(report.outcomes.map((outcome) => outcome.id)).toEqual(ADINKRA_DECODER_MUTANTS.map((mutant) => mutant.id));
    for (const outcome of report.outcomes) expect(outcome.kind).toBe("killed");
  }, 120_000);

  test("ADMG-2: a drifted or duplicated exact mutation site is refused", () => {
    const mutant = ADINKRA_DECODER_MUTANTS[0]!;
    expect(() => applyExactAdinkraMutant("no matching decoder guard", mutant)).toThrow("found 0");
    const duplicated = `${mutant.patches[0]!.find}\n${mutant.patches[0]!.find}`;
    expect(() => applyExactAdinkraMutant(duplicated, mutant)).toThrow("found 2");
  });

  test("ADMG-3: an unrelated crash is unresolved rather than credited as a killed mutant", () => {
    const mutant = ADINKRA_DECODER_MUTANTS[0]!;
    expect(
      classifyAdinkraMutationRun(mutant, {
        status: 1,
        signal: null,
        tests: 0,
        output: "unrelated module resolution failure",
        error: undefined,
      }),
    ).toEqual({
      kind: "unresolved",
      id: mutant.id,
      why: `suite failed without the expected ${mutant.expectedFailure} witness`,
    });
  });
});
