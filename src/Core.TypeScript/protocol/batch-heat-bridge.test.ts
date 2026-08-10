/**
 * batch-heat-bridge.test.ts
 *
 * Tests for the BatchTeachingEnvelope → TemperatureReadout bridge.
 *
 * Anti-self-certifying: every test that asserts "cold" also has a companion
 * that asserts "not cold" with a single leak injected (fault-injection negative control).
 *
 * Coverage:
 *   - unaccountedHeatPpm: 0 → 0, 1/3 → warm, 2/3 → hot, >2/3 → critical
 *   - batchTemperatureBand: cold/warm/hot/critical thresholds
 *   - batchTemperatureReadout: full TemperatureReadout from envelope
 *   - batchHeatLabel: string formatting
 *   - Fault injection: single leak breaks cold verdict
 *   - Accounted heat does NOT drive temperature (deliberate erasures are not alarming)
 */

import { describe, test, expect } from "bun:test";
import {
  unaccountedHeatPpm,
  batchTemperatureBand,
  batchTemperatureReadout,
  batchHeatLabel,
  WARM_TEMPERATURE_MAX_PPM,
  HOT_TEMPERATURE_MAX_PPM,
  MAX_TEMPERATURE_PPM,
} from "./batch-heat-bridge";
import { makeBatchEnvelope, makeBatchItemCell } from "./batch-teaching-envelope";
import type { ErrorDimension } from "../protocol/error-envelope";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCell(itemId: string, teaching: boolean, accounted = false) {
  return makeBatchItemCell({
    itemId,
    ...(teaching ? { retractableBeliefId: `belief:${itemId}` } : {}),
    generatorFn: "test-generator",
    dimension: "transport" as ErrorDimension,
    severity: "error",
    reason: "test reason",
    what: "test what",
    ...(accounted && !teaching ? { accountedReason: "deliberate migration" } : {}),
  });
}

function makeEnvelope(opts: {
  totalItems: number;
  teachingCount: number;
  erasureCount: number;
  accountedCount?: number;
}) {
  const cells = [
    ...Array.from({ length: opts.teachingCount }, (_, i) => makeCell(`t${i}`, true)),
    ...Array.from({ length: opts.erasureCount - (opts.accountedCount ?? 0) }, (_, i) => makeCell(`e${i}`, false)),
    ...Array.from({ length: opts.accountedCount ?? 0 }, (_, i) => makeCell(`a${i}`, false, true)),
  ];
  return makeBatchEnvelope({
    batchFrameId: "test-frame",
    correlationId: "test-corr",
    totalItems: opts.totalItems,
    errors: cells,
  });
}

// ── unaccountedHeatPpm ────────────────────────────────────────────────────────

describe("unaccountedHeatPpm", () => {
  test("0 unaccounted → 0 ppm (cold)", () => {
    expect(unaccountedHeatPpm({ unaccountedHeat: 0, failedItems: 10 })).toBe(0);
  });

  test("FAULT INJECTION: 1 unaccounted → non-zero ppm (not cold)", () => {
    // Anti-self-certifying: a single leak must break the cold verdict
    expect(unaccountedHeatPpm({ unaccountedHeat: 1, failedItems: 10 })).toBeGreaterThan(0);
  });

  test("1/3 ratio → ppm in warm band", () => {
    const ppm = unaccountedHeatPpm({ unaccountedHeat: 3, failedItems: 9 });
    expect(ppm).toBeGreaterThan(0);
    expect(ppm).toBeLessThanOrEqual(WARM_TEMPERATURE_MAX_PPM);
  });

  test("2/3 ratio → ppm in hot band", () => {
    // 5/9 ≈ 0.556 → 555556 ppm, which is in the hot band (333333 < ppm ≤ 666666)
    const ppm = unaccountedHeatPpm({ unaccountedHeat: 5, failedItems: 9 });
    expect(ppm).toBeGreaterThan(WARM_TEMPERATURE_MAX_PPM);
    expect(ppm).toBeLessThanOrEqual(HOT_TEMPERATURE_MAX_PPM);
  });

  test("1.0 ratio → ppm at max (critical)", () => {
    const ppm = unaccountedHeatPpm({ unaccountedHeat: 9, failedItems: 9 });
    expect(ppm).toBe(MAX_TEMPERATURE_PPM);
  });

  test("unaccounted > failedItems is clamped to max", () => {
    const ppm = unaccountedHeatPpm({ unaccountedHeat: 100, failedItems: 5 });
    expect(ppm).toBe(MAX_TEMPERATURE_PPM);
  });

  test("negative unaccounted treated as 0", () => {
    expect(unaccountedHeatPpm({ unaccountedHeat: -1, failedItems: 5 })).toBe(0);
  });
});

// ── batchTemperatureBand ──────────────────────────────────────────────────────

describe("batchTemperatureBand", () => {
  test("0 leaks → cold", () => {
    expect(batchTemperatureBand({ unaccountedHeat: 0, failedItems: 10 })).toBe("cold");
  });

  test("FAULT INJECTION: 1 leak → not cold", () => {
    expect(batchTemperatureBand({ unaccountedHeat: 1, failedItems: 10 })).not.toBe("cold");
  });

  test("≤33% leaks → warm", () => {
    expect(batchTemperatureBand({ unaccountedHeat: 3, failedItems: 10 })).toBe("warm");
  });

  test("≤66% leaks → hot", () => {
    expect(batchTemperatureBand({ unaccountedHeat: 6, failedItems: 10 })).toBe("hot");
  });

  test(">66% leaks → critical", () => {
    expect(batchTemperatureBand({ unaccountedHeat: 8, failedItems: 10 })).toBe("critical");
  });

  test("100% leaks → critical", () => {
    expect(batchTemperatureBand({ unaccountedHeat: 10, failedItems: 10 })).toBe("critical");
  });
});

// ── batchTemperatureReadout ───────────────────────────────────────────────────

describe("batchTemperatureReadout", () => {
  test("all teaching → cold readout", () => {
    const env = makeEnvelope({ totalItems: 10, teachingCount: 5, erasureCount: 0 });
    const r = batchTemperatureReadout(env);
    expect(r.band).toBe("cold");
    expect(r.heatPpm).toBe(0);
  });

  test("FAULT INJECTION: 1 unaccounted erasure → not cold", () => {
    const env = makeEnvelope({ totalItems: 10, teachingCount: 4, erasureCount: 1 });
    const r = batchTemperatureReadout(env);
    expect(r.band).not.toBe("cold");
    expect(r.heatPpm).toBeGreaterThan(0);
  });

  test("accounted erasures do NOT drive temperature", () => {
    // 5 accounted erasures (deliberate migration) — should stay cold
    const env = makeEnvelope({ totalItems: 10, teachingCount: 0, erasureCount: 5, accountedCount: 5 });
    const r = batchTemperatureReadout(env);
    // heatPpm = 0 because all erasures are accounted
    expect(r.heatPpm).toBe(0);
    // attentionPpm is non-zero (informational)
    expect(r.attentionPpm).toBeGreaterThan(0);
    // band may be warm/hot due to uncertainty/pressure but NOT due to heat
    // The key invariant: heatPpm = 0 when all erasures are accounted
  });

  test("source field encodes batchFrameId", () => {
    const env = makeEnvelope({ totalItems: 5, teachingCount: 5, erasureCount: 0 });
    const r = batchTemperatureReadout(env);
    expect(r.source).toBe("batch:test-frame");
  });

  test("schema field is the standard temperature readout schema", () => {
    const env = makeEnvelope({ totalItems: 5, teachingCount: 5, erasureCount: 0 });
    const r = batchTemperatureReadout(env);
    expect(r.schema).toBe("zeta.temperature.readout.v1");
  });

  test("critical band when >66% unaccounted", () => {
    const env = makeEnvelope({ totalItems: 10, teachingCount: 0, erasureCount: 8, accountedCount: 0 });
    const r = batchTemperatureReadout(env);
    expect(r.band).toBe("critical");
  });
});

// ── batchHeatLabel ────────────────────────────────────────────────────────────

describe("batchHeatLabel", () => {
  test("0 leaks → 'cold'", () => {
    expect(batchHeatLabel({ unaccountedHeat: 0, failedItems: 10 })).toBe("cold");
  });

  test("1 leak → 'warm (1 leak)'", () => {
    const label = batchHeatLabel({ unaccountedHeat: 1, failedItems: 10 });
    expect(label).toContain("1 leak");
    expect(label).not.toContain("leaks");
  });

  test("3 leaks → plural 'leaks'", () => {
    const label = batchHeatLabel({ unaccountedHeat: 3, failedItems: 10 });
    expect(label).toContain("3 leaks");
  });

  test("critical band shows in label", () => {
    const label = batchHeatLabel({ unaccountedHeat: 9, failedItems: 10 });
    expect(label).toContain("critical");
  });
});
