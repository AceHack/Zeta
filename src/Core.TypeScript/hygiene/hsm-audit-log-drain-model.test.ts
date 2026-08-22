#!/usr/bin/env bun
// Tests for the audit-log drainer pure logic.
//
// Every CLEAN assertion is paired with a planted MUTANT. Nothing here touches a device.

import { describe, expect, test } from "bun:test";
import {
  LOG_STORE_ENTRIES,
  auditDrainSequence,
  checkUnloggedCounters,
  detectEvictionGaps,
  drainBudget,
  isBootMarker,
  verifyOverlapConsistency,
  verifyTickMonotonic,
  type DrainWindow,
  type LogEntry,
} from "./hsm-audit-log-drain-model.ts";

function entry(item: number, tick: number, over: Partial<LogEntry> = {}): LogEntry {
  return {
    item,
    cmd: 0x56,
    length: 34,
    sessionKey: 0x0004,
    targetKey: 0x0100,
    secondKey: 0xffff,
    result: 0xd6,
    tick,
    hash: "00000000000000000000000000000000".slice(0, 30) + item.toString(16).padStart(2, "0"),
    ...over,
  };
}

function window(entries: readonly LogEntry[], over: Partial<DrainWindow> = {}): DrainWindow {
  return { entries, unloggedBoots: 0, unloggedAuths: 0, ...over };
}

describe("drain-interval arithmetic - the numbers in the design doc, executed", () => {
  const base = {
    loggedEntriesPerOperation: 3,
    entriesPerDrain: 3,
    toleratedConsecutiveFailures: 1,
    minDrainIntervalSeconds: 0.05,
  };

  test("the ring is 62 entries, as Yubico documents", () => {
    expect(LOG_STORE_ENTRIES).toBe(62);
  });

  // 62 / 2 = 31 per cycle, minus 3 for the drain = 28 budget; at 3 entries/s that is 9.33s.
  test("one payment per second, session opened per drain: about 9.3 seconds", () => {
    const b = drainBudget({ ...base, operationsPerSecond: 1 });
    expect(b.feasible).toBe(true);
    expect(b.budgetPerCycle).toBe(28);
    expect(b.intervalSeconds).toBeCloseTo(9.333, 2);
  });

  // A persistent session drops the drain cost to the retrieval command alone.
  test("a persistent drain session buys a longer interval, not a small speedup", () => {
    const perDrain = drainBudget({ ...base, operationsPerSecond: 1 });
    const persistent = drainBudget({ ...base, entriesPerDrain: 1, operationsPerSecond: 1 });
    expect(persistent.intervalSeconds).toBeGreaterThan(perDrain.intervalSeconds);
    expect(persistent.budgetPerCycle).toBe(30);
  });

  test("one payment per minute: minutes, not seconds", () => {
    const b = drainBudget({ ...base, operationsPerSecond: 1 / 60 });
    expect(b.feasible).toBe(true);
    expect(b.intervalSeconds).toBeCloseTo(560, 0);
  });

  // MUTANT for conclusion 1 in the module header: the drainer consumes what it protects.
  test("MUTANT: when the drain overhead alone fills the cycle, NO interval works", () => {
    const b = drainBudget({ ...base, entriesPerDrain: 31, operationsPerSecond: 1 });
    expect(b.feasible).toBe(false);
    expect(b.reason).toContain("fill the ring it exists to empty");
  });

  // MUTANT for conclusion 2: a rate ceiling exists, and it is not a tuning problem.
  test("MUTANT: above a rate ceiling no schedule is lossless", () => {
    const b = drainBudget({ ...base, operationsPerSecond: 1000 });
    expect(b.feasible).toBe(false);
    expect(b.reason).toContain("cannot be drained losslessly by ANY schedule");
  });

  test("MUTANT: tolerating more consecutive failures shortens the interval", () => {
    const one = drainBudget({ ...base, operationsPerSecond: 1 });
    const three = drainBudget({ ...base, toleratedConsecutiveFailures: 3, operationsPerSecond: 1 });
    expect(three.intervalSeconds).toBeLessThan(one.intervalSeconds);
  });

  test("no logged work means no deadline, and says so rather than dividing by zero", () => {
    const b = drainBudget({ ...base, operationsPerSecond: 0 });
    expect(b.feasible).toBe(true);
    expect(b.intervalSeconds).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("eviction detection - the check the hash chain cannot perform", () => {
  test("contiguous drains produce no gap finding", () => {
    const w = [window([entry(10, 100), entry(11, 110)]), window([entry(12, 120), entry(13, 130)])];
    expect(detectEvictionGaps(w).filter((f) => f.kind === "eviction-gap")).toEqual([]);
  });

  test("MUTANT: a jump in the item counter is reported, with the count of lost entries", () => {
    const w = [window([entry(10, 100)]), window([entry(40, 400)])];
    const gaps = detectEvictionGaps(w).filter((f) => f.kind === "eviction-gap");
    expect(gaps.length).toBe(1);
    expect(gaps[0]?.detail).toContain("29 entry(ies) were overwritten");
    // The whole point: chain validity is NOT completeness, and the finding says so.
    expect(gaps[0]?.detail).toContain("must not be reported as completeness");
  });

  // The limit is registered on the finding, not hidden in prose.
  test("MUTANT: an eviction finding is registered `limited`, never `checked`", () => {
    const w = [window([entry(10, 100)]), window([entry(40, 400)])];
    expect(detectEvictionGaps(w)[0]?.register).toBe("limited");
  });

  test("an empty window is a finding, not a silent pass", () => {
    expect(detectEvictionGaps([window([])])[0]?.kind).toBe("empty-window");
  });
});

describe("overlap consistency - tamper evidence without the hash function", () => {
  const a = entry(10, 100);
  const b = entry(11, 110);

  test("overlapping windows that agree produce nothing", () => {
    expect(verifyOverlapConsistency([window([a, b]), window([b, entry(12, 120)])])).toEqual([]);
  });

  test("MUTANT: the same item re-read with a different hash is a tamper alarm", () => {
    const rewritten = { ...b, hash: "deadbeefdeadbeefdeadbeefdeadbeef" };
    const f = verifyOverlapConsistency([window([a, b]), window([rewritten, entry(12, 120)])]);
    expect(f.length).toBe(1);
    expect(f[0]?.kind).toBe("overlap-mismatch");
    expect(f[0]?.detail).toContain("tamper alarm, not a retry");
  });

  test("MUTANT: the same item re-read with a different TARGET KEY is caught too", () => {
    const rewritten = { ...b, targetKey: 0x0999 };
    const f = verifyOverlapConsistency([window([a, b]), window([rewritten])]);
    expect(f[0]?.kind).toBe("overlap-mismatch");
  });

  test("MUTANT: drain-and-forget produces no overlap, and that is itself reported", () => {
    const f = verifyOverlapConsistency([window([a]), window([entry(20, 200)])]);
    expect(f.some((x) => x.kind === "no-overlap")).toBe(true);
  });
});

describe("tick order and unlogged events", () => {
  test("a rising tick sequence is clean", () => {
    expect(verifyTickMonotonic([entry(1, 100), entry(2, 200), entry(3, 300)])).toEqual([]);
  });

  test("MUTANT: a tick regression with no boot marker is reported", () => {
    const f = verifyTickMonotonic([entry(1, 300), entry(2, 100)]);
    expect(f.length).toBe(1);
    expect(f[0]?.kind).toBe("tick-regression");
  });

  // The device restarts the tick at power-on, so this MUST be tolerated - a check that fired
  // on every reboot would be turned off within a week and take the real alarm with it.
  test("MUTANT: a tick reset ACROSS a boot marker is legitimate and must not fire", () => {
    const boot = entry(2, 0, { cmd: 0x00, sessionKey: 0xffff, length: 0 });
    expect(isBootMarker(boot)).toBe(true);
    expect(verifyTickMonotonic([entry(1, 300), boot, entry(3, 139)])).toEqual([]);
  });

  test("zeroed unlogged counters produce nothing", () => {
    expect(checkUnloggedCounters([window([entry(1, 1)])])).toEqual([]);
  });

  test("MUTANT: unlogged boots or authentications are surfaced, never summed away", () => {
    const f = checkUnloggedCounters([window([entry(1, 1)], { unloggedBoots: 2, unloggedAuths: 7 })]);
    expect(f.length).toBe(1);
    expect(f[0]?.detail).toContain("NO chain entry");
  });

  test("auditDrainSequence composes all four checks over a hostile sequence", () => {
    const w = [window([entry(10, 100), entry(11, 110)]), window([entry(40, 90)], { unloggedAuths: 3 })];
    const kinds = auditDrainSequence(w).map((f) => f.kind);
    expect(kinds).toContain("eviction-gap");
    expect(kinds).toContain("no-overlap");
    expect(kinds).toContain("tick-regression");
    expect(kinds).toContain("unlogged-events");
  });

  test("a clean sequence produces nothing at all (the check can pass)", () => {
    const w = [window([entry(10, 100), entry(11, 110)]), window([entry(11, 110), entry(12, 120)])];
    expect(auditDrainSequence(w)).toEqual([]);
  });

  // The host clock is carried and DECIDES NOTHING. If it ever starts deciding, this fails.
  test("MUTANT: the untrusted host clock changes no finding", () => {
    const bare = [window([entry(1, 10)]), window([entry(1, 10), entry(2, 20)])];
    const stamped = [
      window([entry(1, 10)], { hostObservedAtUntrusted: "2026-08-20T23:00:00Z" }),
      window([entry(1, 10), entry(2, 20)], { hostObservedAtUntrusted: "1999-01-01T00:00:00Z" }),
    ];
    expect(auditDrainSequence(stamped)).toEqual(auditDrainSequence(bare));
  });
});
