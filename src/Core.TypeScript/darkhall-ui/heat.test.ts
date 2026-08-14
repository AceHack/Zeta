/**
 * Encoder-faithfulness tests for the heat/temperature encoders.
 * Work-item 081M00TYT8N087G0R003MPMRX9.
 *
 * Every test in this file FAILS against the pre-fix encoders in
 * `origin/main@f63307c17`. A test that passes both before and after a fix proves
 * nothing about the fix, so each block names the pre-fix behaviour it rejects.
 *
 * The discipline under test: an encoder must be a total, injective function from
 * its data's actual domain onto its channel, or non-injective only in a
 * DECLARED, BOUNDED way. Anchor: Tufte, *The Visual Display of Quantitative
 * Information* (1983) — lie factor = (effect shown) / (effect in data) = 1.0.
 */
import { describe, expect, it } from "bun:test";

import {
  BLACK_BODY_RADIANCE_FLOOR_PPM,
  HEAT_RECEIPT_CEILING_UNITS,
  MAX_TEMPERATURE_PPM,
  blackBodyRadianceReading,
  blackBodyRadiancePpm,
  heatReceiptPpm,
  heatReceiptScale,
  temperatureBand,
  temperatureBandReading,
  temperatureReadout,
} from "./heat";

/** Treaty band cuts, restated here so a drift in `heat.ts` fails loudly. */
const WARM_MAX = 333_333;
const HOT_MAX = 666_666;

// ═══════════════════════════════════════════════════════════════════════════
// SITE A — heatReceiptPpm: widened channel (option 1)
// Pre-fix: linear, ceiling 16 units. 24 collisions over units 1..40;
// LF(16->32) = 0.5000, LF(16->100) = 0.1600, LF(16->1000) = 0.0160.
// ═══════════════════════════════════════════════════════════════════════════

describe("heatReceiptPpm — stated domain: non-negative integers; injective on [0, ceiling]", () => {
  it("is injective over the whole declared domain (pre-fix: 24 collisions over units 1..40 alone)", () => {
    const seen = new Map<number, number>();
    const collisions: string[] = [];

    for (let units = 0; units <= HEAT_RECEIPT_CEILING_UNITS; units++) {
      const ppm = heatReceiptPpm(units);
      const previous = seen.get(ppm);
      if (previous !== undefined) collisions.push(`${previous} and ${units} both -> ${ppm}`);
      else seen.set(ppm, units);
    }

    expect(collisions).toEqual([]);
    expect(seen.size).toBe(HEAT_RECEIPT_CEILING_UNITS + 1);
  });

  it("is strictly increasing, so no two counts share a picture", () => {
    let previous = -1;
    for (let units = 0; units <= HEAT_RECEIPT_CEILING_UNITS; units++) {
      const ppm = heatReceiptPpm(units);
      expect(ppm).toBeGreaterThan(previous);
      previous = ppm;
    }
  });

  it("separates 16 from 17, 32, 100 and 1000 (pre-fix: all five were exactly 1_000_000)", () => {
    const pictures = [16, 17, 32, 100, 1000].map((units) => heatReceiptPpm(units));
    expect(new Set(pictures).size).toBe(5);
    expect(pictures).toEqual([...pictures].toSorted((a, b) => a - b));
  });

  it("declares saturation as a value instead of silently pinning", () => {
    const atCeiling = heatReceiptScale(HEAT_RECEIPT_CEILING_UNITS);
    const aboveCeiling = heatReceiptScale(HEAT_RECEIPT_CEILING_UNITS + 1);
    const farAbove = heatReceiptScale(1_000_000);

    // "exactly the ceiling" is distinguishable from "at or above the ceiling" —
    // which is precisely what the pre-fix encoder destroyed.
    expect(atCeiling.fidelity).toBe("exact");
    expect(aboveCeiling.fidelity).toBe("saturated");
    expect(farAbove.fidelity).toBe("saturated");
    expect(aboveCeiling.ppm).toBe(MAX_TEMPERATURE_PPM);
    expect(aboveCeiling.ceilingUnits).toBe(HEAT_RECEIPT_CEILING_UNITS);
    // the count itself survives even when the channel cannot carry it
    expect(farAbove.units).toBe(1_000_000);
  });

  it("separates a true zero from NaN / Infinity / negative / fractional (pre-fix: all mapped to 0)", () => {
    expect(heatReceiptScale(0).fidelity).toBe("exact");
    for (const bad of [-5, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(heatReceiptScale(bad).fidelity).toBe("out-of-domain");
    }
    // a genuine "no heat" and a broken counter are no longer the same reading
    expect(heatReceiptScale(0).fidelity).not.toBe(heatReceiptScale(Number.NaN).fidelity);
  });

  it("has lie factor 1.0 under its DECLARED log protocol, computed on evaluated pairs", () => {
    // The protocol is `log1p`, so the invariant is in (1 + units), NOT in units:
    // equal ppm distances are equal ratios of (1 + units). Stated as "equal
    // ratios of units" this is FALSE — gap(1,10) = 153_714 but gap(10,100) =
    // 199_924 — and the first draft of this test asserted the false version and
    // failed. The encoder is faithful; the claim about it was not.
    const gap = (a: number, b: number) => heatReceiptPpm(b) - heatReceiptPpm(a);

    // successive doublings of (1 + units): 2 -> 4 -> 8 -> 16 -> 32
    const doublings = [gap(1, 3), gap(3, 7), gap(7, 15), gap(15, 31)];
    for (const g of doublings) {
      expect(Math.abs(g - doublings[0]!)).toBeLessThanOrEqual(1);
    }

    // and the rendered distance is monotone in the ratio: a 4x step is twice a
    // 2x step, within integer rounding
    expect(Math.abs(gap(1, 7) - 2 * doublings[0]!)).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SITE B — temperatureBand: refined input (option 3) + declared ceiling (2)
// THE RANKED-FIRST DEFECT. Pre-fix, via the live darkhall-room path, units
// 11 / 100 / 1000 / 1_000_000 all rendered `critical`: a stuck gauge and a
// genuine emergency were indistinguishable, and every additional reading made
// an operator MORE confident. "Correlated coincidence over time."
// ═══════════════════════════════════════════════════════════════════════════

describe("temperatureBand — the pinned-at-critical defect", () => {
  it("renders 11, 100, 1000 and 1_000_000 units as four distinct pictures (pre-fix: one)", () => {
    const pictures = [11, 100, 1000, 1_000_000].map((units) => {
      const scale = heatReceiptScale(units);
      return `${scale.ppm}/${temperatureBand(scale.ppm)}`;
    });

    expect(new Set(pictures).size).toBe(4);
  });

  it("does not reach `critical` at 11 units (pre-fix: `critical` from 11 upward)", () => {
    expect(temperatureBand(heatReceiptScale(11).ppm)).not.toBe("critical");
  });

  it("reserves `critical` for readings that are actually extreme", () => {
    // an order-of-magnitude climb must be visible as a band climb, not absorbed
    const bands = [1, 100, 100_000].map((units) => temperatureBand(heatReceiptScale(units).ppm));
    expect(new Set(bands).size).toBe(3);
  });
});

describe("temperatureBandReading — stated domain: integers [0, MAX_TEMPERATURE_PPM]", () => {
  it("separates an idle room from a blind one (pre-fix: NaN, Infinity and -1 all read `cold`)", () => {
    const idle = temperatureBandReading(0);
    expect(idle.band).toBe("cold");
    expect(idle.verdict).toBe("in-range");

    for (const blind of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
      const reading = temperatureBandReading(blind);
      // the band token is unchanged (four-oracle treaty) but it no longer stands alone
      expect(reading.verdict).toBe("out-of-domain");
      expect(`${reading.band}/${reading.verdict}`).not.toBe(`${idle.band}/${idle.verdict}`);
    }
  });

  it("separates at-the-ceiling from above-the-ceiling (pre-fix: both `critical`)", () => {
    const atCeiling = temperatureBandReading(MAX_TEMPERATURE_PPM);
    const above = temperatureBandReading(2 * MAX_TEMPERATURE_PPM);

    expect(atCeiling.band).toBe("critical");
    expect(above.band).toBe("critical");
    expect(atCeiling.verdict).toBe("in-range");
    expect(above.verdict).toBe("over-ceiling");
    expect(above.observed).toBe(2 * MAX_TEMPERATURE_PPM);
  });

  it("holds the declared property: no out-of-domain input shares a cell with an in-range one", () => {
    const inRangeCells = new Set(
      [0, 1, WARM_MAX, WARM_MAX + 1, HOT_MAX, HOT_MAX + 1, MAX_TEMPERATURE_PPM].map((ppm) => {
        const r = temperatureBandReading(ppm);
        expect(r.verdict).toBe("in-range");
        return `${r.band}/${r.verdict}`;
      }),
    );

    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, -1_000_000, 2_000_000, 0.5]) {
      const r = temperatureBandReading(bad);
      expect(inRangeCells.has(`${r.band}/${r.verdict}`)).toBe(false);
    }
  });

  it("keeps the four treaty tokens unchanged for every in-domain value", () => {
    // The band token set is locked across TypeScript, F# (`src/Core/Heat.fs`) and
    // Q# (`HeatSignals.qs`); this fix must not move it.
    for (const ppm of [0, 1, 333_333, 333_334, 666_666, 666_667, 1_000_000]) {
      expect(temperatureBandReading(ppm).band).toBe(temperatureBand(ppm));
    }
    expect([0, 200_000, 500_000, 800_000].map(temperatureBand)).toEqual(["cold", "warm", "hot", "critical"]);
  });
});

describe("temperatureReadout — the clamp reports what it absorbed", () => {
  it("flags an out-of-domain channel instead of rendering it as `cold` (pre-fix: silent)", () => {
    const blind = temperatureReadout({
      source: "probe",
      heatPpm: Number.NaN,
      uncertaintyPpm: 0,
      pressurePpm: 0,
      attentionPpm: 0,
    });

    expect(blind.band).toBe("cold");
    expect(blind.fidelity).toBe("out-of-domain");
  });

  it("flags an over-ceiling channel as saturated", () => {
    const hot = temperatureReadout({
      source: "probe",
      heatPpm: 2 * MAX_TEMPERATURE_PPM,
      uncertaintyPpm: 0,
      pressurePpm: 0,
      attentionPpm: 0,
    });

    expect(hot.fidelity).toBe("saturated");
  });

  it("reports `exact` for an ordinary in-domain reading", () => {
    const ok = temperatureReadout({
      source: "probe",
      heatPpm: 500_000,
      uncertaintyPpm: 10,
      pressurePpm: 0,
      attentionPpm: 1_000_000,
    });

    expect(ok.fidelity).toBe("exact");
    expect(ok.band).toBe("hot");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SITE C — blackBodyRadiancePpm: declared floor (option 2)
// Pre-fix: radiance is exactly 0 for every T below 31_623 — 3.1622% of scale —
// and says nothing about it. Branch-free and still destroying information:
// `floor` is a branch-free destroyer, which is why the principle is injectivity
// and not "no if statements".
// ═══════════════════════════════════════════════════════════════════════════

describe("blackBodyRadianceReading — stated domain: integers [0, MAX_TEMPERATURE_PPM]", () => {
  it("separates a cold room from one too faint to encode (pre-fix: both radiance 0)", () => {
    const cold = blackBodyRadianceReading(0);
    const faint = blackBodyRadianceReading(1);
    const alsoFaint = blackBodyRadianceReading(BLACK_BODY_RADIANCE_FLOOR_PPM - 1);

    expect(cold.radiancePpm).toBe(0);
    expect(faint.radiancePpm).toBe(0);
    expect(alsoFaint.radiancePpm).toBe(0);

    expect(cold.fidelity).toBe("exact");
    expect(faint.fidelity).toBe("below-resolution");
    expect(alsoFaint.fidelity).toBe("below-resolution");
  });

  it("pins the floor by measurement, not by restating the constant", () => {
    // Search for the least T with a representable radiance and compare it to the
    // declared constant. If the arithmetic ever changes, this fails.
    let measured = -1;
    for (let t = 1; t <= MAX_TEMPERATURE_PPM; t++) {
      if (blackBodyRadiancePpm(t) > 0) {
        measured = t;
        break;
      }
    }

    expect(measured).toBe(BLACK_BODY_RADIANCE_FLOOR_PPM);
    expect(blackBodyRadiancePpm(BLACK_BODY_RADIANCE_FLOOR_PPM - 1)).toBe(0);
    expect(blackBodyRadiancePpm(BLACK_BODY_RADIANCE_FLOOR_PPM)).toBe(1);
  });

  it("declares exactly the temperatures it cannot represent, and no others", () => {
    let belowResolution = 0;
    for (let t = 0; t <= MAX_TEMPERATURE_PPM; t++) {
      if (blackBodyRadianceReading(t).fidelity === "below-resolution") belowResolution++;
    }

    expect(belowResolution).toBe(BLACK_BODY_RADIANCE_FLOOR_PPM - 1);
  });

  it("is monotone non-decreasing above the floor, and `exact` there", () => {
    let previous = -1;
    for (let t = BLACK_BODY_RADIANCE_FLOOR_PPM; t <= MAX_TEMPERATURE_PPM; t += 997) {
      const reading = blackBodyRadianceReading(t);
      expect(reading.fidelity).toBe("exact");
      expect(reading.radiancePpm).toBeGreaterThanOrEqual(previous);
      previous = reading.radiancePpm;
    }
  });

  it("keeps the treaty-locked values unchanged (F# and Q# byte-lock these)", () => {
    expect(blackBodyRadiancePpm(500_000)).toBe(62_500);
    expect(blackBodyRadiancePpm(1_000_000)).toBe(1_000_000);
    expect(blackBodyRadianceReading(500_000).radiancePpm).toBe(blackBodyRadiancePpm(500_000));
  });

  it("marks out-of-domain temperatures rather than clamping them into a reading", () => {
    for (const bad of [-1, 1_000_001, Number.NaN, 0.5]) {
      expect(blackBodyRadianceReading(bad).fidelity).toBe("out-of-domain");
    }
  });
});
