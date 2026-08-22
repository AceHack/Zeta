/**
 * bnn-persistence.test.ts — Tests for BNN state persistence and tangle avoidance.
 */
import { describe, test, expect } from "bun:test";
import {
  serializeBnn,
  deserializeBnn,
  tangleBreakObservation,
} from "./bnn-persistence";

// ── Minimal DimensionalBnn stub for testing ────────────────────────────────────

function makeMockBnn(dims: Array<{ name: string; mu: number; sigma2: number; nu: number }>) {
  const states = new Map(dims.map(d => [d.name, {
    posterior: { mu: d.mu, sigma2: d.sigma2 },
    factorMu: 0, factorSigma2: 1,
    nu: d.nu, obsVariance: 0.1, obsCount: 5,
  }]));
  const robustnessWeights = new Map(dims.map(d => [d.name, 0.8]));
  // Minimal EnvelopeIdempotencyGuard stub
  const guard = { seen: new Set<string>(), check: (_id: string) => false };
  return { states, robustnessWeights, guard };
}

describe("bnn-persistence", () => {
  // BP-1: Serialize round-trips all dimension fields
  test("BP-1: serialize preserves mu/sigma2/nu per dimension", () => {
    const bnn = makeMockBnn([
      { name: "schema", mu: 0.3, sigma2: 0.04, nu: 5 },
      { name: "toolchain", mu: 0.7, sigma2: 0.02, nu: 10 },
    ]);
    const state = serializeBnn(bnn as never, "agent-1");
    expect(state.dimensions).toHaveLength(2);
    const schema = state.dimensions.find(d => d.dimension === "schema");
    expect(schema?.mu).toBeCloseTo(0.3, 5);
    expect(schema?.sigma2).toBeCloseTo(0.04, 5);
    expect(schema?.nu).toBe(5);
  });

  // BP-2: Serialize captures totalObservations
  test("BP-2: serialize captures totalObservations", () => {
    const bnn = makeMockBnn([{ name: "congestion", mu: 0.5, sigma2: 0.1, nu: 3 }]);
    const state = serializeBnn(bnn as never, "agent-2");
    expect(state.totalObservations).toBe(5);
  });

  // BP-3: Serialize captures zetaId and updatedAt
  test("BP-3: serialize captures zetaId and updatedAt", () => {
    const bnn = makeMockBnn([]);
    const state = serializeBnn(bnn as never, "agent-zeta-42");
    expect(state.zetaId).toBe("agent-zeta-42");
    expect(new Date(state.updatedAt).getTime()).toBeGreaterThan(0);
  });

  // BP-4: Tangle warning fires when rhoProxy > 0.8
  test("BP-4: tangleWarning=true when rhoProxy > 0.8", () => {
    const bnn = makeMockBnn([]);
    const state = serializeBnn(bnn as never, "agent-3", [0.5, 0.7, 0.85, 0.9]);
    expect(state.tangleWarning).toBe(true);
  });

  // BP-5: No tangle warning when rhoProxy <= 0.8
  test("BP-5: tangleWarning=false when rhoProxy <= 0.8", () => {
    const bnn = makeMockBnn([]);
    const state = serializeBnn(bnn as never, "agent-4", [0.3, 0.5, 0.75]);
    expect(state.tangleWarning).toBe(false);
  });

  // BP-6: rhoHistory is capped at 16 entries
  test("BP-6: rhoHistory is capped at 16 entries", () => {
    const bnn = makeMockBnn([]);
    const longHistory = Array.from({ length: 30 }, (_, i) => i / 30);
    const state = serializeBnn(bnn as never, "agent-5", longHistory);
    expect(state.rhoHistory.length).toBeLessThanOrEqual(16);
  });

  // BP-7: Deserialize restores mu/sigma2/nu
  test("BP-7: deserialize restores EP state per dimension", () => {
    const bnn = makeMockBnn([
      { name: "schema", mu: 0.3, sigma2: 0.04, nu: 5 },
      { name: "toolchain", mu: 0.7, sigma2: 0.02, nu: 10 },
    ]);
    const state = serializeBnn(bnn as never, "agent-6");
    const { bnn: restored, tangleWarning } = deserializeBnn(state);
    expect(tangleWarning).toBe(false);
    const schema = restored.states.get("schema");
    expect(schema?.posterior.mu).toBeCloseTo(0.3, 5);
    expect(schema?.nu).toBe(5);
  });

  // BP-8: Deserialize propagates tangleWarning
  test("BP-8: deserialize propagates tangleWarning", () => {
    const bnn = makeMockBnn([]);
    const state = serializeBnn(bnn as never, "agent-7", [0.9]);
    const { tangleWarning } = deserializeBnn(state);
    expect(tangleWarning).toBe(true);
  });

  // BP-9: tangleBreakObservation returns the I-closed Adinkra codeword {0,3,4,7}
  test("BP-9: tangleBreakObservation uses I-closed Adinkra codeword {0,3,4,7}", () => {
    const obs = tangleBreakObservation(0.85);
    expect(obs.adinkraCw).toEqual([0, 3, 4, 7]);
    expect(obs.dimension).toBe("tangle");
    expect(obs.rhoProxy).toBeCloseTo(0.85, 5);
  });

  // BP-10 (negative): tangleBreakObservation is not triggered when rhoProxy <= 0.8
  test("BP-10 (negative): tangleBreak still returns codeword but caller should check rhoProxy", () => {
    const obs = tangleBreakObservation(0.5);
    // The function always returns the codeword — the caller decides whether to inject it
    expect(obs.adinkraCw).toEqual([0, 3, 4, 7]);
    // The caller should only inject when rhoProxy > 0.8
    expect(obs.rhoProxy).toBeCloseTo(0.5, 5);
  });
});
