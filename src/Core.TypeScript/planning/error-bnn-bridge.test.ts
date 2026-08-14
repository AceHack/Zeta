import { describe, expect, test } from "bun:test";
import { teachingError, type ErrorMirror, type ErrorSeverity } from "../protocol/error-envelope";
import {
  absorbError,
  createDimensionalBnn,
  declareTail,
  dimensionPosterior,
  dimensionVerdict,
  tailRungs,
  DEFAULT_ERROR_TAIL,
  GAUSSIAN_LIMIT_NU,
  type DimensionalBnn,
} from "./error-bnn-bridge";
import { createStudentTState, inferStudentT } from "./student-t-bnn";

const mirror: ErrorMirror = {
  what: "predictedDeadline",
  why: "the field was absent",
  howToFix: "provide predictedDeadline",
  dimension: "schema",
  severity: "fatal",
  retractableBeliefId: "belief-1",
};
const EMITTED_AT = "2026-08-09T00:00:00.000Z";

/** Feed a severity stream into one dimension, one distinct envelope per observation. */
function feed(bnn: DimensionalBnn, severities: readonly ErrorSeverity[]): void {
  severities.forEach((severity, i) => {
    absorbError(bnn, teachingError(`corr-${i}`, { ...mirror, severity }, EMITTED_AT));
  });
}

describe("dimensional error BNN", () => {
  test("creates one configured Student-t state per error dimension", () => {
    const bnn = createDimensionalBnn(declareTail("test fixture", 7, 9), 0.25);

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

  // ── The tail assumption ──────────────────────────────────────────────────────

  test("EBB-1: a POINT tail index is not constructible", () => {
    expect(() => declareTail("point", 3, 3)).toThrow(RangeError);
    expect(() => declareTail("inverted", 9, 3)).toThrow(RangeError);
    expect(() => declareTail("infinite", 3, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => declareTail("nonpositive", 0, 9)).toThrow(RangeError);
    expect(() => declareTail("  ", 3, 9)).toThrow(RangeError);
    // and the only way in is the one that carries a reason
    expect(declareTail("because measured", 3, 9).checked).toBe(false);
  });

  test("EBB-2: the default tail is a declared interval that says it is unmeasured", () => {
    expect(DEFAULT_ERROR_TAIL.nuHi).toBeGreaterThan(DEFAULT_ERROR_TAIL.nuLo);
    expect(DEFAULT_ERROR_TAIL.checked).toBe(false);
    expect(DEFAULT_ERROR_TAIL.reason).toContain("UNMEASURED");
    // the heavy endpoint reproduces what the retired point default published, so
    // no number was silently renumbered while the assumption was being widened
    expect(DEFAULT_ERROR_TAIL.nuLo).toBe(3);
  });

  test("EBB-3: rungs are swept uniformly in 1/nu, heaviest first", () => {
    const tail = declareTail("fixture", 4, 100);
    const rungs = tailRungs(tail, 5);
    expect(rungs[0]).toBeCloseTo(4, 12);
    expect(rungs[4]).toBeCloseTo(100, 8);
    // uniform in 1/nu means the reciprocals are equally spaced; uniform in nu
    // would put almost every point where nothing happens
    const inv = rungs.map((n) => 1 / n);
    for (let k = 1; k < inv.length; k++) {
      expect((inv[k] as number) - (inv[k - 1] as number)).toBeCloseTo(
        (inv[1] as number) - (inv[0] as number),
        12,
      );
    }
    expect(() => tailRungs(tail, 1)).toThrow(RangeError);
  });

  test("EBB-4: GAUSSIAN_LIMIT_NU reproduces the closed-form Gaussian conjugate posterior", () => {
    // The light endpoint claims to mean "Gaussian". Graded, not asserted: with a
    // N(0,1) prior and observation variance 1, absorbing n observations gives
    // posterior precision 1 + n and mean (sum y) / (1 + n).
    const ys = [1, 1, 1, 1, 1, 4];
    const folded = inferStudentT(ys, createStudentTState(GAUSSIAN_LIMIT_NU, 0, 1, 1.0));
    const n = ys.length;
    const exactSigma2 = 1 / (1 + n);
    const exactMu = ys.reduce((a, b) => a + b, 0) * exactSigma2;
    expect(folded.state.posterior.mu).toBeCloseTo(exactMu, 9);
    expect(folded.state.posterior.sigma2).toBeCloseTo(exactSigma2, 9);
  });

  // ── The defect: nu was selecting the verdict ─────────────────────────────────

  test("EBB-5: the modal case (one fatal error) IS tail-dependent and is refused", () => {
    // This is the measurement that makes the retired `nu = 3` a live silent vote
    // rather than a latent one: one failed `ace install` is one fatal error on one
    // dimension, and the constant moved the published mean by a factor of two.
    const bnn = createDimensionalBnn();
    feed(bnn, ["fatal"]);

    const verdict = dimensionVerdict(bnn, "schema");
    expect(verdict.kind).toBe("tail-dependent");
    if (verdict.kind !== "tail-dependent") throw new Error("unreachable");
    expect(verdict.muAtHeavyTail).toBeCloseTo(0.970171, 5);
    expect(verdict.muAtLightTail).toBeCloseTo(2.0, 9);
    expect(verdict.moved).toBeGreaterThan(verdict.tightestSigma);
    // and the ungated reader is told, in the same call it already made
    expect(dimensionPosterior(bnn, "schema").tailVerdict).toBe("tail-dependent");
  });

  test("EBB-6: a quorum of agreeing observations survives the same interval", () => {
    // Five modest observations outvote the one extreme: the answer stops being a
    // function of where in the interval you stand, so it may be published.
    const bnn = createDimensionalBnn();
    feed(bnn, ["warn", "warn", "warn", "warn", "warn", "fatal"]);

    const verdict = dimensionVerdict(bnn, "schema");
    expect(verdict.kind).toBe("tail-independent");
    if (verdict.kind !== "tail-independent") throw new Error("unreachable");
    expect(verdict.mu).toBeCloseTo(1.014924, 5);
    expect(verdict.nu).toBe(DEFAULT_ERROR_TAIL.nuLo);
  });

  test("EBB-7: an untouched dimension is tail-independent at the prior", () => {
    // Every rung starts at the same prior, so a dimension nobody observed cannot
    // be tail-dependent. Guards against the gate firing on everything, which
    // would make it decorative.
    const bnn = createDimensionalBnn();
    for (const dim of ["type", "auth", "transport"] as const) {
      expect(dimensionVerdict(bnn, dim).kind).toBe("tail-independent");
    }
  });

  test("EBB-8: the gate is MONOTONE in rung count -- more rungs never buys a pass", () => {
    // The rung count is a resolution knob, not a second silent vote. Adding rungs
    // can only widen the observed spread and tighten the yardstick, so a stream
    // graded tail-dependent at 2 rungs stays tail-dependent at 9, and one graded
    // independent may become dependent but never the reverse.
    const streams: ErrorSeverity[][] = [
      ["fatal"],
      ["warn", "warn", "warn", "warn", "warn", "fatal"],
      ["info", "info", "info", "info", "info", "fatal"],
      ["warn", "warn", "warn"],
      ["error", "error", "fatal", "fatal"],
    ];
    for (const stream of streams) {
      const coarse = createDimensionalBnn(DEFAULT_ERROR_TAIL, 1.0, 2);
      const fine = createDimensionalBnn(DEFAULT_ERROR_TAIL, 1.0, 9);
      feed(coarse, stream);
      feed(fine, stream);
      if (dimensionVerdict(coarse, "schema").kind === "tail-dependent") {
        expect(dimensionVerdict(fine, "schema").kind).toBe("tail-dependent");
      }
    }
  });

  test("EBB-9: a narrower declared interval can publish what the widest cannot", () => {
    // The incentive the discipline exists to create: refusal is not permanent,
    // it is priced. Narrowing the assumption is what buys the answer back — and
    // it costs a measurement, which is exactly the point.
    const wide = createDimensionalBnn(DEFAULT_ERROR_TAIL);
    const narrow = createDimensionalBnn(declareTail("narrowed for the test", 3, 3.5));
    feed(wide, ["fatal"]);
    feed(narrow, ["fatal"]);

    expect(dimensionVerdict(wide, "schema").kind).toBe("tail-dependent");
    expect(dimensionVerdict(narrow, "schema").kind).toBe("tail-independent");
  });

  test("EBB-10: absorbError reports the verdict of the dimension it moved", () => {
    const bnn = createDimensionalBnn();
    const first = absorbError(bnn, teachingError("c-1", mirror, EMITTED_AT));
    expect(first?.tailVerdict).toBe("tail-dependent");

    const quorum = createDimensionalBnn();
    let last: string | undefined;
    ["warn", "warn", "warn", "warn", "warn", "fatal"].forEach((severity, i) => {
      last = absorbError(
        quorum,
        teachingError(`q-${i}`, { ...mirror, severity: severity as ErrorSeverity }, EMITTED_AT),
      )?.tailVerdict;
    });
    expect(last).toBe("tail-independent");
  });
});
