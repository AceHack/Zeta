import { describe, expect, it } from "bun:test";
import {
  ShivaWeakFactorCache,
  ShivaMarkSweepGc,
  futamura1stProjection,
} from "./shiva-weak-factor-graph.ts";

describe("Shiva Ephemeron WeakRef Factor Graph & Deterministic Mark-Sweep GC", () => {
  it("DETERMINISTIC SHIVA GC: tri-color mark-and-sweep matching F# ShivaGc.fs (same roots+heap -> same result)", () => {
    const gc = new ShivaMarkSweepGc<string>();

    gc.allocate("root-01", "root-data", ["child-01"]);
    gc.allocate("child-01", "child-data", []);
    gc.allocate("dead-node-02", "orphan-data", []);

    gc.addRoot("root-01");

    // Sweeping reclaims dead-node-02 because it is unreachable from roots
    const sweep1 = gc.markAndSweep();
    expect(sweep1.retractedIds).toEqual(["dead-node-02"]);
    expect(sweep1.remainingCount).toBe(2);
    expect(gc.has("child-01")).toBeTrue();
    expect(gc.has("dead-node-02")).toBeFalse();

    // Removing root-01 and sweeping reclaims everything deterministically
    gc.removeRoot("root-01");
    const sweep2 = gc.markAndSweep();
    expect([...sweep2.retractedIds].sort()).toEqual(["child-01", "root-01"]);
    expect(sweep2.remainingCount).toBe(0);
  });

  it("SHIVA SWEEP TEST: unpinning a strong root forces retraction (totalRetracted > 0)", () => {
    const cache = new ShivaWeakFactorCache();
    const generator = (key: string) => (key === "target" ? -0.05 : -1.0);

    cache.getOrCompute("f1", "target", generator);
    cache.getOrCompute("f1", "dead-node", generator);

    // Unpin root to allow Shiva GC retraction
    cache.unpinRoot("f1:dead-node");

    const sweepResult = cache.shivaSweep();
    expect(sweepResult.totalRetracted).toBeGreaterThan(0);
    expect(sweepResult.remaining).toBe(1);
  });

  it("NEGATIVE CONTROL: pinned roots are NOT retracted during sweep", () => {
    const cache = new ShivaWeakFactorCache();
    const generator = () => -0.1;

    cache.getOrCompute("f1", "pinned-node", generator);

    // Without unpinning, sweep MUST retract 0 entries (negative control!)
    const sweepResult = cache.shivaSweep();
    expect(sweepResult.totalRetracted).toBe(0);
    expect(sweepResult.remaining).toBe(1);
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
