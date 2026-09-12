/**
 * ferry.test.ts — the organization does N things at once, or one, from the same code path.
 *
 * No wall clock anywhere: concurrency is measured by what is IN FLIGHT when a task is entered, which
 * the tasks themselves report. A test that measured elapsed time would be measuring this machine.
 */

import { describe, expect, test } from "bun:test";
import { ferry, oneAtATime, SEQUENTIAL } from "./ferry";

/** A task that parks until it is released, so the test decides the interleaving, not a timer. */
function parked<T>(): { promise: Promise<T>; release: (v: T) => void } {
  let release!: (v: T) => void;
  const promise = new Promise<T>((r) => (release = r));
  return { promise, release };
}

describe("HOW MANY THINGS AT ONCE IS A KNOB, AND ONE IS THE SAME CODE PATH", () => {
  test("at DoP=1 the work happens strictly in order, one at a time", async () => {
    const events: string[] = [];
    let inFlight = 0;
    let most = 0;
    const out = await ferry([1, 2, 3, 4], SEQUENTIAL, async (n) => {
      inFlight++;
      most = Math.max(most, inFlight);
      events.push(`start:${String(n)}`);
      await Promise.resolve();
      events.push(`end:${String(n)}`);
      inFlight--;
      return n * 10;
    });
    expect(most).toBe(1);
    expect(events).toEqual(["start:1", "end:1", "start:2", "end:2", "start:3", "end:3", "start:4", "end:4"]);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  test("at DoP=3 three are genuinely in flight at once, and the results still come back in input order", async () => {
    const gates = [parked<void>(), parked<void>(), parked<void>(), parked<void>()];
    let inFlight = 0;
    let most = 0;
    const started: number[] = [];
    const run = ferry([0, 1, 2, 3], 3, async (n) => {
      inFlight++;
      most = Math.max(most, inFlight);
      started.push(n);
      await (gates[n] as { promise: Promise<void> }).promise;
      inFlight--;
      return `done-${String(n)}`;
    });
    // Three entered before any finished - the ferries really are alongside each other.
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    expect(most).toBe(3);
    // The fourth waits for a ferry, and takes the first one that frees up.
    gates[1]?.release();
    await gates[1]?.promise;
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3]);
    for (const g of gates) g.release();
    expect(await run).toEqual(["done-0", "done-1", "done-2", "done-3"]);
    expect(most).toBe(3);
  });

  test("a width wider than the work, or a nonsense one, still does the work exactly once each", async () => {
    const seen: number[] = [];
    expect(await ferry([1, 2], 99, async (n) => { seen.push(n); return n; })).toEqual([1, 2]);
    // NOT AN ERROR: a throughput knob set to nonsense must never stop an organization working.
    for (const bad of [0, -3, 1.5, Number.NaN]) {
      expect(await ferry([1, 2], bad, async (n) => { seen.push(n); return n; })).toEqual([1, 2]);
    }
    expect(seen.length).toBe(2 * 5);
    expect(await ferry([], 4, async () => "never")).toEqual([]);
  });

  test("a task that throws is the caller's to handle - the ferry does not swallow it", async () => {
    await expect(ferry([1, 2], 2, async (n) => { if (n === 2) throw new Error("nope"); return n; })).rejects.toThrow("nope");
  });
});

describe("THE SUITES MAY NOT OVERLAP, HOWEVER WIDE THE FERRY IS", () => {
  test("only one thing is inside the gate at a time, and they go in the order they arrived", async () => {
    const gate = oneAtATime();
    const gates = [parked<void>(), parked<void>(), parked<void>()];
    let inside = 0;
    let most = 0;
    const order: number[] = [];
    const enter = (n: number) =>
      gate(async () => {
        inside++;
        most = Math.max(most, inside);
        order.push(n);
        await (gates[n] as { promise: Promise<void> }).promise;
        inside--;
        return n;
      });
    const all = [enter(0), enter(1), enter(2)];
    await Promise.resolve();
    expect(order).toEqual([0]);
    for (const g of gates) g.release();
    expect(await Promise.all(all)).toEqual([0, 1, 2]);
    expect(most).toBe(1);
    expect(order).toEqual([0, 1, 2]);
  });

  test("one that fails does not shut the gate on the next", async () => {
    const gate = oneAtATime();
    const failed = gate(async () => { throw new Error("the suite crashed"); });
    await expect(failed).rejects.toThrow("the suite crashed");
    expect(await gate(async () => "the next one still ran")).toBe("the next one still ran");
  });
});
