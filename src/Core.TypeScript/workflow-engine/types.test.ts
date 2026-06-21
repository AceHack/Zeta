/**
 * src/Core.TypeScript/workflow-engine/types.test.ts
 *
 * 081KSKBP80008QG0R000B3Y19A.5 PoC — invariant tests for declarative type substrate.
 *
 * Run via: bun test src/Core.TypeScript/workflow-engine/
 */

import { describe, expect, it } from "bun:test";
import {
  SEED_ACTION_CATALOG,
  SEED_STATES,
  determineReviewLevel,
  validateCatalog,
  validateStateOtto5Mods,
  type Action,
  type ReviewLevel,
  type State,
} from "./types";

describe("081KSKBP80008QG0R000B3Y19A.5 workflow-engine scaffold invariants", () => {
  it("seed catalog has unique action ids", () => {
    const ids = new Set(SEED_ACTION_CATALOG.map((a) => a.id));
    expect(ids.size).toBe(SEED_ACTION_CATALOG.length);
  });

  it("seed catalog satisfies Mod 2 (grammar-extension action present)", () => {
    const hasGrammarExtension = SEED_ACTION_CATALOG.some((a) => a.class === "grammar-extension");
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
    const noGrammarExt = SEED_ACTION_CATALOG.filter((a) => a.class !== "grammar-extension");
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
    expect(() => validateCatalog(SEED_ACTION_CATALOG, [...SEED_STATES, brokenState])).toThrow(/unknown action/);
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
    expect(() => validateStateOtto5Mods(noEscapeState, SEED_ACTION_CATALOG)).toThrow(/Mod 1/);
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

describe("081KSNY2Z0008QG0R003WFDCJ9 determineReviewLevel lifecycle DU discriminator", () => {
  // Per Kestrel substantive substrate-engineering substrate (13th ferry §33.5)
  // + Aaron's substrate-check on 3-lane completion (Amara ferry §33.2 PR #5757):
  // discriminator must preserve the state-machine-events-direct-push vs
  // system-modifications-full-PR-review distinction the framework's
  // auto-review pipeline depends on for training-data substrate.

  it("escape-hatch action ALWAYS gets pr-review-light regardless of gate (Mod 1 substrate-engineering surface)", () => {
    const escapeAppendOnly: Action = {
      id: "test-escape-1",
      class: "escape-hatch",
      gate: "append-only",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    const escapePrGated: Action = {
      id: "test-escape-2",
      class: "escape-hatch",
      gate: "pr-gated",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    expect(determineReviewLevel(escapeAppendOnly)).toBe("pr-review-light");
    expect(determineReviewLevel(escapePrGated)).toBe("pr-review-light");
  });

  it("grammar-extension action ALWAYS gets pr-review-full (Mod 2 framework-substrate-evolution)", () => {
    const grammarExt: Action = {
      id: "test-grammar",
      class: "grammar-extension",
      gate: "pr-gated",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    expect(determineReviewLevel(grammarExt)).toBe("pr-review-full");
  });

  it("operator-decision action ALWAYS gets operator-required (Mod 3 ban-if-SHIPPED-only)", () => {
    const opDecision: Action = {
      id: "test-op",
      class: "operator-decision",
      gate: "append-only",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    expect(determineReviewLevel(opDecision)).toBe("operator-required");
  });

  it("transition + append-only → trajectory-push (state-machine-event direct push; cheap; heartbeat-pattern)", () => {
    const seedAdvance = SEED_ACTION_CATALOG.find((a) => a.id === "advance");
    if (!seedAdvance) throw new Error("seed catalog missing 'advance'");
    expect(determineReviewLevel(seedAdvance)).toBe("trajectory-push");
  });

  it("transition + pr-gated → pr-review-full (cross-cutting substrate modification)", () => {
    const transitionPrGated: Action = {
      id: "test-trans-pr",
      class: "transition",
      gate: "pr-gated",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    expect(determineReviewLevel(transitionPrGated)).toBe("pr-review-full");
  });

  it("menu-contribution + append-only → trajectory-push (Mod 5 safe at append-only scope)", () => {
    const seedMenu = SEED_ACTION_CATALOG.find((a) => a.id === "menu-contribute");
    if (!seedMenu) throw new Error("seed catalog missing 'menu-contribute'");
    expect(determineReviewLevel(seedMenu)).toBe("trajectory-push");
  });

  it("agent-decision + append-only → trajectory-push", () => {
    const agentAppend: Action = {
      id: "test-agent-1",
      class: "agent-decision",
      gate: "append-only",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    expect(determineReviewLevel(agentAppend)).toBe("trajectory-push");
  });

  it("agent-decision + pr-gated → pr-review-light", () => {
    const agentPrGated: Action = {
      id: "test-agent-2",
      class: "agent-decision",
      gate: "pr-gated",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    expect(determineReviewLevel(agentPrGated)).toBe("pr-review-light");
  });

  it("all SEED_ACTION_CATALOG actions resolve to a valid ReviewLevel (exhaustiveness)", () => {
    // Acknowledger forces exhaustive match — TS strict mode raises
    // "not all code paths return" at compile time if a NEW ReviewLevel
    // variant is added without updating this switch.
    const acknowledge = (r: ReviewLevel): string => {
      switch (r) {
        case "trajectory-push":
        case "pr-review-light":
        case "pr-review-full":
        case "operator-required":
          return r;
      }
    };
    for (const a of SEED_ACTION_CATALOG) {
      const level = determineReviewLevel(a);
      expect(acknowledge(level)).toBe(level);
    }
  });

  it("framework auto-review pipeline distinction preserved (substrate-honest: not 'no PRs ever')", () => {
    // Per Kestrel 13th ferry §33.5 substrate-check on Ani-retelling drift:
    // 'no PRs ever, infinite swarm to main' framing collapses the
    // multi-tier review distinction. determineReviewLevel preserves it
    // by never returning trajectory-push for grammar-extension, pr-gated
    // transitions, or operator-decisions. Test verifies this is structural
    // rather than just contingent on seed data.
    const grammarExt: Action = {
      id: "test-pres-1",
      class: "grammar-extension",
      gate: "append-only", // even if author tries to declare append-only,
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    // Grammar-extension ALWAYS overrides gate to full review:
    expect(determineReviewLevel(grammarExt)).toBe("pr-review-full");
    // Operator-decision ALWAYS requires operator regardless of gate:
    const opDecision: Action = {
      id: "test-pres-2",
      class: "operator-decision",
      gate: "pr-gated",
      label: "test",
      description: "test",
      composesWith: [],
      feedbackVariants: ["X"],
    };
    expect(determineReviewLevel(opDecision)).toBe("operator-required");
  });
});
