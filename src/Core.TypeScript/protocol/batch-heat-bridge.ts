/**
 * batch-heat-bridge.ts
 *
 * Converts BatchTeachingEnvelope.summary.unaccountedHeat into a TemperatureReadout
 * using Vera's heat.ts thresholds (matching Heat.fs exactly):
 *
 *   Cold:     unaccountedHeat = 0                    → 0 ppm
 *   Warm:     unaccountedHeat / total ≤ 33.3%        → ≤ 333_333 ppm
 *   Hot:      unaccountedHeat / total ≤ 66.6%        → ≤ 666_666 ppm
 *   Critical: unaccountedHeat / total > 66.6%        → > 666_666 ppm
 *
 * The alarm fires on unaccountedHeat ONLY — deliberate erasures (accountedHeat)
 * are the system working and are NOT alarming.
 *
 * Grounding:
 *   - Vera's TemperatureBand: src/Core/Heat.fs (WarmMaxPpm=333_333, HotMaxPpm=666_666)
 *   - TS mirror: src/Core.TypeScript/darkhall-ui/heat.ts (same constants)
 *   - Alarm semantics: docs/research/2026-08-10-tsirelson-… §4a
 *     "a versioned migration is Adj-shaped (near-free); a migration that drops the
 *      old form is an erasure and pays."
 *
 * Four-corner anchor:
 *   The unaccountedHeat ratio is the heat channel's own four-corner feedback signal:
 *   - DBSP/differential dataflow: the delta between expected and actual erasures
 *   - Bitemporality: valid-time (accounted) vs transaction-time (unaccounted)
 *   - AGM belief revision: the system revises its belief about erasure cost
 *   - Stückelberg–Feynman: the −1 retraction arrives forward in time with inverted sign
 */

import {
  temperatureReadout,
  temperatureBand,
  MAX_TEMPERATURE_PPM,
  WARM_TEMPERATURE_MAX_PPM,
  HOT_TEMPERATURE_MAX_PPM,
  type TemperatureBand,
  type TemperatureReadout,
} from "../darkhall-ui/heat";
import type { BatchTeachingEnvelope, BatchSummary } from "./batch-teaching-envelope";

export type { TemperatureBand, TemperatureReadout };

/**
 * Convert a BatchSummary's unaccountedHeat into a heat ppm value.
 *
 * Mapping:
 *   unaccountedHeat = 0                     → 0 ppm (cold)
 *   unaccountedHeat / totalItems ≤ 1/3      → proportional in [1, WarmMaxPpm]
 *   unaccountedHeat / totalItems ≤ 2/3      → proportional in [WarmMaxPpm+1, HotMaxPpm]
 *   unaccountedHeat / totalItems > 2/3      → proportional in [HotMaxPpm+1, MaxPpm]
 *
 * The total denominator is max(1, failedItems) so a batch with 0 failures
 * always reads cold regardless of unaccountedHeat (which should be 0 anyway).
 */
export function unaccountedHeatPpm(summary: Pick<BatchSummary, "unaccountedHeat" | "failedItems">): number {
  const { unaccountedHeat, failedItems } = summary;
  if (unaccountedHeat <= 0) return 0;
  const denom = Math.max(1, failedItems);
  const ratio = Math.min(1, unaccountedHeat / denom);
  // Map ratio [0,1] → ppm [0, MAX_TEMPERATURE_PPM]
  // Use 1 as the minimum non-zero value so unaccountedHeat=1 is never cold
  return Math.max(1, Math.round(ratio * MAX_TEMPERATURE_PPM));
}

/**
 * Derive the TemperatureBand from a BatchSummary.
 * This is the fast path — no TemperatureReadout allocation needed.
 */
export function batchTemperatureBand(
  summary: Pick<BatchSummary, "unaccountedHeat" | "failedItems">,
): TemperatureBand {
  return temperatureBand(unaccountedHeatPpm(summary));
}

/**
 * Build a full TemperatureReadout from a BatchTeachingEnvelope.
 *
 * - heatPpm:        unaccountedHeat ratio → ppm (the alarm signal)
 * - uncertaintyPpm: (1 - teachingRatio) * MaxPpm — how much of the batch is erasure vs teaching
 * - pressurePpm:    bareErasures / totalItems * MaxPpm — raw erasure pressure
 * - attentionPpm:   accountedHeat / totalItems * MaxPpm — deliberate erasures (informational)
 *
 * The temperature (max of heat/uncertainty/pressure) drives the band.
 * attentionPpm is informational only and does NOT drive the temperature.
 */
export function batchTemperatureReadout(envelope: BatchTeachingEnvelope): TemperatureReadout {
  const s = envelope.summary;
  const denom = Math.max(1, s.totalItems);
  const heatPpm = unaccountedHeatPpm(s);
  const uncertaintyPpm = Math.round((1 - s.teachingRatio) * MAX_TEMPERATURE_PPM);
  const pressurePpm = Math.round((s.bareErasures / denom) * MAX_TEMPERATURE_PPM);
  const attentionPpm = Math.round((s.accountedHeat / denom) * MAX_TEMPERATURE_PPM);
  return temperatureReadout({
    source: `batch:${envelope.batchFrameId}`,
    heatPpm,
    uncertaintyPpm,
    pressurePpm,
    attentionPpm,
  });
}

/**
 * Quick summary string for logging/display.
 * Format: "cold" | "warm (3 leaks)" | "hot (5 leaks)" | "critical (8 leaks)"
 */
export function batchHeatLabel(summary: Pick<BatchSummary, "unaccountedHeat" | "failedItems">): string {
  const band = batchTemperatureBand(summary);
  if (band === "cold") return "cold";
  const n = summary.unaccountedHeat;
  return `${band} (${n} leak${n !== 1 ? "s" : ""})`;
}

// Re-export thresholds for consumers that want to draw their own gauges
export { MAX_TEMPERATURE_PPM, WARM_TEMPERATURE_MAX_PPM, HOT_TEMPERATURE_MAX_PPM };
