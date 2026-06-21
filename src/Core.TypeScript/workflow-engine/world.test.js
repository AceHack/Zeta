/**
 * src/Core.TypeScript/workflow-engine/world.test.ts
 *
 * Invariant tests for world substrate + reusable lifetime composition helpers.
 */
import { describe, expect, it } from "bun:test";
import { EMPTY_WORLD, defaultAdvanceMatrix, dispatchInWorld, lookupLifetimePair, predicateMatrix, registerLifetimePair, terminalMatrix, } from "./world";
const workflowUniverse = [{ kind: "draft" }, { kind: "submitted" }, { kind: "approved" }];
const reviewUniverse = [{ kind: "pending" }, { kind: "in-review" }, { kind: "merged" }];
describe("world substrate + reusable lifetime composition helpers", () => {
    it("EMPTY_WORLD has zero registered pairs", () => {
        expect(EMPTY_WORLD.registry.size).toBe(0);
    });
    it("registerLifetimePair: returns new world with pair registered", () => {
        const matrix = new Map([
            ["draft:pending", { kind: "advance" }],
        ]);
        const world = registerLifetimePair(EMPTY_WORLD, "workflow-review", matrix);
        expect(world.registry.size).toBe(1);
        expect(world.registry.has("workflow-review")).toBe(true);
        // Immutable: original unchanged
        expect(EMPTY_WORLD.registry.size).toBe(0);
    });
    it("lookupLifetimePair: returns matrix when registered", () => {
        const matrix = new Map([
            ["draft:pending", { kind: "advance" }],
        ]);
        const world = registerLifetimePair(EMPTY_WORLD, "workflow-review", matrix);
        const found = lookupLifetimePair(world, "workflow-review");
        expect(found).toBeDefined();
        expect(found?.get("draft:pending")?.kind).toBe("advance");
    });
    it("lookupLifetimePair: undefined for unregistered pair", () => {
        const found = lookupLifetimePair(EMPTY_WORLD, "nonexistent");
        expect(found).toBeUndefined();
    });
    it("defaultAdvanceMatrix: every-cell defaults to advance", () => {
        const matrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse);
        expect(matrix.size).toBe(9); // 3 × 3
        for (const verdict of matrix.values()) {
            expect(verdict.kind).toBe("advance");
        }
    });
    it("defaultAdvanceMatrix: overrides applied at specific cells", () => {
        const overrides = new Map([
            ["draft:in-review", { kind: "block", reason: "can't review draft" }],
            ["approved:merged", { kind: "complete" }],
        ]);
        const matrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse, overrides);
        expect(matrix.size).toBe(9);
        expect(matrix.get("draft:in-review")?.kind).toBe("block");
        expect(matrix.get("approved:merged")?.kind).toBe("complete");
        expect(matrix.get("draft:pending")?.kind).toBe("advance"); // not overridden
    });
    it("terminalMatrix: terminal cell is complete; other cells from terminal A are block", () => {
        const matrix = terminalMatrix(workflowUniverse, reviewUniverse, { kind: "approved" }, { kind: "merged" });
        expect(matrix.get("approved:merged")?.kind).toBe("complete");
        expect(matrix.get("approved:pending")?.kind).toBe("block");
        expect(matrix.get("approved:in-review")?.kind).toBe("block");
        // Non-terminal A cells default to advance
        expect(matrix.get("draft:pending")?.kind).toBe("advance");
    });
    it("terminalMatrix: custom block reason", () => {
        const matrix = terminalMatrix(workflowUniverse, reviewUniverse, { kind: "approved" }, { kind: "merged" }, "approval is terminal");
        const blocked = matrix.get("approved:pending");
        if (blocked?.kind === "block") {
            expect(blocked.reason).toBe("approval is terminal");
        }
        else {
            throw new Error("expected block verdict");
        }
    });
    it("predicateMatrix: dispatches via caller-supplied predicate", () => {
        const matrix = predicateMatrix(workflowUniverse, reviewUniverse, (a, b) => {
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
        const world = registerLifetimePair(EMPTY_WORLD, "workflow-review", matrix);
        const result = dispatchInWorld(world, "workflow-review", { kind: "draft" }, { kind: "pending" });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict.kind).toBe("advance");
    });
    it("dispatchInWorld: unregistered pair returns UnregisteredPair", () => {
        const result = dispatchInWorld(EMPTY_WORLD, "missing-pair", { kind: "draft" }, { kind: "pending" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        // UnregisteredPair has its own kind
        if ("feedback" in result && "kind" in result.feedback && result.feedback.kind === "UnregisteredPair") {
            expect(result.feedback.pairName).toBe("missing-pair");
        }
        else {
            throw new Error("expected UnregisteredPair feedback");
        }
    });
    it("StandardVerdict exhaustive switch (compile-time check)", () => {
        const acknowledge = (v) => {
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
        const matrix = predicateMatrix(workflowUniverse, reviewUniverse, (a, b) => {
            if (a.kind === "approved" && b.kind === "merged")
                return { kind: "complete" };
            if (a.kind === "draft" && b.kind !== "pending")
                return { kind: "block", reason: "draft+non-pending" };
            if (a.kind === "submitted" && b.kind === "merged")
                return { kind: "block", reason: "not approved" };
            return { kind: "advance" };
        });
        const world = registerLifetimePair(EMPTY_WORLD, "workflow-review", matrix);
        // Test multiple dispatch lookups
        const advanceResult = dispatchInWorld(world, "workflow-review", { kind: "submitted" }, { kind: "in-review" });
        expect(advanceResult.ok).toBe(true);
        const completeResult = dispatchInWorld(world, "workflow-review", { kind: "approved" }, { kind: "merged" });
        expect(completeResult.ok).toBe(true);
    });
    it("multiple lifetime pairs registered in single world (workflow-review + workflow-encryption)", () => {
        const encryptionUniverse = [{ kind: "plain" }, { kind: "encrypted" }, { kind: "sealed" }];
        const wrMatrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse);
        const weMatrix = defaultAdvanceMatrix(workflowUniverse, encryptionUniverse);
        let world = EMPTY_WORLD;
        world = registerLifetimePair(world, "workflow-review", wrMatrix);
        world = registerLifetimePair(world, "workflow-encryption", weMatrix);
        expect(world.registry.size).toBe(2);
        expect(world.registry.has("workflow-review")).toBe(true);
        expect(world.registry.has("workflow-encryption")).toBe(true);
    });
    it("registerLifetimePair preserves subclass fields under structural typing", () => {
        const specialized = {
            ...EMPTY_WORLD,
            tag: "specialized",
            contextId: "ctx-1",
        };
        const matrix = defaultAdvanceMatrix(workflowUniverse, reviewUniverse);
        const after = registerLifetimePair(specialized, "pair", matrix);
        // Registry updated
        expect(after.registry.size).toBe(1);
        // Subclass fields survive (compile-time: TS allows .tag + .contextId
        // access because return type is SpecializedWorld, not bare World)
        expect(after.tag).toBe("specialized");
        expect(after.contextId).toBe("ctx-1");
    });
    it("dispatchInWorld returns WorldTransitionResult exhaustively switchable", () => {
        // Regression test for Thread 7: exported feedback union lets
        // callers switch exhaustively on the complete world-dispatch
        // failure modes (TransitionFeedback variants + UnregisteredPair).
        const result = dispatchInWorld(EMPTY_WORLD, "nonexistent-pair", { kind: "draft" }, { kind: "pending" });
        expect(result.ok).toBe(false);
        if (result.ok)
            throw new Error("expected ok=false");
        // Exhaustive switch over WorldTransitionFeedback variants
        const summarize = (fb) => {
            switch (fb.kind) {
                case "UnregisteredPair":
                    return `unregistered:${fb.pairName}`;
                case "UndefinedComposedTransition":
                    return `undefined-composed:${fb.composedKey}`;
                case "InvalidStateA":
                    return `invalid-a:${fb.reason}`;
                case "InvalidStateB":
                    return `invalid-b:${fb.reason}`;
            }
        };
        expect(summarize(result.feedback)).toBe("unregistered:nonexistent-pair");
    });
});
