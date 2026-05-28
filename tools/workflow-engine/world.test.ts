/**
 * tools/workflow-engine/world.test.ts
 *
 * Invariant tests for world substrate + reusable lifetime composition helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  EMPTY_WORLD,
  defaultAdvanceMatrix,
  dispatchInWorld,
  lookupLifetimePair,
  predicateMatrix,
  registerLifetimePair,
  terminalMatrix,
  type ComposedKey,
  type LifetimeState,
  type StandardVerdict,
} from "./world";

interface WorkflowLifetime extends LifetimeState {
  readonly kind: "draft" | "submitted" | "approved";
}

interface ReviewLifetime extends LifetimeState {
  readonly kind: "pending" | "in-review" | "merged";
}

const workflowUniverse: WorkflowLifetime[] = [
  { kind: "draft" },
  { kind: "submitted" },
  { kind: "approved" },
];

const reviewUniverse: ReviewLifetime[] = [
  { kind: "pending" },
  { kind: "in-review" },
  { kind: "merged" },
];

describe("world substrate + reusable lifetime composition helpers", () => {
  it("EMPTY_WORLD has zero registered pairs", () => {
    expect(EMPTY_WORLD.registry.size).toBe(0);
  });

  it("registerLifetimePair: returns new world with pair registered", () => {
    const matrix = new Map<ComposedKey<WorkflowLifetime, ReviewLifetime>, StandardVerdict>([
      ["draft:pending", { kind: "advance" }],
    ]);
    const world = registerLifetimePair(
      EMPTY_WORLD,
      "workflow-review",
      matrix,
    );
    expect(world.registry.size).toBe(1);
    expect(world.registry.has("workflow-review")).toBe(true);
    // Immutable: original unchanged
    expect(EMPTY_WORLD.registry.size).toBe(0);
  });

  it("lookupLifetimePair: returns matrix when registered", () => {
    const matrix = new Map<ComposedKey<WorkflowLifetime, ReviewLifetime>, StandardVerdict>([
      ["draft:pending", { kind: "advance" }],
    ]);
    const world = registerLifetimePair(
      EMPTY_WORLD,
      "workflow-review",
      matrix,
    );
    const found = lookupLifetimePair<WorkflowLifetime, ReviewLifetime, StandardVerdict>(
      world,
      "workflow-review",
    );
    expect(found).toBeDefined();
    expect(found?.get("draft:pending")?.kind).toBe("advance");
  });

  it("lookupLifetimePair: undefined for unregistered pair", () => {
    const found = lookupLifetimePair<WorkflowLifetime, ReviewLifetime, StandardVerdict>(
      EMPTY_WORLD,
      "nonexistent",
    );
    expect(found).toBeUndefined();
  });

  it("defaultAdvanceMatrix: every-cell defaults to advance", () => {
    const matrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse);
    expect(matrix.size).toBe(9);  // 3 × 3
    for (const verdict of matrix.values()) {
      expect(verdict.kind).toBe("advance");
    }
  });

  it("defaultAdvanceMatrix: overrides applied at specific cells", () => {
    const overrides = new Map<ComposedKey<WorkflowLifetime, ReviewLifetime>, StandardVerdict>([
      ["draft:in-review", { kind: "block", reason: "can't review draft" }],
      ["approved:merged", { kind: "complete" }],
    ]);
    const matrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse, overrides);
    expect(matrix.size).toBe(9);
    expect(matrix.get("draft:in-review")?.kind).toBe("block");
    expect(matrix.get("approved:merged")?.kind).toBe("complete");
    expect(matrix.get("draft:pending")?.kind).toBe("advance");  // not overridden
  });

  it("terminalMatrix: terminal cell is complete; other cells from terminal A are block", () => {
    const matrix = terminalMatrix(
      workflowUniverse,
      reviewUniverse,
      { kind: "approved" } as WorkflowLifetime,
      { kind: "merged" } as ReviewLifetime,
    );
    expect(matrix.get("approved:merged")?.kind).toBe("complete");
    expect(matrix.get("approved:pending")?.kind).toBe("block");
    expect(matrix.get("approved:in-review")?.kind).toBe("block");
    // Non-terminal A cells default to advance
    expect(matrix.get("draft:pending")?.kind).toBe("advance");
  });

  it("terminalMatrix: custom block reason", () => {
    const matrix = terminalMatrix(
      workflowUniverse,
      reviewUniverse,
      { kind: "approved" } as WorkflowLifetime,
      { kind: "merged" } as ReviewLifetime,
      "approval is terminal",
    );
    const blocked = matrix.get("approved:pending");
    if (blocked?.kind === "block") {
      expect(blocked.reason).toBe("approval is terminal");
    } else {
      throw new Error("expected block verdict");
    }
  });

  it("predicateMatrix: dispatches via caller-supplied predicate", () => {
    const matrix = predicateMatrix(workflowUniverse, reviewUniverse, (a, b): StandardVerdict => {
      if (a.kind === "draft" && b.kind !== "pending") {
        return { kind: "block", reason: "draft only valid with pending review" };
      }
      if (a.kind === "approved" && b.kind === "merged") {
        return { kind: "complete" };
      }
      return { kind: "advance" };
    });
    expect(matrix.size).toBe(9);
    expect(matrix.get("draft:in-review")?.kind).toBe("block");
    expect(matrix.get("approved:merged")?.kind).toBe("complete");
    expect(matrix.get("submitted:in-review")?.kind).toBe("advance");
  });

  it("dispatchInWorld: looks up registered pair + dispatches", () => {
    const matrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse);
    const world = registerLifetimePair(
      EMPTY_WORLD,
      "workflow-review",
      matrix,
    );
    const result = dispatchInWorld<WorkflowLifetime, ReviewLifetime, StandardVerdict>(
      world,
      "workflow-review",
      { kind: "draft" } as WorkflowLifetime,
      { kind: "pending" } as ReviewLifetime,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result as { ok: true; verdict: StandardVerdict; fromKey: string }).verdict.kind).toBe("advance");
  });

  it("dispatchInWorld: unregistered pair returns UnregisteredPair", () => {
    const result = dispatchInWorld<WorkflowLifetime, ReviewLifetime, StandardVerdict>(
      EMPTY_WORLD,
      "missing-pair",
      { kind: "draft" } as WorkflowLifetime,
      { kind: "pending" } as ReviewLifetime,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // UnregisteredPair has its own kind
    if ("feedback" in result && "kind" in result.feedback && result.feedback.kind === "UnregisteredPair") {
      expect(result.feedback.pairName).toBe("missing-pair");
    } else {
      throw new Error("expected UnregisteredPair feedback");
    }
  });

  it("StandardVerdict exhaustive switch (compile-time check)", () => {
    const acknowledge = (v: StandardVerdict): string => {
      switch (v.kind) {
        case "advance":
        case "block":
        case "complete":
        case "no-op":
        case "escalate-to-operator":
          return v.kind;
      }
    };
    expect(acknowledge({ kind: "advance" })).toBe("advance");
    expect(acknowledge({ kind: "block", reason: "x" })).toBe("block");
    expect(acknowledge({ kind: "complete" })).toBe("complete");
    expect(acknowledge({ kind: "no-op" })).toBe("no-op");
    expect(acknowledge({ kind: "escalate-to-operator", reason: "x" })).toBe("escalate-to-operator");
  });

  it("substrate-engineering reusability test: workflow-review world built with helpers (no per-cell custom code)", () => {
    // Showcase: full 9-transition matrix built with predicateMatrix helper
    // (no per-cell custom code; recurring pattern factored into predicate)
    const matrix = predicateMatrix(workflowUniverse, reviewUniverse, (a, b): StandardVerdict => {
      if (a.kind === "approved" && b.kind === "merged") return { kind: "complete" };
      if (a.kind === "draft" && b.kind !== "pending") return { kind: "block", reason: "draft+non-pending" };
      if (a.kind === "submitted" && b.kind === "merged") return { kind: "block", reason: "not approved" };
      return { kind: "advance" };
    });
    const world = registerLifetimePair(
      EMPTY_WORLD,
      "workflow-review",
      matrix,
    );

    // Test multiple dispatch lookups
    const advanceResult = dispatchInWorld<WorkflowLifetime, ReviewLifetime, StandardVerdict>(
      world, "workflow-review",
      { kind: "submitted" } as WorkflowLifetime, { kind: "in-review" } as ReviewLifetime,
    );
    expect(advanceResult.ok).toBe(true);

    const completeResult = dispatchInWorld<WorkflowLifetime, ReviewLifetime, StandardVerdict>(
      world, "workflow-review",
      { kind: "approved" } as WorkflowLifetime, { kind: "merged" } as ReviewLifetime,
    );
    expect(completeResult.ok).toBe(true);
  });

  it("multiple lifetime pairs registered in single world (workflow-review + workflow-encryption)", () => {
    interface EncryptionLifetime extends LifetimeState {
      readonly kind: "plain" | "encrypted" | "sealed";
    }
    const encryptionUniverse: EncryptionLifetime[] = [
      { kind: "plain" }, { kind: "encrypted" }, { kind: "sealed" },
    ];

    const wrMatrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse);
    const weMatrix = defaultAdvanceMatrix(workflowUniverse, encryptionUniverse);

    let world = EMPTY_WORLD;
    world = registerLifetimePair(
      world, "workflow-review", wrMatrix,
    );
    world = registerLifetimePair(
      world, "workflow-encryption", weMatrix,
    );

    expect(world.registry.size).toBe(2);
    expect(world.registry.has("workflow-review")).toBe(true);
    expect(world.registry.has("workflow-encryption")).toBe(true);
  });
});
