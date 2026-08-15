import { describe, expect, test } from "bun:test";
import { teachingError, type ErrorSeverity } from "../protocol/error-envelope";
import { mergePriorHint, type PriorHint } from "../protocol/batch-teaching-envelope";
import { MAX_TEMPERATURE_PPM, WARM_TEMPERATURE_MAX_PPM, type TemperatureBand } from "../darkhall-ui/heat";
import { absorbError, createDimensionalBnn, type DimensionalBnn } from "./error-bnn-bridge";
import {
  declareBand,
  declareTrend,
  dimensionBelief,
  evidenceBackedPriorHints,
  severityPpm,
  transportHeatReadout,
} from "./society-heat-readout";

const EMITTED_AT = "2026-08-14T00:00:00.000Z";
const SENDER = "society-runner";

/** Absorb `count` transport errors of one severity into a fresh BNN. */
function transportStream(count: number, severity: ErrorSeverity): DimensionalBnn {
  const bnn = createDimensionalBnn();
  for (let i = 0; i !== count; i += 1) {
    const payload = {
      what: "transport",
      why: "a measured stream",
      howToFix: "none",
      dimension: "transport" as const,
      severity,
    };
    absorbError(bnn, teachingError(`corr-${i}`, payload, EMITTED_AT));
  }
  return bnn;
}

describe("a prior is not evidence: what the society may publish", () => {
  // SHR-1. The defect verbatim: the runner published a BNN that absorbed nothing.
  // All 567 hint slots across the 82 evolution events on main carry mu = 0.
  test("SHR-1: a BNN that absorbed nothing publishes NO hints", () => {
    const bnn = createDimensionalBnn();
    expect(evidenceBackedPriorHints(bnn, SENDER)).toEqual([]);
  });

  // SHR-2. obsCount was the literal 0 in the old runner, so it would have kept
  // saying 0 after the BNN learned something -- disarming the receiver guard
  // exactly when it began to matter. It is now read from the state.
  test("SHR-2: a published hint carries the REAL obsCount, not a literal", () => {
    const bnn = transportStream(6, "warn");
    const hints = evidenceBackedPriorHints(bnn, SENDER);
    expect(hints).toHaveLength(1);
    expect(hints[0]!.dimension).toBe("transport");
    expect(hints[0]!.obsCount).toBe(6);
    expect(hints[0]!.senderZid).toBe(SENDER);
  });
  // SHR-3. Withholding is per-dimension, not all-or-nothing: an observed
  // dimension publishes while its eight unobserved siblings stay silent.
  test("SHR-3: only observed dimensions are published", () => {
    const bnn = transportStream(3, "error");
    const hints = evidenceBackedPriorHints(bnn, SENDER);
    expect(hints.map((h) => h.dimension)).toEqual(["transport"]);
    expect(dimensionBelief(bnn, "schema").evidence).toBe("prior");
    expect(dimensionBelief(bnn, "transport").evidence).toBe("posterior");
  });
});

describe("the receiver half: a hint with no observations buys no precision", () => {
  const unobserved: PriorHint = {
    dimension: "transport",
    mu: 0,
    sigma2: 1,
    robustnessWeight: 1,
    obsCount: 0,
    senderZid: SENDER,
  };

  // SHR-4. Measured against the OLD mergePriorHint: 82 of these (the count
  // already on main) took a receiver from sigma 1.0 to 0.154303, precision 1 to
  // 42, from messages carrying zero observations. Unbounded, and the heartbeat
  // runs every 30 minutes forever.
  test("SHR-4: 82 zero-observation hints move the belief by exactly nothing", () => {
    let local = { mu: 0, sigma2: 1 };
    for (let k = 0; k !== 82; k += 1) local = mergePriorHint(local, unobserved, 0.5);
    expect(local.sigma2).toBe(1);
    expect(local.mu).toBe(0);
  });
  // SHR-5. The guard must not be a blanket disable -- a hint that DID absorb
  // observations still sharpens the receiver, and by the documented EP arithmetic.
  test("SHR-5: an evidence-backed hint still merges, at the EP precision sum", () => {
    const observed: PriorHint = { ...unobserved, mu: 2, obsCount: 6 };
    const merged = mergePriorHint({ mu: 0, sigma2: 1 }, observed, 0.5);
    expect(merged.sigma2).toBeCloseTo(1 / 1.5, 12);
    expect(merged.mu).toBeCloseTo(1 / 1.5, 12);
  });

  // SHR-6. Idempotency (#6) is NOT restored by the guard: a hint that carries
  // observations still compounds under redelivery, because mergePriorHint has no
  // dedup key. Pinned so the guard is not misread as having fixed that too.
  test("SHR-6: an evidence-backed hint still compounds under redelivery", () => {
    const observed: PriorHint = { ...unobserved, obsCount: 6 };
    const once = mergePriorHint({ mu: 0, sigma2: 1 }, observed, 0.5);
    const twice = mergePriorHint(once, observed, 0.5);
    expect(twice.sigma2).toBeLessThan(once.sigma2);
  });
});

describe("the band ladder: reachable, bounded, and refusable", () => {
  // SHR-7. mu is a severity z-score, not a rate. The old map mu * 1e6 published
  // 1,940,259 ppm for a steady stream of ordinary errors -- 194% of a fraction,
  // against a maximum of 1,000,000.
  test("SHR-7: ppm never exceeds the scale maximum, even past fatal", () => {
    for (const mu of [0, 0.5, 1, 1.940259, 4, 40, Infinity, NaN, -1]) {
      const ppm = severityPpm(mu);
      expect(ppm).toBeGreaterThanOrEqual(0);
      expect(ppm).toBeLessThanOrEqual(MAX_TEMPERATURE_PPM);
    }
    const errorStream = transportHeatReadout(transportStream(20, "error"));
    expect(errorStream.transportMu).toBeGreaterThan(1.9);
    expect(errorStream.transportPpm).toBeLessThanOrEqual(MAX_TEMPERATURE_PPM);
  });
  // SHR-8. The old wiring reached only {cold, critical}: warm and hot were
  // structurally unreachable while a comment advertised a four-band ladder.
  // Same shape as #10553 -- an unreachable verdict that looks like a property of
  // the model and is a property of the bug.
  test("SHR-8: all four bands are reachable from some mu", () => {
    const reached = new Set<TemperatureBand>();
    for (let i = 0; i !== 4001; i += 1) reached.add(declareBand(i / 1000, 0).pointBand);
    expect([...reached].sort()).toEqual(["cold", "critical", "hot", "warm"]);
  });

  // SHR-9. The consequence of SHR-8 in the domain: under the old wiring a
  // warn-only stream and a fatal-only stream both read critical, so the readout
  // could not tell a nuisance from an emergency.
  test("SHR-9: a warn-only stream and a fatal-only stream do NOT read alike", () => {
    const warm = transportHeatReadout(transportStream(20, "warn"));
    const bad = transportHeatReadout(transportStream(20, "fatal"));
    expect(warm.pointBand).not.toBe(bad.pointBand);
    expect(warm.transportPpm).toBeLessThan(bad.transportPpm);
  });
  // SHR-10. The reported defect: four cut-points 0.1 apart in mu against a sigma
  // of 0.377964 at six observations (0.265 sigma) and 1.0 at the prior (0.100
  // sigma). A band whose plus/minus-1-sigma interval straddles an edge is refused.
  test("SHR-10: the band is refused when the error bar straddles an edge", () => {
    const straddling = declareBand(1.3, 0.4);
    expect(straddling.band).toBe("indeterminate");
    expect(straddling.pointBand).toBe("warm");
    expect(straddling.lowBand).not.toBe(straddling.highBand);
  });

  // SHR-11. And it is NOT refused when the belief is tight enough to decide --
  // otherwise the refusal would be vacuous, a check that always fires.
  test("SHR-11: a tight belief inside one band IS declared", () => {
    const tight = declareBand(1.3, 0.001);
    expect(tight.band).toBe("warm");
    expect(tight.pointBand).toBe("warm");
  });
  // SHR-12. The state the runner is ACTUALLY in every tick: the prior, sigma 1.0.
  // No band is decidable there, and the readout says so rather than saying cold.
  test("SHR-12: at the prior the band is indeterminate and the evidence says prior", () => {
    const readout = transportHeatReadout(createDimensionalBnn());
    expect(readout.transportSigma).toBe(1);
    expect(readout.band).toBe("indeterminate");
    expect(readout.pointBand).toBe("cold");
    expect(readout.evidence).toBe("prior");
    expect(readout.obsCount).toBe(0);
  });
});

describe("trend: one sample has no derivative", () => {
  // SHR-13. The old trend was mu > 0.6 ? warming : mu < 0.4 ? recovering : stable
  // -- a LEVEL read off one snapshot and reported as a rate of change. Without a
  // previous transport belief the derivative still does not exist. Persistence
  // restores calibration; transport stays a prior until that dimension is fed.
  test("SHR-13: no previous belief means no trend, at any level of mu", () => {
    for (const mu of [0, 0.39, 0.5, 0.61, 4]) {
      expect(declareTrend({ mu, sigma: 0.01 })).toBe("indeterminate");
    }
    expect(transportHeatReadout(transportStream(20, "fatal")).trend).toBe("indeterminate");
  });
  // SHR-14. With two beliefs the derivative exists, and it is declared only past
  // sigma_delta = hypot(sigma_now, sigma_prev). A move inside the joint error bar
  // is not a direction.
  test("SHR-14: a direction is declared only past one joint sigma", () => {
    const tight = { sigma: 0.01 };
    expect(declareTrend({ mu: 1, ...tight }, { mu: 0, ...tight })).toBe("warming");
    expect(declareTrend({ mu: 0, ...tight }, { mu: 1, ...tight })).toBe("recovering");
    const wide = { sigma: 1 };
    expect(declareTrend({ mu: 1, ...wide }, { mu: 0, ...wide })).toBe("indeterminate");
  });

  // SHR-15. stable is a STRONGER claim than no-direction-declared: it asserts a
  // move worth noticing would have been seen. So it also needs the joint error bar
  // to be narrower than the narrowest band.
  test("SHR-15: stable requires resolving power, not just a small delta", () => {
    expect(declareTrend({ mu: 1, sigma: 0.01 }, { mu: 1, sigma: 0.01 })).toBe("stable");
    const blurry = severityPpm(Math.hypot(1, 1));
    expect(blurry).toBeGreaterThanOrEqual(WARM_TEMPERATURE_MAX_PPM);
    expect(declareTrend({ mu: 1, sigma: 1 }, { mu: 1, sigma: 1 })).toBe("indeterminate");
  });
});

describe("the readout is a pure fold (DST)", () => {
  // SHR-16. The whole readout is a total function of the BNN: no clock, no
  // ambient entropy, byte-identical on replay (discipline #4 / #7, and #13 --
  // nothing enters except through the argument).
  test("SHR-16: the same BNN serialises byte-identically twice", () => {
    const bnn = transportStream(6, "warn");
    const a = JSON.stringify(transportHeatReadout(bnn));
    const b = JSON.stringify(transportHeatReadout(bnn));
    expect(a).toBe(b);
  });

  // SHR-17. And two independently built BNNs fed the same stream agree, so the
  // readout carries no state of its own.
  test("SHR-17: two BNNs over the same stream produce the same readout", () => {
    const a = JSON.stringify(transportHeatReadout(transportStream(6, "error")));
    const b = JSON.stringify(transportHeatReadout(transportStream(6, "error")));
    expect(a).toBe(b);
  });
});
