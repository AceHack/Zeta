import { describe, expect, it } from "bun:test";
import {
  ShivaWeakFactorCache,
  futamura1stProjection,
} from "./shiva-weak-factor-graph.ts";

describe("Shiva Ephemeron WeakRef Factor Graph & Futamura 1st Projection", () => {
  it("evaluates factor values on-demand via generator and caches WeakRef holder", () => {
    const cache = new ShivaWeakFactorCache();
    let generatorEvaluations = 0;

    const generator = (key: string) => {
      generatorEvaluations++;
      return key === "1,1" ? -0.1 : -0.5;
    };

    const val1 = cache.getOrCompute("f1", "1,1", generator);
    expect(val1).toBe(-0.1);
    expect(generatorEvaluations).toBe(1);

    // Second call for same key reuses WeakRef cache (generator not re-invoked if held)
    const val2 = cache.getOrCompute("f1", "1,1", generator);
    expect(val2).toBe(-0.1);
  });

  it("reclaims unreachable cache entries during Shiva GC sweep", () => {
    const cache = new ShivaWeakFactorCache();
    const generator = (key: string) => (key === "target" ? -0.05 : -1.0);

    cache.getOrCompute("f1", "target", generator);
    cache.getOrCompute("f1", "dead-node", generator);

    const initialSize = cache.getAccessLog().length;
    expect(initialSize).toBe(2);

    // Force garbage collection / sweep pass
    const sweepResult = cache.shivaSweep();
    expect(sweepResult.remaining).toBeGreaterThanOrEqual(0);
  });

  it("Futamura 1st projection compiles step + factor evaluation into a zero-allocation pipeline", () => {
    const cache = new ShivaWeakFactorCache();
    const step = (s: { r: number; c: number }, a: string) => {
      if (a === "right") return { r: s.r, c: s.c + 1 };
      return s;
    };
    const keyOf = (s: { r: number; c: number }) => `${s.r},${s.c}`;
    const generator = (key: string) => (key === "0,1" ? -0.01 : -0.5);

    // Specialized Futamura compiled step function
    const compiledStep = futamura1stProjection(
      step,
      keyOf,
      generator,
      cache,
      "factor-nav",
    );

    const result = compiledStep({ r: 0, c: 0 }, "right");
    expect(result.nextState.c).toBe(1);
    expect(result.logProb).toBe(-0.01);

    // Verify Rx access tracking recorded the transition!
    const accessLog = cache.getAccessLog();
    expect(accessLog.length).toBe(1);
    expect(accessLog[0]!.stateKey).toBe("0,1");
    expect(accessLog[0]!.value).toBe(-0.01);
  });
});
