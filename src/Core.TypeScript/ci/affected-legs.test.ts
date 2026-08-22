// affected-legs.test.ts — the selector may only ever ADD work, never remove it.
//
// Each test below is a property of that guarantee. A selector that can silently
// drop a job is worse than no selector, so the negative cases matter more than the
// happy path.

import { describe, expect, test } from "bun:test";
import { allLegsOf, legSlug, renderOutputs } from "./affected-legs.ts";
import { readFileSync } from "node:fs";

const ALL = ["gate/lint", "gate/lint-rust", "lean-proof/type-check"];

describe("legSlug", () => {
  test("is a valid GitHub Actions output name", () => {
    expect(legSlug("gate/lint-no-conflict-markers")).toBe("gate_lint_no_conflict_markers");
    expect(legSlug("lean-proof/type-check")).toBe("lean_proof_type_check");
  });

  test("distinct legs get distinct slugs -- a collision would alias two jobs", () => {
    const graph = readFileSync("src/Core.TypeScript/ace/build-graph.json", "utf-8");
    const legs = allLegsOf(graph);
    expect(new Set(legs.map(legSlug)).size).toBe(legs.length);
  });
});

describe("renderOutputs", () => {
  test("EVERY leg is emitted explicitly, affected or not", () => {
    // An absent output is indistinguishable from false to an `if:` expression, so
    // absence is how a typo becomes a silent skip. Absence is not allowed.
    const lines = renderOutputs({ mode: "selective", legs: ["gate/lint"] }, ALL);
    expect(lines).toHaveLength(ALL.length + 1);
    for (const leg of ALL) expect(lines.some((l) => l.startsWith(`leg_${legSlug(leg)}=`))).toBe(true);
  });

  test("selective mode sets exactly the affected legs true", () => {
    const lines = renderOutputs({ mode: "selective", legs: ["gate/lint-rust"] }, ALL);
    expect(lines).toContain("leg_gate_lint_rust=true");
    expect(lines).toContain("leg_gate_lint=false");
  });

  test("FULL mode sets every leg true regardless of the affected list", () => {
    // The fail-safe direction: "we do not know" resolves to "run everything".
    const lines = renderOutputs({ mode: "full", legs: [] }, ALL);
    for (const leg of ALL) expect(lines).toContain(`leg_${legSlug(leg)}=true`);
  });

  test("mode is always emitted first so a consumer can branch on it alone", () => {
    expect(renderOutputs({ mode: "full", legs: [] }, ALL)[0]).toBe("mode=full");
  });

  test("an affected leg outside the roster does not suppress the roster", () => {
    // Defensive: a graph/roster mismatch must not shrink the emitted set.
    const lines = renderOutputs({ mode: "selective", legs: ["gate/unknown"] }, ALL);
    expect(lines).toHaveLength(ALL.length + 1);
  });
});

describe("allLegsOf", () => {
  test("collects the union of every target's legs, deduped and sorted", () => {
    expect(
      allLegsOf(JSON.stringify({ targets: [{ legs: ["b", "a"] }, { legs: ["a"] }, {}] })),
    ).toEqual(["a", "b"]);
  });

  test("the real graph exposes a non-trivial leg roster", () => {
    expect(allLegsOf(readFileSync("src/Core.TypeScript/ace/build-graph.json", "utf-8")).length)
      .toBeGreaterThan(10);
  });
});
