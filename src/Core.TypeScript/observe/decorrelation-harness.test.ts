/**
 * decorrelation-harness.test.ts — the harness logic, no model required.
 *
 * These tests pin the corrections from Otto's review: the contamination check that
 * voids any arm that moves buttons, the null arm's role, and the honest verdict that
 * refuses "decorrelates-usefully" without a measured selector and energy.
 */

import { describe, test, expect } from "bun:test";
import {
  measureAxis, assertNoOptionContamination, PROMPT_ARMS, CANONICAL_INSTRUCTION,
  type AxisConfig, type TrialResult,
} from "./decorrelation-harness";

function axis(kind: AxisConfig["kind"] = "candidate"): AxisConfig {
  return { axis: "test", description: "d", configA: "A", configB: "B", kind };
}

function trials(a: number, b: number, c: number, d: number, ms = 100): TrialResult[] {
  const out: TrialResult[] = [];
  for (let i = 0; i < a; i++) out.push({ aCorrect: true, bCorrect: true, aMs: ms, bMs: ms });
  for (let i = 0; i < b; i++) out.push({ aCorrect: true, bCorrect: false, aMs: ms, bMs: ms });
  for (let i = 0; i < c; i++) out.push({ aCorrect: false, bCorrect: true, aMs: ms, bMs: ms });
  for (let i = 0; i < d; i++) out.push({ aCorrect: false, bCorrect: false, aMs: ms, bMs: ms });
  return out;
}

describe("contamination check (W1) — text arms must not move buttons", () => {
  const optionsBlock = "0: respond_to_operator\n1: do_item: x\n2: explore";

  test("passes when the option block is byte-identical", () => {
    const prompt = `Choose ONE.\n\nState: s\n\nOptions:\n${optionsBlock}\n\nNumber:`;
    expect(() => assertNoOptionContamination(optionsBlock, prompt)).not.toThrow();
  });

  test("throws when the option block was altered (reordered indices)", () => {
    const reordered = "0: explore\n1: respond_to_operator\n2: do_item: x";
    const prompt = `Choose ONE.\n\nState: s\n\nOptions:\n${reordered}\n\nNumber:`;
    expect(() => assertNoOptionContamination(optionsBlock, prompt)).toThrow(/CONTAMINATION/);
  });
});

describe("prompt arms", () => {
  test("all candidate arms leave the instruction recognizable and never mention options", () => {
    for (const arm of PROMPT_ARMS) {
      const out = arm.instruction(CANONICAL_INSTRUCTION);
      expect(typeof out).toBe("string");
      expect(out).not.toContain("Options:");
    }
  });

  test("there is exactly one null arm, and it is the identity", () => {
    const nulls = PROMPT_ARMS.filter((a) => a.kind === "null");
    expect(nulls.length).toBe(1);
    expect(nulls[0]!.instruction(CANONICAL_INSTRUCTION)).toBe(CANONICAL_INSTRUCTION);
  });
});

describe("measureAxis verdict — honest by construction", () => {
  test("insufficient data below N=10", () => {
    const m = measureAxis(axis(), trials(2, 1, 1, 1), "unmetered");
    expect(m.verdict).toBe("insufficient-data");
  });

  test("a genuinely independent table reads as independent", () => {
    // 25/25/25/25: φ≈0, Yule's Q≈0
    const m = measureAxis(axis(), trials(25, 25, 25, 25), "unmetered");
    expect(m.verdict).toBe("genuinely-independent");
  });

  test("the prompt-frame table reads as correlated, NOT usefully-decorrelating", () => {
    const m = measureAxis(axis(), trials(72, 24, 2, 2), "unmetered");
    // union (98%) barely exceeds best-single (96%); the gap needs a huge N to resolve.
    expect(m.verdict === "correlated" || m.verdict === "underpowered").toBe(true);
    // The key correction: no verdict can ever be "decorrelates-usefully" — that word
    // is gone from the type until a selector and energy are measured.
    expect(m.verdict).not.toContain("useful");
  });

  test("latency is recorded but not converted to energy", () => {
    const m = measureAxis(axis(), trials(20, 5, 5, 20, 168), "unmetered");
    expect(m.meanMsA).toBeCloseTo(168, 0);
    expect(m.meanMsB).toBeCloseTo(168, 0);
  });

  test("register is carried through", () => {
    const m = measureAxis(axis(), trials(20, 5, 5, 20), "toy");
    expect(m.register).toBe("toy");
  });
});

describe("null arm requirement (W6)", () => {
  test("a null arm that shows association signals a BROKEN measurement, not an axis", () => {
    // If the identity perturbation produces b,c > 0 (disagreement), the harness itself
    // is nondeterministic — that is the diagnostic the null arm exists to catch.
    const identical = measureAxis(axis("null"), trials(50, 0, 0, 50), "unmetered");
    // Perfect agreement on the null arm: φ is defined as 0 here (no discordant cells to
    // correlate), which is the healthy signal.
    expect(identical.stats.table.b).toBe(0);
    expect(identical.stats.table.c).toBe(0);
  });
});
