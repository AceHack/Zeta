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
  UNREPORTED_FIDELITY,
  type ChannelFidelity,
  type HeatRow,
  type TemperatureReadout,
  heatReceiptFromRow,
  heatReceiptPpm,
  heatReceiptReading,
  heatReceiptScale,
  reportedFidelity,
  heatSignalEvidence,
  heatSignals,
  temperatureBand,
  temperatureBandReading,
  temperatureReadout,
  worstFidelity,
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

// ═══════════════════════════════════════════════════════════════════════════
// SITE E — the schema-evolution decision (081M010WYE5087G0R003J89QVF §2 +
// 081M01400RZ087G0R000PS3VJG). Decision record:
// docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md
//
// Two properties are under test, and they are the two halves of the policy:
//   1. an optional key's ABSENT-READING is distinguishable from every present
//      reading, and in particular is never `exact`;
//   2. `heatReceiptFromRow` no longer paints a blind counter as a genuine zero.
// ═══════════════════════════════════════════════════════════════════════════

describe("reportedFidelity — the declared absent-reading of an optional treaty key", () => {
  it("returns 'exact' if and ONLY if the producer said 'exact'", () => {
    // The whole invariant, exhaustive over the value domain plus absence.
    const all: readonly (ChannelFidelity | undefined)[] = [
      "exact",
      "saturated",
      "below-resolution",
      "out-of-domain",
      undefined,
    ];

    for (const value of all) {
      expect(reportedFidelity(value) === "exact").toBe(value === "exact");
    }
  });

  it("gives absence its own token rather than folding it into a measured one", () => {
    const measured: readonly ChannelFidelity[] = ["exact", "saturated", "below-resolution", "out-of-domain"];

    for (const value of measured) {
      expect(reportedFidelity(value)).toBe(value);
      expect(reportedFidelity(undefined)).not.toBe(reportedFidelity(value));
    }

    expect(reportedFidelity(undefined)).toBe(UNREPORTED_FIDELITY);
    // Five distinct readings from four measured tokens plus absence.
    expect(new Set([...measured, undefined].map(reportedFidelity)).size).toBe(5);
  });

  it("reads an F#-produced v1 readout — eight keys, no fidelity — as unreported, not as exact", () => {
    // Verbatim shape of `TranscriptTemperatureReadout` as emitted by
    // `src/Core/DarkHallRoomTranscript.fs` BEFORE the fidelity key was added.
    // Instances of this shape are what makes the key optional rather than
    // required: PR #10722 declared it required and this parse then produced
    // `fidelity === undefined` under a type asserting one of four literals.
    const publishedV1 = JSON.parse(
      `{"schema":"zeta.temperature.readout.v1","source":"darkhall","temperaturePpm":62500,` +
        `"band":"warm","heatPpm":62500,"uncertaintyPpm":0,"pressurePpm":62500,"attentionPpm":0}`,
    ) as TemperatureReadout;

    expect(Object.keys(publishedV1)).toHaveLength(8);
    expect(publishedV1.fidelity).toBeUndefined();
    expect(reportedFidelity(publishedV1.fidelity)).toBe("unreported");
    expect(reportedFidelity(publishedV1.fidelity)).not.toBe("exact");
  });
});

describe("heatReceiptFromRow — the receipt rails no longer paint a blind counter as a genuine zero", () => {
  const row = (over: Partial<HeatRow>): HeatRow => ({
    tick: 1,
    roomName: "darkhall",
    heatRejected: 0,
    backpressured: 0,
    storageErrors: 0,
    heatKinds: [],
    reasons: [],
    ...over,
  });

  it("separates a blind heat counter from a genuinely idle one (pre-fix: byte-identical)", () => {
    const idle = heatReceiptFromRow(row({ heatRejected: 0 }));
    const blind = heatReceiptFromRow(row({ heatRejected: Number.NaN }));

    // Every published VALUE key agrees — which is precisely why the ppm channel
    // alone could never tell these apart.
    expect(blind.heatPpm).toBe(idle.heatPpm);
    expect(blind.outcome).toBe(idle.outcome);

    expect(idle.heatFidelity).toBe("exact");
    expect(blind.heatFidelity).toBe("out-of-domain");
    expect(reportedFidelity(blind.heatFidelity)).not.toBe(reportedFidelity(idle.heatFidelity));
  });

  it("reports each rail independently rather than folding three counters into one verdict", () => {
    // A fold to the worst fidelity would be a fresh non-injective encoder:
    // (exact, exact, out-of-domain) and (out-of-domain, out-of-domain,
    // out-of-domain) would render identically. That is the defect class this
    // whole lane exists to remove, so the receipt carries one per rail.
    const storageBlind = heatReceiptFromRow(row({ storageErrors: Number.NaN }));

    expect(storageBlind.heatFidelity).toBe("exact");
    expect(storageBlind.pressureFidelity).toBe("exact");
    expect(storageBlind.storageFidelity).toBe("out-of-domain");

    const allBlind = heatReceiptFromRow(
      row({ heatRejected: Number.NaN, backpressured: Number.NaN, storageErrors: Number.NaN }),
    );

    expect(allBlind.storageFidelity).toBe(storageBlind.storageFidelity);
    expect(allBlind.heatFidelity).not.toBe(storageBlind.heatFidelity);
  });

  it("marks a pinned rail as saturated rather than as a high reading", () => {
    const pinned = heatReceiptFromRow(row({ backpressured: HEAT_RECEIPT_CEILING_UNITS + 1 }));
    const atCeiling = heatReceiptFromRow(row({ backpressured: HEAT_RECEIPT_CEILING_UNITS }));

    expect(pinned.pressurePpm).toBe(atCeiling.pressurePpm);
    expect(atCeiling.pressureFidelity).toBe("exact");
    expect(pinned.pressureFidelity).toBe("saturated");
  });

  it("leaves a healthy receipt reading exact on every rail — no false alarm", () => {
    const healthy = heatReceiptFromRow(row({ heatRejected: 3, backpressured: 1, storageErrors: 0 }));

    expect(healthy.heatFidelity).toBe("exact");
    expect(healthy.pressureFidelity).toBe("exact");
    expect(healthy.storageFidelity).toBe("exact");
    expect(healthy.heatPpm).toBe(heatReceiptPpm(3));
  });
});

// SITE E — the receipt's signal channel carries its own denominator
// Work-item 081M01400RZ087G0R000PS3VJG (filed by PR #10732, resolved in part here).
//
// Pre-fix: `heatSignals` returned `[]` BOTH for a producer that reported an
// empty signal set and for a producer with no `signals` key at all, and the
// receipt published `signals: []` either way. Measured on unmodified `main`
// over seven distinct HeatRow inputs: 4 distinct published receipts, two
// collision groups. After: 6 distinct, one group (NaN-vs-zero, which is the
// separate fidelity lane held by PR #10742).
//
// #10735's shape, reused rather than re-invented: a reading with zero
// observations is a THIRD state — unknown — not the healthy one.
// ═══════════════════════════════════════════════════════════════════════════

const quietRow = {
  tick: 7,
  roomName: "atrium",
  heatRejected: 0,
  backpressured: 0,
  storageErrors: 0,
  heatKinds: [] as readonly string[],
  reasons: [] as readonly string[],
};

describe("heatSignalEvidence — the signal set with the denominator it was folded from", () => {
  it("separates a reported empty set from no signal channel at all (pre-fix: both `[]`, indistinguishable)", () => {
    const reported = heatSignalEvidence({ ...quietRow, signals: [] });
    const absent = heatSignalEvidence(quietRow);

    expect(reported.signals).toEqual(absent.signals); // the fold is unchanged, deliberately
    expect(reported.source).toBe("reported");
    expect(absent.source).toBe("inferred");
  });

  it("counts the evidence the inference actually consulted, not the conclusion it reached", () => {
    // Two kinds in, one signal token out: the denominator is 2, not 1.
    const inferred = heatSignalEvidence({ ...quietRow, heatKinds: ["a.stale", "b.stale"] });
    expect(inferred.signals).toEqual(["stale"]);
    expect(inferred.observations).toBe(2);

    // Each counter that fired is one more observation.
    expect(heatSignalEvidence({ ...quietRow, backpressured: 1, storageErrors: 1 }).observations).toBe(2);
  });

  it("reports zero observations exactly when the inference ran on nothing", () => {
    expect(heatSignalEvidence(quietRow).observations).toBe(0);
    expect(heatSignalEvidence({ ...quietRow, heatKinds: ["x.stale"] }).observations).toBe(1);
  });

  it("keeps `heatSignals` value-identical — the accessor is lossy, not wrong", () => {
    for (const row of [
      quietRow,
      { ...quietRow, signals: ["stale"] },
      { ...quietRow, heatKinds: ["soft-emu.prune"] },
      { ...quietRow, backpressured: 3 },
      { ...quietRow, storageErrors: 2 },
      { ...quietRow, signals: ["nonsense-token"] },
    ]) {
      expect(heatSignals(row)).toEqual(heatSignalEvidence(row).signals);
    }
  });
});

describe("heatReceiptReading — zero observations is UNKNOWN, never the healthy reading", () => {
  it("reads a blind receipt as unknown and a measured-quiet one as measured (pre-fix: byte-identical)", () => {
    const blind = heatReceiptFromRow(quietRow, { source: "atrium" });
    const measuredZero = heatReceiptFromRow({ ...quietRow, signals: [] }, { source: "atrium" });

    expect(heatReceiptReading(blind)).toBe("unknown");
    expect(heatReceiptReading(measuredZero)).toBe("measured");
    expect(JSON.stringify(blind)).not.toBe(JSON.stringify(measuredZero));
  });

  it("treats an inference WITH evidence as measured — this is not alarm-on-everything", () => {
    const inferredWithEvidence = heatReceiptFromRow({ ...quietRow, heatKinds: ["soft-emu.prune"] }, { source: "atrium" });
    expect(heatReceiptReading(inferredWithEvidence)).toBe("measured");
    expect(inferredWithEvidence.signalObservations).toBe(1);
  });

  it("reads an absent key as `unreported`, NEVER as measured (the conservative absent-reading)", () => {
    const legacy = { ...heatReceiptFromRow({ ...quietRow, signals: [] }, { source: "atrium" }) };
    delete (legacy as { signalSource?: unknown }).signalSource;
    delete (legacy as { signalObservations?: unknown }).signalObservations;

    expect(heatReceiptReading(legacy)).toBe("unreported");
    expect(heatReceiptReading(legacy)).not.toBe("measured");
  });

  it("reads a HALF-present pair as unreported — a partial claim is not a claim", () => {
    const half = { ...heatReceiptFromRow(quietRow, { source: "atrium" }) };
    delete (half as { signalObservations?: unknown }).signalObservations;
    expect(heatReceiptReading(half)).toBe("unreported");
  });

  it("neither new key alone separates the cases — both are load-bearing, neither is vacuous", () => {
    const rows = [
      { id: "reported-empty", row: { ...quietRow, signals: [] as readonly string[] } },
      { id: "inferred-blind", row: quietRow },
      { id: "inferred-with-evidence", row: { ...quietRow, heatKinds: ["a.stale", "b.stale"] } },
      { id: "reported-nonempty", row: { ...quietRow, signals: ["stale"] as readonly string[] } },
    ];
    const receipts = rows.map((entry) => heatReceiptFromRow(entry.row, { source: "atrium" }));

    // `signalObservations` alone cannot separate reported-empty from inferred-blind:
    expect(receipts[0]?.signalObservations).toBe(receipts[1]?.signalObservations);
    // `signalSource` alone cannot separate reported-empty from reported-nonempty:
    expect(receipts[0]?.signalSource).toBe(receipts[3]?.signalSource);
    // Together they are injective over the four cases:
    const cells = receipts.map((r) => `${String(r.signalSource)}/${String(r.signalObservations)}`);
    expect(new Set(cells).size).toBe(4);
  });

  it("makes the receipt encoder more injective, measured rather than asserted", () => {
    const inputs = [
      { ...quietRow, signals: [] as readonly string[] },
      quietRow,
      { ...quietRow, heatKinds: ["a.stale", "b.stale"] },
      { ...quietRow, signals: ["stale"] as readonly string[] },
      { ...quietRow, signals: ["stale", "stale"] as readonly string[] },
      { ...quietRow, heatRejected: 11, signals: [] as readonly string[] },
    ];
    const published = new Set(inputs.map((row) => JSON.stringify(heatReceiptFromRow(row, { source: "atrium" }))));
    // Pre-fix this set has 4 members (reported-empty == blind, and one token == two
    // duplicate tokens). Every input here is genuinely distinct, so 6 is the honest number.
    expect(published.size).toBe(6);
  });
});

// SITE E — fidelity LAUNDERING across composition (081M010WYE5087G0R003J89QVF §1).
//
// 081M00TYT8N087G0R003MPMRX9 gave each encoder a `fidelity` / `verdict` channel.
// It did not make the channel SURVIVE COMPOSITION. `darkhall-room.ts:558-565`
// feeds the LOSSY accessor `heatReceiptPpm(...)` into `temperatureReadout(...)`,
// so the out-of-domain fact is destroyed one call before the readout is built and
// the readout then reports `fidelity: "exact"`.
//
// That is strictly worse than the silence it replaced: an unwired fidelity field
// does not merely omit the fault, it POSITIVELY ASSERTS exactness about a reading
// no instrument produced. A field that always says `exact` is the vacuity class.
//
// Every test below FAILS against `origin/main@0cb3642eb`.
// ═══════════════════════════════════════════════════════════════════════════

describe("worstFidelity — a composed reading is only as faithful as its worst input", () => {
  it("ranks the four fidelities by how badly they mislead about magnitude", () => {
    expect(worstFidelity([])).toBe("exact");
    expect(worstFidelity(["exact", "exact"])).toBe("exact");
    expect(worstFidelity(["exact", "below-resolution"])).toBe("below-resolution");
    expect(worstFidelity(["below-resolution", "saturated"])).toBe("saturated");
    expect(worstFidelity(["saturated", "out-of-domain"])).toBe("out-of-domain");
    expect(worstFidelity(["out-of-domain", "exact"])).toBe("out-of-domain");
  });

  it("is order-independent and idempotent (a fold over a set, not a sequence)", () => {
    expect(worstFidelity(["saturated", "exact"])).toBe(worstFidelity(["exact", "saturated"]));
    expect(worstFidelity(["saturated", "saturated"])).toBe(worstFidelity(["saturated"]));
  });
});

describe("temperatureReadout — must not re-declare a known-blind input as exact", () => {
  it("accepts upstream fidelity and takes the worst (pre-fix: ignored, reported 'exact')", () => {
    const blindScale = heatReceiptScale(Number.NaN);
    expect(blindScale.fidelity).toBe("out-of-domain");

    const readout = temperatureReadout({
      source: "room",
      heatPpm: heatReceiptPpm(Number.NaN),
      uncertaintyPpm: 0,
      pressurePpm: 0,
      attentionPpm: 0,
      upstreamFidelity: [blindScale.fidelity],
    });

    expect(readout.fidelity).toBe("out-of-domain");
  });

  it("separates a blind room from an idle one after the lossy accessor has run", () => {
    const build = (units: number) => {
      const scale = heatReceiptScale(units);
      return temperatureReadout({
        source: "room",
        heatPpm: scale.ppm,
        uncertaintyPpm: 0,
        pressurePpm: 0,
        attentionPpm: 0,
        upstreamFidelity: [scale.fidelity],
      });
    };

    const blind = build(Number.NaN);
    const idle = build(0);

    // The band token is treaty-locked and identical by design — that is exactly
    // why the fidelity channel has to carry the difference.
    expect(blind.band).toBe(idle.band);
    expect(blind.temperaturePpm).toBe(idle.temperaturePpm);
    expect(blind.fidelity).not.toBe(idle.fidelity);
    expect(idle.fidelity).toBe("exact");
  });

  it("still reports 'exact' when every input really is in-domain (no false alarm)", () => {
    const scale = heatReceiptScale(5);
    expect(scale.fidelity).toBe("exact");

    const readout = temperatureReadout({
      source: "room",
      heatPpm: scale.ppm,
      uncertaintyPpm: 0,
      pressurePpm: 0,
      attentionPpm: 0,
      upstreamFidelity: [scale.fidelity],
    });

    expect(readout.fidelity).toBe("exact");
    expect(readout.band).toBe("warm");
  });

  it("keeps reporting its OWN out-of-domain inputs when no upstream fidelity is given", () => {
    const readout = temperatureReadout({
      source: "room",
      heatPpm: Number.NaN,
      uncertaintyPpm: 0,
      pressurePpm: 0,
      attentionPpm: 0,
    });

    expect(readout.fidelity).toBe("out-of-domain");
  });
});
