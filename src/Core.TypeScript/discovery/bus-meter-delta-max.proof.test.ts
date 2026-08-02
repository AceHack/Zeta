// bus-meter-delta-max.proof — caveat (b) fix (Option 3: widen-cone-by-δ_max) proofs, plus
// the transcendental-refinement policy for TSIRELSON_EXACT_MILLI (Lumen, 2026-08-02).
//
// These proofs are additive to bus-meter.proof.test.ts — they cover only the new surface
// added by the caveat (b) fix. The existing proofs in bus-meter.proof.test.ts are not changed.

import { describe, it, expect } from "bun:test";
import {
  emptyMeter,
  foldSample,
  regimeOf,
  regimeOfTerrestrial,
  isEvidential,
  isEvidentialExact,
  TSIRELSON_EXACT_MILLI,
  type Regime,
} from "./bus-meter";
import { TSIRELSON_MILLI } from "./correlation";

// ── Caveat (b) fix: δ_max widen-cone proofs ──────────────────────────────────────────────────

describe("PROVEN: caveat (b) fix — δ_max widen-cone (Option 3)", () => {
  it("regimeOf with deltaMaxMs=0 is identical to regimeOfTerrestrial (regression, swept)", () => {
    // Exhaustive sweep: the new 3-arg regimeOf must agree with the old 2-arg alias at δ=0.
    for (let rtt = 0; rtt <= 400; rtt++) {
      const m = foldSample(emptyMeter, rtt);
      for (let tau = 0; tau <= 200; tau++) {
        expect(regimeOf(m, tau, 0)).toBe(regimeOfTerrestrial(m, tau));
      }
    }
  });

  it("widen-cone-by-deltaMax: OutOfCone only when bestOneWayMs > deadline + delta (swept)", () => {
    // For RTT=240, bestOneWayMs=120. Sweep deadline × delta and verify the predicate.
    const m = foldSample(emptyMeter, 240); // bestOneWayMs = 120
    for (let tau = 90; tau <= 130; tau++) {
      for (let delta = 0; delta <= 50; delta++) {
        const expected = 120 <= tau + delta ? "in-cone" : "out-of-cone";
        expect(regimeOf(m, tau, delta)).toBe(expected);
      }
    }
  });

  it("negative deltaMaxMs is clamped to 0 — no tightening of the cone (swept)", () => {
    for (let rtt = 0; rtt <= 200; rtt++) {
      const m = foldSample(emptyMeter, rtt);
      for (let tau = 0; tau <= 100; tau++) {
        const withZero = regimeOf(m, tau, 0);
        expect(regimeOf(m, tau, -50)).toBe(withZero);
        expect(regimeOf(m, tau, -999)).toBe(withZero);
      }
    }
  });

  it("monotone in deltaMaxMs: more budget never tightens the cone (deterministic grid)", () => {
    // For any (rtt, deadline), regimeOf(m, tau, d0) = in-cone implies regimeOf(m, tau, d1) = in-cone
    // for all d1 >= d0. This is the core safety property of Option 3.
    for (let rtt = 0; rtt <= 300; rtt += 3) {
      const m = foldSample(emptyMeter, rtt);
      for (let tau = 0; tau <= 150; tau += 3) {
        const r0   = regimeOf(m, tau, 0);
        const r50  = regimeOf(m, tau, 50);
        const r500 = regimeOf(m, tau, 500);
        if (r0 === "in-cone") {
          expect(r50).toBe("in-cone");
          expect(r500).toBe("in-cone");
        }
        if (r50 === "out-of-cone") expect(r0).toBe("out-of-cone");
        if (r500 === "out-of-cone") expect(r50).toBe("out-of-cone");
      }
    }
  });

  it("Earth-Mars opposition scenario: deltaMaxMs=190 prevents false conviction", () => {
    // Earth–Mars opposition: RTT ≈ 22 min = 1,320,000 ms; deadline = 659,999 ms (1 ms below RTT/2).
    // bestOneWayMs = 660,000. Without fix: 660,000 > 659,999 → out-of-cone (false conviction).
    // With δ=190 ms budget: effective threshold = 660,189; 660,000 ≤ 660,189 → in-cone (correct).
    const m = foldSample(emptyMeter, 1_320_000);
    const deadline = 659_999;
    expect(regimeOf(m, deadline, 0)).toBe("out-of-cone");   // old: false conviction
    expect(regimeOf(m, deadline, 190)).toBe("in-cone");     // fixed: in-cone
  });

  it("regimeOfTerrestrial is a strict alias for regimeOf(m, tau, 0) — same reference semantics", () => {
    const m = foldSample(emptyMeter, 200); // bestOneWayMs = 100
    expect(regimeOfTerrestrial(m, 100)).toBe("in-cone");
    expect(regimeOfTerrestrial(m, 99)).toBe("out-of-cone");
    expect(regimeOf(m, 100, 0)).toBe("in-cone");
    expect(regimeOf(m, 99, 0)).toBe("out-of-cone");
  });
});

// ── Transcendental-refinement policy proofs ───────────────────────────────────────────────────

describe("PROVEN: transcendental-refinement policy — TSIRELSON_EXACT_MILLI", () => {
  it("TSIRELSON_EXACT_MILLI = 2*sqrt(2)*1000 = 2828.427..., strictly above integer 2828", () => {
    expect(TSIRELSON_EXACT_MILLI).toBeCloseTo(2828.427, 2);
    expect(TSIRELSON_EXACT_MILLI).toBeGreaterThan(TSIRELSON_MILLI);
    expect(TSIRELSON_EXACT_MILLI).toBeLessThan(2829);
  });

  it("integer pipeline: S=2828 is at-Tsirelson (not evidential); S=2829 is superquantum", () => {
    // The integer 2828 is the operational boundary. Values at 2828 are NOT superquantum.
    expect(isEvidential(2828, "out-of-cone")).toBe(false); // 2828 is NOT > 2828
    expect(isEvidential(2829, "out-of-cone")).toBe(true);  // 2829 IS > 2828
  });

  it("exact pipeline: S=TSIRELSON_EXACT_MILLI is at-Tsirelson (not evidential); above it is", () => {
    // The exact boundary is 2828.427... Values at or below it are not superquantum.
    expect(isEvidentialExact(TSIRELSON_EXACT_MILLI, "out-of-cone")).toBe(false); // not strictly >
    expect(isEvidentialExact(TSIRELSON_EXACT_MILLI + 0.001, "out-of-cone")).toBe(true);
    expect(isEvidentialExact(2828.0, "out-of-cone")).toBe(false); // below exact boundary
    expect(isEvidentialExact(2828.5, "out-of-cone")).toBe(true);  // above exact boundary
  });

  it("gap policy: S in (2828, 2828.427) is integer-superquantum but exact-Tsirelson", () => {
    // This is the gap the policy documents. The integer pipeline calls it superquantum;
    // the exact pipeline does not. Both are correct for their domain.
    const inGap = 2828.2; // between integer 2828 and exact 2828.427
    expect(isEvidential(inGap, "out-of-cone")).toBe(true);       // integer: 2828.2 > 2828 → evidential
    expect(isEvidentialExact(inGap, "out-of-cone")).toBe(false); // exact: 2828.2 < 2828.427 → not evidential
    // The policy says this is fine: integer pipeline is operational (rounded inputs only);
    // exact pipeline is for simulation. No real integer-milli readout can land in this gap.
  });

  it("round-trip policy: Math.round() collapses the gap — no integer S lands in (2828, 2828.427)", () => {
    // Verify that after Math.round(), no value can land in the gap.
    // The gap is (2828, 2828.427...). Math.round(x) for x in this range rounds to 2828.
    for (let x = 2828.001; x < 2828.427; x += 0.01) {
      expect(Math.round(x)).toBe(2828); // rounds DOWN to 2828, not into the gap
    }
    // Values at or above 2828.5 round to 2829 (superquantum in both pipelines).
    expect(Math.round(2828.5)).toBe(2829);
    expect(Math.round(2828.6)).toBe(2829);
  });

  it("isEvidential and isEvidentialExact agree for all integer-milli S values (no gap after rounding)", () => {
    // After Math.round(), the two functions must agree: no integer S is in the gap.
    const outOfCone: Regime = "out-of-cone";
    for (let s = 2820; s <= 2840; s++) {
      const intResult = isEvidential(s, outOfCone);
      const exactResult = isEvidentialExact(s, outOfCone);
      // They may disagree only in the gap (2828, 2828.427), but integers can't land there.
      // So for all integer s, they must agree.
      expect(intResult).toBe(exactResult);
    }
  });

  it("isEvidential and isEvidentialExact agree on all non-evidential regimes (swept)", () => {
    // Neither function is evidential for in-cone or unmeasured, regardless of S.
    const regimes: Regime[] = ["in-cone", "unmeasured"];
    for (let s = 0; s <= 5000; s += 10) {
      for (const r of regimes) {
        expect(isEvidential(s, r)).toBe(false);
        expect(isEvidentialExact(s, r)).toBe(false);
      }
    }
  });
});
