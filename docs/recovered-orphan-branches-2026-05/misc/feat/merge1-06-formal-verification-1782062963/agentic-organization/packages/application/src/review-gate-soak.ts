/**
 * Soak review gate — promotion gate requiring ≥100 ticks / ≥24h soak plus
 * required TLA+ specs and (when federated) a society-closure certificate.
 *
 * Faithful port of the Merge1 §06 review-gate upgrade. Pure + deterministic
 * (MP-1): the caller supplies `ticksSurvived` / `soakMs` / spec results, so the
 * gate replays identically. Result-shaped decision (MP-7).
 */

import type { TlaVerificationResult } from "./formal-verification-port.ts";
import {
  validateFiniteSocietyClosureCertificate,
  type FiniteSocietyClosureCertificate,
} from "./society-closure-certificate.ts";

export const DEFAULT_MIN_TICKS = 100;
export const DEFAULT_MIN_SOAK_MS = 86_400_000; // 24h
export const DEFAULT_REQUIRED_SPECS: readonly string[] = ["SocietyEmergence", "SocietyRuntimeRefinement"];

export type SoakGateCriteria = {
  /** Minimum ticks the room must survive before promotion. */
  readonly minTicks: number;
  /** Minimum wall-clock duration before promotion. */
  readonly minSoakMs: number;
  /** TLA+ specs that must pass. */
  readonly requiredSpecs: readonly string[];
};

export const DEFAULT_SOAK_GATE_CRITERIA: SoakGateCriteria = {
  minTicks: DEFAULT_MIN_TICKS,
  minSoakMs: DEFAULT_MIN_SOAK_MS,
  requiredSpecs: DEFAULT_REQUIRED_SPECS,
};

export type SoakGateInput = {
  readonly ticksSurvived: number;
  readonly soakMs: number;
  readonly criteria: SoakGateCriteria;
  /** TLA+ results keyed by spec name (e.g. from a FormalVerificationPort). */
  readonly specResults?: ReadonlyMap<string, TlaVerificationResult>;
  /** Society-closure certificate, required only when the room is federated. */
  readonly closureCertificate?: FiniteSocietyClosureCertificate;
};

export type SoakGateResult =
  | {
      readonly outcome: "promoted";
      readonly criteria: SoakGateCriteria;
      readonly ticksSurvived: number;
      readonly soakMs: number;
    }
  | { readonly outcome: "blocked"; readonly reason: string; readonly missingCriteria: readonly string[] };

/** Evaluate the soak gate. Promotes only when EVERY criterion is met. */
export function evaluateSoakGate(input: SoakGateInput): SoakGateResult {
  const missing: string[] = [];

  if (input.ticksSurvived < input.criteria.minTicks) {
    missing.push(`ticks ${input.ticksSurvived} < ${input.criteria.minTicks}`);
  }
  if (input.soakMs < input.criteria.minSoakMs) {
    missing.push(`soak ${input.soakMs}ms < ${input.criteria.minSoakMs}ms`);
  }
  for (const spec of input.criteria.requiredSpecs) {
    const result = input.specResults?.get(spec);
    if (!result) {
      missing.push(`spec ${spec}: not run`);
    } else if (result.outcome !== "pass") {
      missing.push(`spec ${spec}: ${result.outcome}`);
    }
  }
  if (input.closureCertificate) {
    const validation = validateFiniteSocietyClosureCertificate(input.closureCertificate);
    if (!validation.ok) {
      missing.push(`closure certificate invalid: ${validation.reason}`);
    }
  }

  if (missing.length > 0) {
    return { outcome: "blocked", reason: missing.join("; "), missingCriteria: missing };
  }
  return {
    outcome: "promoted",
    criteria: input.criteria,
    ticksSurvived: input.ticksSurvived,
    soakMs: input.soakMs,
  };
}
