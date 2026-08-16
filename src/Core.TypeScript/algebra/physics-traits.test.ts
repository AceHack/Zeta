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

  // ── The two corrected legs (2026-08-14) ──────────────────────────────────────
  // `dequeue` charged 1 bit and `flush` charged `batchSize`. Both return the items they remove,
  // so `(post-state, returned value)` determines the pre-state: they are bijections, and Bennett
  // 1973 gives a bijection no floor. The sweep in erasure-derivation.test.ts measures both at
  // maxFibre 1 over a 7-state domain. A meter there could only ever read zero, so the number it
  // was reporting came from the constant, not from the operation.

  test("dequeue pays NOTHING — it returns the item, so it erases nothing (Bennett)", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);

    q.enqueue("a"); // branch: state=1
    q.enqueue("b"); // branch: state=2

    const item = q.dequeue();
    expect(item).toBe("a");
    expect(tracker.state.entropy_heat).toBe(0);      // reversible: no heat, at any batch size
    expect(tracker.state.hard_measurements).toBe(0); // and it is not a measurement of size zero
    expect(q.pending).toBe(1);
  });

  test("flush pays NOTHING — the batch is handed back, so the ferry commit erases nothing", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<number>(tracker);

    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    q.enqueue(4);

    const batch = q.flush();
    expect(batch).toEqual([1, 2, 3, 4]);
    expect(batch.length).toBe(4);
    // The old assertion here was `entropy_heat === 4` — the batch size, echoed back by the
    // constant that produced it. Nothing about the flush could have made it any other number.
    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.bits_erased).toBe(0);
    expect(q.pending).toBe(0);
  });

  test("Ledger A retains the admitted bits after a drain — the residual this exposes", () => {
    // Honest consequence, stated rather than hidden behind a fake heat charge: the tracker has an
    // admission door (`branch`) and an erasure door (`measure`), but no reversible-egress door.
    // A queue that hands its items back has moved information OUT of its state without destroying
    // it, and there is nowhere to record that. So `entropy_state` over-reports what the queue
    // holds. The previous code hid this by charging heat for a bijection, which balanced the
    // ledger at the cost of the ledger being false.
    const tracker = createEntropyTracker();
    const q = createFerryQueue<number>(tracker);
    q.enqueue(1); q.enqueue(2); q.enqueue(3);
    q.flush();

    expect(q.pending).toBe(0);              // the queue holds nothing
    expect(tracker.state.entropy_state).toBe(3); // Ledger A still says three bits
    expect(tracker.state.entropy_heat).toBe(0);  // and no heat was invented to reconcile it
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

    // Total = state + heat = 3 + 0 = 3. The sum is unchanged by the correction — which is the
    // point of the entropy-tracker header's vacuity 2: `measure(k)` only ever MOVED k between the
    // ledgers, so this sum could not tell the old charge from the new one. Heat is the field that
    // distinguishes them, and it is checked above.
    expect(tracker.state.second_law_satisfied).toBe(true);
    expect(tracker.state.entropy_state + tracker.state.entropy_heat).toBe(3);
    expect(tracker.state.entropy_heat).toBe(0);
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

  test("ferry: free and reversible — batching is what distinguishes it, not a Landauer cost", () => {
    // Corrected 2026-08-14 with the implementation. Every operation createFerryQueue implements is
    // a bijection once the returned value counts as output, so the trait had no leg that could pay
    // a floor while declaring `landauer`. A ferry consumer that DROPS its batch is the erasing
    // operation; it lives at the consumer.
    const c = TRAIT_COSTS.ferry;
    expect(c.readCost).toBe("zero");
    expect(c.writeCost).toBe("zero");
    expect(c.reversible).toBe(true);
    expect(c.batchable).toBe(true);
  });
});
