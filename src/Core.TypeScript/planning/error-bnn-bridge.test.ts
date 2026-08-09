import { describe, expect, test } from "bun:test";
import { teachingError, type ErrorMirror } from "../protocol/error-envelope";
import { absorbError, createDimensionalBnn, dimensionPosterior } from "./error-bnn-bridge";

const mirror: ErrorMirror = {
  what: "predictedDeadline",
  why: "the field was absent",
  howToFix: "provide predictedDeadline",
  dimension: "schema",
  severity: "fatal",
  retractableBeliefId: "belief-1",
};
const EMITTED_AT = "2026-08-09T00:00:00.000Z";

describe("dimensional error BNN", () => {
  test("creates one configured Student-t state per error dimension", () => {
    const bnn = createDimensionalBnn(7, 0.25);

    expect(bnn.states).toHaveLength(9);
    expect(bnn.states.get("schema")?.nu).toBe(7);
    expect(bnn.states.get("schema")?.obsVariance).toBe(0.25);
    expect(dimensionPosterior(bnn, "schema").robustnessWeight).toBe(1);
  });

  test("updates only the named dimension and retains the actual robustness weight", () => {
    const bnn = createDimensionalBnn();
    const result = absorbError(bnn, teachingError("correlation-1", mirror, EMITTED_AT));

    expect(result).not.toBeNull();
    const update = result!;
    expect(update.dimension).toBe("schema");
    expect(update.isRetraction).toBe(true);
    expect(dimensionPosterior(bnn, "schema").robustnessWeight).toBe(update.result.robustnessWeight);
    expect(bnn.states.get("type")?.obsCount).toBe(0);
  });

  test("does not update twice when an envelope is redelivered", () => {
    const bnn = createDimensionalBnn();
    const envelope = teachingError("correlation-2", mirror, EMITTED_AT);

    expect(absorbError(bnn, envelope)).not.toBeNull();
    expect(absorbError(bnn, envelope)).toBeNull();
    expect(bnn.states.get("schema")?.obsCount).toBe(1);
  });
});
