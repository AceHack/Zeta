/**
 * src/Core.TypeScript/workflow-engine/composed-lifetime.test.ts
 *
 * Invariant tests for double-dispatch composed-lifetime substrate.
 */
import { describe, expect, it } from "bun:test";
import { buildComposedMatrix, composeFromDispatcher, composeKey, dispatchComposed, } from "./composed-lifetime";
describe("composed-lifetime double-dispatch substrate", () => {
    it("composeKey produces composed key from two lifetime states", () => {
        const a = { kind: "draft" };
        const b = { kind: "pending" };
        expect(composeKey(a, b)).toBe("draft:pending");
    });
    it("dispatchComposed: known transition returns verdict", () => {
        const matrix = buildComposedMatrix([
            ["draft:pending", { kind: "advance" }],
            ["submitted:in-review", { kind: "block", reason: "awaiting review" }],
            ["approved:merged", { kind: "complete" }],
        ]);
        const result = dispatchComposed({ matrix }, { kind: "draft" }, { kind: "pending" });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict.kind).toBe("advance");
        expect(result.fromKey).toBe("draft:pending");
    });
    it("dispatchComposed: unknown transition returns UndefinedComposedTransition", () => {
        const matrix = buildComposedMatrix([
            ["draft:pending", { kind: "advance" }],
        ]);
        const result = dispatchComposed({ matrix }, { kind: "submitted" }, { kind: "in-review" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("UndefinedComposedTransition");
        if (result.feedback.kind === "UndefinedComposedTransition") {
            expect(result.feedback.composedKey).toBe("submitted:in-review");
        }
    });
    it("dispatchComposed: defaultVerdict used when key missing from matrix", () => {
        const matrix = buildComposedMatrix([
            ["draft:pending", { kind: "advance" }],
        ]);
        const result = dispatchComposed({ matrix, defaultVerdict: { kind: "block", reason: "no transition defined" } }, { kind: "submitted" }, { kind: "in-review" });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict.kind).toBe("block");
    });
    it("dispatchComposed: invalid state A → InvalidStateA", () => {
        const matrix = buildComposedMatrix([]);
        const result = dispatchComposed({ matrix }, { kind: "" }, { kind: "pending" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InvalidStateA");
    });
    it("dispatchComposed: invalid state B → InvalidStateB", () => {
        const matrix = buildComposedMatrix([]);
        const result = dispatchComposed({ matrix }, { kind: "draft" }, { kind: "" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InvalidStateB");
    });
    it("composeFromDispatcher: builds dense matrix from sparse cross-product", () => {
        const workflowUniverse = [{ kind: "draft" }, { kind: "submitted" }, { kind: "approved" }];
        const reviewUniverse = [{ kind: "pending" }, { kind: "in-review" }, { kind: "merged" }];
        // Only define 3 of 9 transitions
        const { matrix, undefinedCount } = composeFromDispatcher(workflowUniverse, reviewUniverse, (a, b) => {
            if (a.kind === "draft" && b.kind === "pending")
                return { kind: "advance" };
            if (a.kind === "submitted" && b.kind === "in-review")
                return { kind: "block", reason: "x" };
            if (a.kind === "approved" && b.kind === "merged")
                return { kind: "complete" };
            return undefined;
        });
        expect(matrix.size).toBe(3);
        expect(undefinedCount).toBe(6); // 9 cross - 3 defined = 6 undefined
    });
    it("editable-lifetime substrate: adding new variants to matrix works at runtime", () => {
        // Start with minimal matrix
        let matrix = buildComposedMatrix([
            ["draft:pending", { kind: "advance" }],
        ]);
        // Editable: extend matrix with new transition (substrate-engineering substrate evolves)
        const extended = new Map(matrix);
        extended.set("submitted:in-review", { kind: "block", reason: "needs revision" });
        matrix = extended;
        const result = dispatchComposed({ matrix }, { kind: "submitted" }, { kind: "in-review" });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict.kind).toBe("block");
    });
    it("workflow-review composition: full 9-transition matrix exercised", () => {
        const workflowUniverse = [{ kind: "draft" }, { kind: "submitted" }, { kind: "approved" }];
        const reviewUniverse = [{ kind: "pending" }, { kind: "in-review" }, { kind: "merged" }];
        const { matrix } = composeFromDispatcher(workflowUniverse, reviewUniverse, (a, b) => {
            // Realistic dispatcher: encode all 9 transitions
            if (a.kind === "draft" && b.kind === "pending")
                return { kind: "advance" };
            if (a.kind === "draft" && b.kind === "in-review")
                return { kind: "block", reason: "can't review draft" };
            if (a.kind === "draft" && b.kind === "merged")
                return { kind: "block", reason: "can't merge draft" };
            if (a.kind === "submitted" && b.kind === "pending")
                return { kind: "advance" };
            if (a.kind === "submitted" && b.kind === "in-review")
                return { kind: "advance" };
            if (a.kind === "submitted" && b.kind === "merged")
                return { kind: "block", reason: "not approved" };
            if (a.kind === "approved" && b.kind === "pending")
                return { kind: "advance" };
            if (a.kind === "approved" && b.kind === "in-review")
                return { kind: "advance" };
            if (a.kind === "approved" && b.kind === "merged")
                return { kind: "complete" };
            return { kind: "block", reason: "unknown" };
        });
        expect(matrix.size).toBe(9);
        // Exercise all 9 transitions
        let advanceCount = 0;
        let blockCount = 0;
        let completeCount = 0;
        for (const [_, verdict] of matrix.entries()) {
            switch (verdict.kind) {
                case "advance":
                    advanceCount++;
                    break;
                case "block":
                    blockCount++;
                    break;
                case "complete":
                    completeCount++;
                    break;
            }
        }
        expect(advanceCount).toBe(5);
        expect(blockCount).toBe(3);
        expect(completeCount).toBe(1);
    });
    it("TransitionResult exhaustive (compile-time check)", () => {
        const acknowledge = (r) => {
            if (r.ok)
                return "ok";
            switch (r.feedback.kind) {
                case "UndefinedComposedTransition":
                case "InvalidStateA":
                case "InvalidStateB":
                    return r.feedback.kind;
            }
        };
        const matrix = buildComposedMatrix([]);
        const r = dispatchComposed({ matrix }, { kind: "draft" }, { kind: "pending" });
        expect(acknowledge(r)).toBe("UndefinedComposedTransition");
    });
    it("type-level: ComposedKey is template literal type of A['kind'] : B['kind']", () => {
        const _check1 = "draft:pending";
        const _check2 = "approved:merged";
        // Compile-only check; reference the bindings to satisfy noUnusedLocals
        expect(_check1).toBe("draft:pending");
        expect(_check2).toBe("approved:merged");
    });
});
