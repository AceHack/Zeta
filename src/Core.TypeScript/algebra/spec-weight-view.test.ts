/**
 * spec-weight-view.test.ts — ranked-surprisal view over branch events.
 *
 * Verifies: nth branch = weight n, accumulated potential = T(n) = n(n-1)/2,
 * flush resets the window, composes with the flat entropy tracker.
 */

import { describe, test, expect } from "bun:test";
import { createEntropyTracker } from "./entropy-tracker";
import { createSpecWeightView, createMeteredSpecWeightTracker } from "./spec-weight-view";

describe("SpecWeightView — ranked branch weights (triangular accumulation)", () => {
  test("no branches = zero potential", () => {
    const view = createSpecWeightView();
    expect(view.potential).toBe(0);
    expect(view.state.branches).toBe(0);
  });

  test("1 branch: weight=1, potential=T(1)=0", () => {
    const view = createSpecWeightView();
    view.recordBranch();
    expect(view.state.branches).toBe(1);
    expect(view.state.lastWeight).toBe(1);
    expect(view.potential).toBe(0); // T(1) = 1*0/2 = 0
  });

  test("2 branches: potential=T(2)=1", () => {
    const view = createSpecWeightView();
    view.recordBranch();
    view.recordBranch();
    expect(view.potential).toBe(1); // T(2) = 2*1/2 = 1
  });

  test("5 branches: potential=T(5)=10", () => {
    const view = createSpecWeightView();
    for (let i = 0; i < 5; i++) view.recordBranch();
    expect(view.potential).toBe(10); // T(5) = 5*4/2 = 10
  });

  test("10 branches: potential=T(10)=45", () => {
    const view = createSpecWeightView();
    for (let i = 0; i < 10; i++) view.recordBranch();
    expect(view.potential).toBe(45); // T(10) = 10*9/2 = 45
  });

  test("potential matches the CostRecurrence closed form: n*(n-1)/2", () => {
    const view = createSpecWeightView();
    for (let n = 0; n <= 20; n++) {
      const expected = n < 2 ? 0 : (n * (n - 1)) / 2;
      expect(view.potential).toBe(expected);
      view.recordBranch();
    }
  });

  test("flush resets the window (potential paid, start fresh)", () => {
    const view = createSpecWeightView();
    view.recordBranch();
    view.recordBranch();
    view.recordBranch();
    expect(view.potential).toBe(3); // T(3) = 3

    view.recordFlush(3);
    expect(view.potential).toBe(0); // reset
    expect(view.state.branches).toBe(0);

    // New accumulation starts from rank 1 again
    view.recordBranch();
    expect(view.state.lastWeight).toBe(1);
  });

  test("average weight = (n-1)/2", () => {
    const view = createSpecWeightView();
    for (let i = 0; i < 10; i++) view.recordBranch();
    expect(view.state.averageWeight).toBe(4.5); // (10-1)/2 = 4.5
  });
});

describe("MeteredSpecWeightTracker — composed flat + ranked", () => {
  test("branch updates BOTH flat tracker and ranked view", () => {
    const tracker = createEntropyTracker();
    const metered = createMeteredSpecWeightTracker(tracker);

    metered.branch();
    metered.branch();
    metered.branch();

    // Flat: 3 bits of uncertainty
    expect(tracker.state.entropy_state).toBe(3);
    // Ranked: potential = T(3) = 3
    expect(metered.view.potential).toBe(3);
  });

  test("measure pays Landauer on tracker AND flushes the view window", () => {
    const tracker = createEntropyTracker();
    const metered = createMeteredSpecWeightTracker(tracker);

    metered.branch();
    metered.branch();
    metered.branch();
    metered.branch(); // flat: state=4, view: potential=T(4)=6

    metered.measure(4); // Landauer: state→0, heat→4, view resets

    expect(tracker.state.entropy_state).toBe(0);
    expect(tracker.state.entropy_heat).toBe(4);
    expect(metered.view.potential).toBe(0); // window reset
  });

  test("a ZERO-bit measurement discharges nothing — the window only pays when bits were paid", () => {
    // `recordFlush` used to ignore its argument (`_bitsErased`), so `measure(0)` wiped the
    // accumulated potential exactly as hard as `measure(1000)`. Harmless while every caller passed
    // a positive literal; not harmless now that reversible operations charge a DERIVED zero
    // (erasure-derivation.ts) — the point of a derived zero is that nothing was paid.
    const tracker = createEntropyTracker();
    const metered = createMeteredSpecWeightTracker(tracker);

    metered.branch();
    metered.branch();
    metered.branch();
    metered.branch(); // view: potential = T(4) = 6

    metered.measure(0); // a reversible operation: erases nothing, so pays nothing

    expect(tracker.state.entropy_heat).toBe(0);
    expect(metered.view.potential).toBe(6); // window intact — nothing was discharged
    expect(metered.view.state.branches).toBe(4);

    metered.measure(4); // a real erasure DOES discharge it
    expect(metered.view.potential).toBe(0);
  });

  test("observe is free on both (Adj, no view change)", () => {
    const tracker = createEntropyTracker();
    const metered = createMeteredSpecWeightTracker(tracker);

    metered.branch();
    metered.branch();
    metered.observe();
    metered.observe();

    expect(tracker.state.soft_observations).toBe(2);
    expect(tracker.state.entropy_heat).toBe(0);
    expect(metered.view.state.branches).toBe(2); // observe doesn't add branches
  });

  test("the two perspectives agree on the second law", () => {
    const tracker = createEntropyTracker();
    const metered = createMeteredSpecWeightTracker(tracker);

    // Accumulate then flush
    for (let i = 0; i < 7; i++) metered.branch();
    metered.measure(7);

    // Flat: second law holds
    expect(tracker.state.second_law_satisfied).toBe(true);
    // Ranked: potential was T(7)=21, now paid (view=0)
    expect(metered.view.potential).toBe(0);
  });

  test("multiple flush cycles: each window is independent", () => {
    const tracker = createEntropyTracker();
    const metered = createMeteredSpecWeightTracker(tracker);

    // Window 1: 3 branches → potential=3 → flush
    metered.branch(); metered.branch(); metered.branch();
    expect(metered.view.potential).toBe(3);
    metered.measure(3);

    // Window 2: 4 branches → potential=6 → flush
    metered.branch(); metered.branch(); metered.branch(); metered.branch();
    expect(metered.view.potential).toBe(6);
    metered.measure(4);

    // Flat tracker accumulated all heat: 3+4 = 7
    expect(tracker.state.entropy_heat).toBe(7);
    // View is fresh
    expect(metered.view.potential).toBe(0);
  });
});
