import { test, expect } from "bun:test";
import { analyzeTrend, byHarness, type TrendRecord } from "./context-cost-trend";

// 081KT7YW00008QG0R002T1XNWT DORA trend store — the pure trend-analysis core (I/O edge exercised by CLI).

const rec = (ts: string, harness: string, bytes: number): TrendRecord => ({ ts, harness, bytes, estTokens: Math.round(bytes / 3.8) });

test("analyzeTrend detects growth (drift up)", () => {
  const v = analyzeTrend([rec("2026-06-01T00:00:00Z", "h", 1000), rec("2026-06-04T00:00:00Z", "h", 1200)])!;
  expect(v.delta).toBe(200);
  expect(v.pctChange).toBeCloseTo(20, 6);
  expect(v.direction).toBe("growing");
  expect(v.n).toBe(2);
});

test("analyzeTrend detects shrink (minimization landing)", () => {
  const v = analyzeTrend([rec("2026-06-01T00:00:00Z", "h", 210000), rec("2026-06-04T00:00:00Z", "h", 1500)])!;
  expect(v.delta).toBeLessThan(0);
  expect(v.direction).toBe("shrinking");
});

test("analyzeTrend calls sub-1% change stable", () => {
  const v = analyzeTrend([rec("2026-06-01T00:00:00Z", "h", 10000), rec("2026-06-04T00:00:00Z", "h", 10050)])!;
  expect(v.direction).toBe("stable");
});

test("analyzeTrend is order-independent on input (sorts by ts)", () => {
  const a = analyzeTrend([rec("2026-06-04T00:00:00Z", "h", 1200), rec("2026-06-01T00:00:00Z", "h", 1000)])!;
  expect(a.firstBytes).toBe(1000);
  expect(a.latestBytes).toBe(1200);
});

test("analyzeTrend of empty is null; byHarness groups", () => {
  expect(analyzeTrend([])).toBeNull();
  const g = byHarness([rec("t1", "a", 1), rec("t2", "b", 2), rec("t3", "a", 3)]);
  expect(g.get("a")!.length).toBe(2);
  expect(g.get("b")!.length).toBe(1);
});
