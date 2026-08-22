/**
 * physics-traits.test.ts — verify the CSLib → Physics trait mapping.
 *
 * Three data structures, three thermodynamic characters:
 *   Array  = Adj (reversible, zero heat)
 *   HashMap = non-Adj (irreversible hash, Landauer cost)
 *   Queue  = Ferry (batched commit, amortized cost)
 */

import { describe, test, expect } from "bun:test";
import { createEntropyTracker } from "./entropy-tracker";
import {
  createAdjArray,
  createNonAdjMap,
  createFerryQueue,
  TRAIT_COSTS,
} from "./physics-traits";

describe("AdjArray — reversible random-access, zero heat", () => {
  test("reads produce zero heat (Bennett: Adj observation is free)", () => {
    const tracker = createEntropyTracker();
    const arr = createAdjArray(tracker, [10, 20, 30]);

    arr.get(0);
    arr.get(1);
    arr.get(2);

    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.soft_observations).toBe(3);
  });

  test("writes produce zero heat (reversible: old value returned as inverse)", () => {
    const tracker = createEntropyTracker();
    const arr = createAdjArray(tracker, [10, 20, 30]);

    const old = arr.set(1, 99);
    expect(old).toBe(20); // the inverse is preserved

    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.hard_measurements).toBe(0);
  });

  test("toArray is a bulk observation (zero heat)", () => {
    const tracker = createEntropyTracker();
    const arr = createAdjArray(tracker, [1, 2, 3, 4, 5]);

    const snapshot = arr.toArray();
    expect(snapshot).toEqual([1, 2, 3, 4, 5]);
    expect(tracker.state.entropy_heat).toBe(0);
  });

  test("trait is adj", () => {
    const tracker = createEntropyTracker();
    const arr = createAdjArray(tracker);
    expect(arr.trait).toBe("adj");
  });

  test("second law holds: total entropy ≥ 0 after any sequence", () => {
    const tracker = createEntropyTracker();
    const arr = createAdjArray(tracker, [1, 2, 3]);

    arr.get(0); arr.set(0, 99); arr.get(1); arr.set(2, 0); arr.toArray();

    expect(tracker.state.second_law_satisfied).toBe(true);
    expect(tracker.state.entropy_state + tracker.state.entropy_heat).toBeGreaterThanOrEqual(0);
  });
});

describe("NonAdjMap — irreversible hash, Landauer cost per mutation", () => {
  test("reads produce zero heat (lookup by key is Adj)", () => {
    const tracker = createEntropyTracker();
    const map = createNonAdjMap<string, number>(tracker);
    // Seed some data (pays heat)
    tracker.branch(); // add uncertainty so measure doesn't go negative
    map.put("a", 1);

    // Reset tracker to isolate read cost
    tracker.reset();
    map.get("a");
    map.has("a");

    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.soft_observations).toBe(2);
  });

  test("put pays 1 bit Landauer heat per mutation", () => {
    const tracker = createEntropyTracker();
    const map = createNonAdjMap<string, number>(tracker);

    // Pre-branch so measure(1) doesn't underflow
    tracker.branch(); tracker.branch(); tracker.branch();

    map.put("x", 1);
    map.put("y", 2);
    map.put("z", 3);

    expect(tracker.state.entropy_heat).toBe(3);
    expect(tracker.state.hard_measurements).toBe(3);
  });

  test("delete pays 1 bit Landauer heat (erasure)", () => {
    const tracker = createEntropyTracker();
    const map = createNonAdjMap<string, number>(tracker);

    tracker.branch(); tracker.branch();
    map.put("a", 1); // heat=1
    map.delete("a"); // heat=2

    expect(tracker.state.entropy_heat).toBe(2);
  });

  test("entries() is a bulk observation (zero additional heat)", () => {
    const tracker = createEntropyTracker();
    const map = createNonAdjMap<string, number>(tracker);

    tracker.branch(); tracker.branch();
    map.put("a", 1);
    map.put("b", 2);

    const heatBefore = tracker.state.entropy_heat;
    map.entries();
    expect(tracker.state.entropy_heat).toBe(heatBefore); // no new heat
  });

  test("trait is non-adj", () => {
    const tracker = createEntropyTracker();
    const map = createNonAdjMap<string, number>(tracker);
    expect(map.trait).toBe("non-adj");
  });
});

describe("FerryQueue — batched commit, amortized Landauer cost", () => {
  test("enqueue is a branch (+1 bit uncertainty, zero heat)", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);

    q.enqueue("a");
    q.enqueue("b");
    q.enqueue("c");

    expect(tracker.state.entropy_state).toBe(3); // 3 bits of uncertainty
    expect(tracker.state.entropy_heat).toBe(0);  // no heat yet (nothing committed)
    expect(q.pending).toBe(3);
  });

  test("dequeue pays 1 bit Landauer (mini-commit)", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);

    q.enqueue("a"); // branch: state=1
    q.enqueue("b"); // branch: state=2

    const item = q.dequeue();
    expect(item).toBe("a");
    expect(tracker.state.entropy_heat).toBe(1);  // paid 1 bit
    expect(tracker.state.entropy_state).toBe(1); // 1 bit remains
    expect(q.pending).toBe(1);
  });

  test("flush pays Landauer for the ENTIRE batch at once (the ferry commit)", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<number>(tracker);

    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    q.enqueue(4);
    // State: 4 bits of uncertainty, 0 heat

    const batch = q.flush();
    expect(batch).toEqual([1, 2, 3, 4]);
    expect(tracker.state.entropy_heat).toBe(4);  // paid ALL 4 bits at once
    expect(tracker.state.entropy_state).toBe(0); // fully collapsed
    expect(q.pending).toBe(0);
  });

  test("peek is Adj (observe, zero heat)", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);

    q.enqueue("first");
    const heatBefore = tracker.state.entropy_heat;
    const peeked = q.peek();

    expect(peeked).toBe("first");
    expect(tracker.state.entropy_heat).toBe(heatBefore); // no heat for peek
  });

  test("snapshot is Adj (observe, zero heat)", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);

    q.enqueue("a"); q.enqueue("b");
    const snap = q.snapshot();

    expect(snap).toEqual(["a", "b"]);
    expect(tracker.state.entropy_heat).toBe(0); // observe only
  });

  test("flush of empty queue pays zero (no batch = no cost)", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);

    const batch = q.flush();
    expect(batch).toEqual([]);
    expect(tracker.state.entropy_heat).toBe(0);
  });

  test("trait is ferry", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);
    expect(q.trait).toBe("ferry");
  });

  test("second law holds across enqueue/flush cycle", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<number>(tracker);

    q.enqueue(1); q.enqueue(2); q.enqueue(3);
    q.flush();

    // Total = state + heat = 0 + 3 = 3 ≥ 0 (initial)
    expect(tracker.state.second_law_satisfied).toBe(true);
    expect(tracker.state.entropy_state + tracker.state.entropy_heat).toBe(3);
  });
});

describe("TRAIT_COSTS — static classification metadata", () => {
  test("adj: reads and writes are free, reversible, not batchable", () => {
    const c = TRAIT_COSTS.adj;
    expect(c.readCost).toBe("zero");
    expect(c.writeCost).toBe("zero");
    expect(c.reversible).toBe(true);
    expect(c.batchable).toBe(false);
  });

  test("non-adj: reads free, writes cost, irreversible, not batchable", () => {
    const c = TRAIT_COSTS["non-adj"];
    expect(c.readCost).toBe("zero");
    expect(c.writeCost).toBe("landauer");
    expect(c.reversible).toBe(false);
    expect(c.batchable).toBe(false);
  });

  test("ferry: reads free, writes cost, irreversible, batchable", () => {
    const c = TRAIT_COSTS.ferry;
    expect(c.readCost).toBe("zero");
    expect(c.writeCost).toBe("landauer");
    expect(c.reversible).toBe(false);
    expect(c.batchable).toBe(true);
  });
});
