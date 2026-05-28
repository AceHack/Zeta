/**
 * tools/workflow-engine/types.test.ts
 *
 * B-0867.5 PoC — invariant tests for declarative type substrate.
 *
 * Run via: bun test tools/workflow-engine/
 */

import { describe, expect, it } from "bun:test";
import {
  SEED_ACTION_CATALOG,
  SEED_STATES,
  validateCatalog,
  validateStateOtto5Mods,
  type State,
} from "./types";

describe("B-0867.5 workflow-engine scaffold invariants", () => {
  it("seed catalog has unique action ids", () => {
    const ids = new Set(SEED_ACTION_CATALOG.map((a) => a.id));
    expect(ids.size).toBe(SEED_ACTION_CATALOG.length);
  });

  it("seed catalog satisfies Mod 2 (grammar-extension action present)", () => {
    const hasGrammarExtension = SEED_ACTION_CATALOG.some(
      (a) => a.class === "grammar-extension",
    );
    expect(hasGrammarExtension).toBe(true);
  });

  it("every seed state satisfies Mod 1 (escape-hatch in availableActions)", () => {
    for (const s of SEED_STATES) {
      expect(() => validateStateOtto5Mods(s, SEED_ACTION_CATALOG)).not.toThrow();
    }
  });

  it("validateCatalog passes on seed data", () => {
    expect(() => validateCatalog(SEED_ACTION_CATALOG, SEED_STATES)).not.toThrow();
  });

  it("validateCatalog catches duplicate action id", () => {
    const first = SEED_ACTION_CATALOG[0];
    if (!first) throw new Error("SEED_ACTION_CATALOG unexpectedly empty");
    const dupCatalog = [...SEED_ACTION_CATALOG, { ...first }];
    expect(() => validateCatalog(dupCatalog, SEED_STATES)).toThrow(/duplicate action id/);
  });

  it("validateCatalog catches Mod 2 violation (missing grammar-extension)", () => {
    const noGrammarExt = SEED_ACTION_CATALOG.filter(
      (a) => a.class !== "grammar-extension",
    );
    expect(() => validateCatalog(noGrammarExt, SEED_STATES)).toThrow(/Mod 2/);
  });

  it("validateCatalog catches state referencing unknown action", () => {
    const brokenState: State = {
      id: "broken",
      label: "broken",
      description: "broken",
      tickCyclePattern: "discriminated-union-surface",
      availableActions: ["does-not-exist", "escape-hatch"],
      composesWith: [],
    };
    expect(() =>
      validateCatalog(SEED_ACTION_CATALOG, [...SEED_STATES, brokenState]),
    ).toThrow(/unknown action/);
  });

  it("validateStateOtto5Mods catches Mod 1 violation (no escape-hatch)", () => {
    const noEscapeState: State = {
      id: "no-escape",
      label: "no-escape",
      description: "no escape-hatch action",
      tickCyclePattern: "discriminated-union-surface",
      availableActions: ["advance"],
      composesWith: [],
    };
    expect(() =>
      validateStateOtto5Mods(noEscapeState, SEED_ACTION_CATALOG),
    ).toThrow(/Mod 1/);
  });

  it("all actions declare non-empty feedbackVariants (asymmetric-authorship)", () => {
    for (const a of SEED_ACTION_CATALOG) {
      expect(a.feedbackVariants.length).toBeGreaterThan(0);
    }
  });

  it("Mod 4 — every action declares its gate explicitly", () => {
    for (const a of SEED_ACTION_CATALOG) {
      expect(["append-only", "pr-gated"]).toContain(a.gate);
    }
  });

  it("every seed state uses a known tickCyclePattern variant", () => {
    // Type-level exhaustive switch — if a NEW variant is added to the union
    // without updating this switch, TS strict mode raises "not all code paths
    // return a value" at compile time (caught by lint(tsc tools) CI gate).
    const acknowledge = (p: State["tickCyclePattern"]): string => {
      switch (p) {
        case "observe-simulate-choose-emit":
        case "move-next-named-function":
        case "discriminated-union-surface":
        case "ople-primitives":
          return p;
      }
    };
    // Exercise real SEED_STATES values rather than a literal array.
    for (const s of SEED_STATES) {
      expect(acknowledge(s.tickCyclePattern)).toBe(s.tickCyclePattern);
    }
  });

  it("seed states use Mika's latest direction (discriminated-union-surface)", () => {
    for (const s of SEED_STATES) {
      expect(s.tickCyclePattern).toBe("discriminated-union-surface");
    }
  });
});
