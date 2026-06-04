import { test, expect } from "bun:test";
import { measureHarness, assessDrift } from "./context-cost";

// B-1016 drift-alert core — pure functions (no I/O). The CLI edge is exercised
// manually; the measurement + drift logic is what must be correct.

test("measureHarness sums per-file UTF-8 byte cost (harness × surface)", () => {
  const cost = measureHarness("test", [
    { path: "a", text: "abc" }, // 3
    { path: "b", text: "café" }, // 5 (é = 2 bytes)
    { path: "c", text: "🜂" }, // 4 (astral)
  ]);
  expect(cost.total.bytes).toBe(12);
  expect(cost.files).toEqual([
    { path: "a", bytes: 3 },
    { path: "b", bytes: 5 },
    { path: "c", bytes: 4 },
  ]);
});

test("measureHarness of empty manifest is Zero", () => {
  expect(measureHarness("empty", []).total.bytes).toBe(0);
});

test("assessDrift flags over-budget growth (the alert)", () => {
  const cost = measureHarness("h", [{ path: "f", text: "x".repeat(120) }]); // 120B
  const v = assessDrift(cost, 100, 110); // baseline 100, budget 110
  expect(v.current).toBe(120);
  expect(v.delta).toBe(20);
  expect(v.overBudget).toBe(true);
});

test("assessDrift passes within budget and reports shrink as negative delta", () => {
  const cost = measureHarness("h", [{ path: "f", text: "x".repeat(80) }]); // 80B
  const v = assessDrift(cost, 100, 110);
  expect(v.delta).toBe(-20);
  expect(v.overBudget).toBe(false);
});
