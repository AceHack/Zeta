/**
 * tools/zflash/test-harness/scenarios.test.ts
 *
 * B-0891 PoC — invariant tests for scenario definitions.
 *
 * Run via: bun test tools/zflash/test-harness/
 */

import { describe, expect, it } from "bun:test";
import { SCENARIOS, validateScenarios, findScenario } from "./scenarios";

describe("B-0891 scenarios.ts invariants", () => {
  it("has exactly 5 scenarios per operator-named matrix", () => {
    expect(SCENARIOS.length).toBe(5);
  });

  it("validates without throwing", () => {
    expect(() => validateScenarios(SCENARIOS)).not.toThrow();
  });

  it("orderIndex values are 1..5", () => {
    const orders = SCENARIOS.map((s) => s.orderIndex).sort();
    expect(orders).toEqual([1, 2, 3, 4, 5]);
  });

  it("ids are unique", () => {
    const ids = new Set(SCENARIOS.map((s) => s.id));
    expect(ids.size).toBe(SCENARIOS.length);
  });

  it("findScenario returns correct entry", () => {
    expect(findScenario("initial-format")?.orderIndex).toBe(1);
    expect(findScenario("boot-cluster-up")?.orderIndex).toBe(2);
    expect(findScenario("reformat-with-retention")?.orderIndex).toBe(3);
    expect(findScenario("reformat-from-scratch")?.orderIndex).toBe(4);
    expect(findScenario("cluster-joining")?.orderIndex).toBe(5);
  });

  it("findScenario returns undefined for unknown id", () => {
    expect(findScenario("nonexistent" as never)).toBeUndefined();
  });

  it("gates only reference defined ids", () => {
    const ids = new Set(SCENARIOS.map((s) => s.id));
    for (const s of SCENARIOS) {
      for (const gate of s.gates) {
        expect(ids.has(gate)).toBe(true);
      }
    }
  });

  it("composes-with-existing scenarios cite tools/ci/ paths", () => {
    const composers = SCENARIOS.filter((s) => s.status === "composes-with-existing");
    expect(composers.length).toBeGreaterThan(0);
    for (const s of composers) {
      const hasToolsCi = s.composesWith.some((dep) => dep.startsWith("tools/ci/"));
      expect(hasToolsCi).toBe(true);
    }
  });

  it("all scenarios have non-empty acceptanceCriteria", () => {
    for (const s of SCENARIOS) {
      expect(s.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });

  it("validateScenarios catches duplicate id", () => {
    const first = SCENARIOS[0];
    if (!first) throw new Error("SCENARIOS unexpectedly empty");
    const dup = [...SCENARIOS, { ...first }];
    expect(() => validateScenarios(dup)).toThrow();
  });

  it("validateScenarios catches wrong count", () => {
    const short = SCENARIOS.slice(0, 4);
    expect(() => validateScenarios(short)).toThrow();
  });

  it("validateScenarios catches unknown gate reference", () => {
    const broken = SCENARIOS.map((s, i) =>
      i === 0 ? { ...s, gates: ["nonexistent" as never] } : s,
    );
    expect(() => validateScenarios(broken)).toThrow();
  });
});
