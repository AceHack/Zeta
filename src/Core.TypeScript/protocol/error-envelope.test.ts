/**
 * error-envelope.test.ts — Tests for the canonical error envelope.
 *
 * EE-1..EE-4: basic envelope construction and dual register
 * EE-5..EE-7: idempotency guard
 * EE-8..EE-10: EP observation adapter
 * EE-11..EE-12: negative controls (bare error, unknown dimension)
 */
import { describe, test, expect } from "bun:test";
import {
  teachingError,
  bareError,
  toEpObservation,
  envelopeId,
  EnvelopeIdempotencyGuard,
  type ErrorMirror,
} from "./error-envelope";

const EMITTED_AT = "2026-08-09T00:00:00.000Z";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMirror(overrides: Partial<ErrorMirror> = {}): ErrorMirror {
  return {
    what: "field 'predictedDeadline' is missing",
    why: "the receiver cannot distinguish 'field absent' from 'field present but null' without this",
    howToFix: "add predictedDeadline: number to the request body",
    dimension: "schema",
    severity: "error",
    ...overrides,
  };
}

describe("ErrorEnvelope", () => {
  // EE-1: teaching error has all four parts
  test("EE-1: teaching error carries all four parts in the mirror", () => {
    const env = teachingError("corr-001", makeMirror(), EMITTED_AT);
    expect(env.mirror.what).toBeTruthy();
    expect(env.mirror.why).toBeTruthy();
    expect(env.mirror.howToFix).toBeTruthy();
    expect(env.mirror.dimension).toBe("schema");
    expect(env.emittedAt).toBe(EMITTED_AT);
  });

  // EE-2: beacon prose contains the dimension tag
  test("EE-2: beacon prose contains the dimension and severity tags", () => {
    const env = teachingError("corr-002", makeMirror({ severity: "warn", dimension: "type" }), EMITTED_AT);
    expect(env.beacon).toContain("[TYPE/WARN]");
    expect(env.beacon).toContain("Why:");
    expect(env.beacon).toContain("Fix:");
  });

  // EE-3: envelopeId is deterministic (same inputs → same id)
  test("EE-3: envelopeId is deterministic", () => {
    const id1 = envelopeId("c1", "schema", "field X", "because Y");
    const id2 = envelopeId("c1", "schema", "field X", "because Y");
    expect(id1).toBe(id2);
  });

  // EE-4: different inputs produce different ids (collision resistance)
  test("EE-4: different inputs produce different envelopeIds", () => {
    const id1 = envelopeId("c1", "schema", "field X", "because Y");
    const id2 = envelopeId("c1", "schema", "field X", "because Z");
    expect(id1).not.toBe(id2);
  });

  // EE-5: idempotency guard absorbs first delivery
  test("EE-5: idempotency guard absorbs first delivery", () => {
    const guard = new EnvelopeIdempotencyGuard();
    const env = teachingError("c1", makeMirror(), EMITTED_AT);
    expect(guard.absorb(env)).toBe(true);
  });

  // EE-6: idempotency guard drops duplicate delivery
  test("EE-6: idempotency guard drops duplicate delivery", () => {
    const guard = new EnvelopeIdempotencyGuard();
    const env = teachingError("c1", makeMirror(), EMITTED_AT);
    guard.absorb(env);
    expect(guard.absorb(env)).toBe(false); // duplicate — drop
  });

  // EE-7: idempotency guard absorbs distinct envelopes
  test("EE-7: idempotency guard absorbs distinct envelopes independently", () => {
    const guard = new EnvelopeIdempotencyGuard();
    const env1 = teachingError("c1", makeMirror({ what: "field A" }), EMITTED_AT);
    const env2 = teachingError("c2", makeMirror({ what: "field B" }), EMITTED_AT);
    expect(guard.absorb(env1)).toBe(true);
    expect(guard.absorb(env2)).toBe(true);
    expect(guard.count).toBe(2);
  });

  // EE-8: toEpObservation returns correct z-score for severity
  test("EE-8: toEpObservation maps severity to z-score", () => {
    const envError = teachingError("c1", makeMirror({ severity: "error" }), EMITTED_AT);
    const envFatal = teachingError("c2", makeMirror({ severity: "fatal" }), EMITTED_AT);
    const obsError = toEpObservation(envError);
    const obsFatal = toEpObservation(envFatal);
    expect(obsError.x).toBe(2.0);
    expect(obsFatal.x).toBe(4.0);
    expect(obsFatal.x).toBeGreaterThan(obsError.x); // fatal > error
  });

  // EE-9: toEpObservation carries the dimension for targeted factor update
  test("EE-9: toEpObservation carries dimension for targeted factor update", () => {
    const env = teachingError("c1", makeMirror({ dimension: "calibration" }), EMITTED_AT);
    const obs = toEpObservation(env);
    expect(obs.dimension).toBe("calibration");
  });

  // EE-10: toEpObservation marks retraction when retractableBeliefId is set
  test("EE-10: toEpObservation marks isRetraction when retractableBeliefId is set", () => {
    const env = teachingError("c1", makeMirror({ retractableBeliefId: "belief-abc123" }), EMITTED_AT);
    const obs = toEpObservation(env);
    expect(obs.isRetraction).toBe(true);
  });

  // EE-11: bare error has dimension "unknown"
  test("EE-11: bare error has dimension 'unknown' (expensive path)", () => {
    const env = bareError("c1", "something failed", "we do not know why", EMITTED_AT);
    expect(env.mirror.dimension).toBe("unknown");
    const obs = toEpObservation(env);
    expect(obs.dimension).toBe("unknown"); // smears probability — expensive
  });

  // EE-12: bare error is NOT a retraction (erasure path)
  test("EE-12: bare error is not a retraction (erasure path, Landauer floor paid)", () => {
    const env = bareError("c1", "something failed", "we do not know why", EMITTED_AT);
    const obs = toEpObservation(env);
    expect(obs.isRetraction).toBe(false); // no retractableBeliefId → erasure
  });
});
