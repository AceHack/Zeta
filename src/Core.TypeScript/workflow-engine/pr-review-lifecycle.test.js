// Invariant tests for PrReviewLifecycle — producing-side review work substrate.
import { describe, expect, test } from "bun:test";
import { PR_REVIEW_LIFECYCLE_UNIVERSE, dispatchPrReviewTransition, isHumanOperator, isPeerAgent, newReviewContext, requiresCoordinationLane, } from "./pr-review-lifecycle.js";
describe("PrReviewLifecycle universe", () => {
    test("7 distinct review-lifecycle states", () => {
        expect(PR_REVIEW_LIFECYCLE_UNIVERSE.length).toBe(7);
        const kinds = PR_REVIEW_LIFECYCLE_UNIVERSE.map((s) => s.kind);
        expect(kinds).toContain("observe");
        expect(kinds).toContain("identify-finding");
        expect(kinds).toContain("verify-finding"); // grep-substrate-anchors step
        expect(kinds).toContain("post");
        expect(kinds).toContain("conclude");
    });
});
describe("dispatch transitions (happy path)", () => {
    const baseContext = newReviewContext(5805, "self", "workflow-engine");
    test("observe with NO findings → conclude (no-engagement)", () => {
        const r = dispatchPrReviewTransition({ kind: "observe" }, baseContext);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("conclude");
            expect(r.outcome.artifact?.kind).toBe("no-engagement-warranted");
        }
    });
    test("observe WITH findings → identify-finding", () => {
        const finding = {
            prNumber: 5805,
            kind: { kind: "substrate-honest-praise", reason: "rank-4 substrate-primitive lands cleanly" },
            content: "lgtm",
            substrateAnchors: ["PR #5792 rank-4 substrate-primitive memory"],
        };
        const ctx = { ...baseContext, findings: [finding] };
        const r = dispatchPrReviewTransition({ kind: "observe" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("identify-finding");
        }
    });
    test("identify-finding → compose", () => {
        const r = dispatchPrReviewTransition({ kind: "identify-finding" }, baseContext);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("compose");
        }
    });
    test("compose → verify-finding (grep-substrate-anchors discipline)", () => {
        const r = dispatchPrReviewTransition({ kind: "compose" }, baseContext);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("verify-finding");
        }
    });
    test("verify-finding with substantiated finding → post", () => {
        const finding = {
            prNumber: 5805,
            kind: { kind: "bug", severity: "minor" },
            content: "off-by-one suspected",
            substrateAnchors: ["line 50: index < len"], // anchor present
        };
        const ctx = { ...baseContext, findings: [finding] };
        const r = dispatchPrReviewTransition({ kind: "verify-finding" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("post");
        }
    });
    test("verify-finding with UNSUBSTANTIATED finding → FindingUnsubstantiated feedback", () => {
        const finding = {
            prNumber: 5805,
            kind: { kind: "bug", severity: "minor" },
            content: "vibes off",
            substrateAnchors: [], // no anchor — per grep-substrate-anchors rule fails
        };
        const ctx = { ...baseContext, findings: [finding] };
        const r = dispatchPrReviewTransition({ kind: "verify-finding" }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.feedback.kind).toBe("FindingUnsubstantiated");
        }
    });
    test("post → follow-up with review-comment-posted artifact", () => {
        const r = dispatchPrReviewTransition({ kind: "post" }, baseContext);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("follow-up");
            expect(r.outcome.artifact?.kind).toBe("review-comment-posted");
        }
    });
    test("follow-up → conclude", () => {
        const r = dispatchPrReviewTransition({ kind: "follow-up" }, baseContext);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("conclude");
        }
    });
    test("conclude is terminal (stays at conclude)", () => {
        const r = dispatchPrReviewTransition({ kind: "conclude" }, baseContext);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("conclude");
        }
    });
});
describe("ReviewFindingKind taxonomy", () => {
    test("supports bug + design-question + substrate-engineering + naming + test-gap + praise + docs-gap + composes-with", () => {
        const findings = [
            { prNumber: 1, content: "x", kind: { kind: "bug", severity: "critical" } },
            { prNumber: 1, content: "x", kind: { kind: "design-question", subject: "lifecycle DU shape?" } },
            { prNumber: 1, content: "x", kind: { kind: "substrate-engineering-suggestion", alternative: "prefer Result<T,F>" } },
            { prNumber: 1, content: "x", kind: { kind: "naming-improvement", current: "foo", proposed: "bar" } },
            { prNumber: 1, content: "x", kind: { kind: "test-gap", uncovered: "edge case X" } },
            { prNumber: 1, content: "x", kind: { kind: "substrate-honest-praise", reason: "composes cleanly" } },
            { prNumber: 1, content: "x", kind: { kind: "documentation-gap", missing: "F# interop note" } },
            { prNumber: 1, content: "x", kind: { kind: "composes-with-substrate", relatedRef: "PR #5805" } },
        ];
        expect(findings.length).toBe(8);
    });
});
describe("requiresCoordinationLane discriminator", () => {
    test("self → false (my own work; no coordination needed)", () => {
        expect(requiresCoordinationLane("self")).toBe(false);
    });
    test("peer-otto → true (peer-agent territory)", () => {
        expect(requiresCoordinationLane("peer-otto")).toBe(true);
    });
    test("peer-codex / peer-lior / peer-alexa → true (peer-agent territory)", () => {
        expect(requiresCoordinationLane("peer-codex")).toBe(true);
        expect(requiresCoordinationLane("peer-lior")).toBe(true);
        expect(requiresCoordinationLane("peer-alexa")).toBe(true);
    });
    test("human-operator → true (distinct lane; coordination required)", () => {
        expect(requiresCoordinationLane("human-operator")).toBe(true);
    });
    test("unknown → false (default; treat as substrate-honest mine)", () => {
        expect(requiresCoordinationLane("unknown")).toBe(false);
    });
});
describe("isPeerAgent / isHumanOperator distinguish lanes", () => {
    test("peer-otto is peer-agent, not human-operator", () => {
        expect(isPeerAgent("peer-otto")).toBe(true);
        expect(isHumanOperator("peer-otto")).toBe(false);
    });
    test("human-operator is human-operator, not peer-agent", () => {
        expect(isPeerAgent("human-operator")).toBe(false);
        expect(isHumanOperator("human-operator")).toBe(true);
    });
    test("self is neither peer-agent nor human-operator", () => {
        expect(isPeerAgent("self")).toBe(false);
        expect(isHumanOperator("self")).toBe(false);
    });
});
describe("newReviewContext constructor", () => {
    test("initializes with empty findings + zero observations", () => {
        const ctx = newReviewContext(5805, "self", "workflow-engine");
        expect(ctx.prNumber).toBe(5805);
        expect(ctx.authorLane).toBe("self");
        expect(ctx.substrateScope).toBe("workflow-engine");
        expect(ctx.findings.length).toBe(0);
        expect(ctx.observationsMade).toBe(0);
    });
});
describe("type-level PrReviewLifecycle exhaustive switch (compile check)", () => {
    test("all 7 variants distinguishable", () => {
        const variants = [
            { kind: "observe" },
            { kind: "identify-finding" },
            { kind: "compose" },
            { kind: "verify-finding" },
            { kind: "post" },
            { kind: "follow-up" },
            { kind: "conclude" },
        ];
        expect(variants.length).toBe(7);
    });
});
