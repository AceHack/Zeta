// Invariant tests for world-hierarchy substrate (per the human maintainer,
// 2026-05-28).
import { describe, test, expect } from "bun:test";
import { OPEN_QUESTION_DBSP_CLIFFORD, parentOf, depthOf, inheritsFrom, verifyHierarchy, annotateHierarchy, primaryWorkingHypothesis, } from "./world-hierarchy";
import { EMPTY_WORLD } from "./world";
describe("substrate-algebra parentOf chain", () => {
    test("clifford has no parent (root)", () => {
        expect(parentOf("clifford")).toBeNull();
    });
    test("dbsp inherits from clifford", () => {
        expect(parentOf("dbsp")).toBe("clifford");
    });
    test("git inherits from dbsp", () => {
        expect(parentOf("git")).toBe("dbsp");
    });
    test("git-forge inherits from git", () => {
        expect(parentOf("git-forge")).toBe("git");
    });
});
describe("depthOf mapping", () => {
    test("clifford = 0", () => expect(depthOf("clifford")).toBe(0));
    test("dbsp = 1", () => expect(depthOf("dbsp")).toBe(1));
    test("git = 2", () => expect(depthOf("git")).toBe(2));
    test("git-forge = 3", () => expect(depthOf("git-forge")).toBe(3));
});
describe("inheritsFrom IS-A relation", () => {
    test("reflexive: everything is-a itself", () => {
        const all = ["clifford", "dbsp", "git", "git-forge"];
        for (const a of all) {
            expect(inheritsFrom(a, a)).toBe(true);
        }
    });
    test("git-forge is-a git is-a dbsp is-a clifford", () => {
        expect(inheritsFrom("git-forge", "git")).toBe(true);
        expect(inheritsFrom("git-forge", "dbsp")).toBe(true);
        expect(inheritsFrom("git-forge", "clifford")).toBe(true);
    });
    test("git is-a dbsp is-a clifford (no forge)", () => {
        expect(inheritsFrom("git", "dbsp")).toBe(true);
        expect(inheritsFrom("git", "clifford")).toBe(true);
        expect(inheritsFrom("git", "git-forge")).toBe(false);
    });
    test("dbsp is-a clifford (not git, not git-forge)", () => {
        expect(inheritsFrom("dbsp", "clifford")).toBe(true);
        expect(inheritsFrom("dbsp", "git")).toBe(false);
        expect(inheritsFrom("dbsp", "git-forge")).toBe(false);
    });
    test("clifford only is-a itself (root)", () => {
        expect(inheritsFrom("clifford", "dbsp")).toBe(false);
        expect(inheritsFrom("clifford", "git")).toBe(false);
        expect(inheritsFrom("clifford", "git-forge")).toBe(false);
    });
});
describe("annotateHierarchy", () => {
    test("annotates with correct algebra + depth + parent", () => {
        const annotated = annotateHierarchy(EMPTY_WORLD, "git");
        expect(annotated.substrateAlgebra).toBe("git");
        expect(annotated.hierarchyDepth).toBe(2);
        expect(annotated.parentAlgebra).toBe("dbsp");
    });
    test("annotates clifford root correctly (parent null)", () => {
        const annotated = annotateHierarchy(EMPTY_WORLD, "clifford");
        expect(annotated.substrateAlgebra).toBe("clifford");
        expect(annotated.hierarchyDepth).toBe(0);
        expect(annotated.parentAlgebra).toBeNull();
    });
});
describe("verifyHierarchy", () => {
    test("accepts well-formed hierarchical world", () => {
        const world = {
            ...EMPTY_WORLD,
            substrateAlgebra: "git-forge",
            hierarchyDepth: 3,
            parentAlgebra: "git",
        };
        const result = verifyHierarchy(world);
        expect(result.ok).toBe(true);
    });
    test("rejects depth-mismatch", () => {
        const world = {
            ...EMPTY_WORLD,
            substrateAlgebra: "git",
            hierarchyDepth: 0, // wrong; should be 2
            parentAlgebra: "dbsp",
        };
        const result = verifyHierarchy(world);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.feedback.kind).toBe("DepthMismatch");
        }
    });
    test("rejects wrong-parent", () => {
        const world = {
            ...EMPTY_WORLD,
            substrateAlgebra: "git",
            hierarchyDepth: 2,
            parentAlgebra: "clifford", // wrong; should be dbsp
        };
        const result = verifyHierarchy(world);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.feedback.kind).toBe("MissingIntermediateLayer");
        }
    });
});
describe("open-question substrate preservation (don't-collapse discipline)", () => {
    test("OPEN_QUESTION_DBSP_CLIFFORD preserves both readings", () => {
        expect(OPEN_QUESTION_DBSP_CLIFFORD.kind).toBe("open-question");
        if (OPEN_QUESTION_DBSP_CLIFFORD.kind === "open-question") {
            expect(OPEN_QUESTION_DBSP_CLIFFORD.preservedReadings.length).toBe(2);
            // Both readings preserved verbatim per default-to-both
            expect(OPEN_QUESTION_DBSP_CLIFFORD.preservedReadings[0]).toContain("strict-subset");
            expect(OPEN_QUESTION_DBSP_CLIFFORD.preservedReadings[1]).toContain("fully isomorphic");
        }
    });
    test("vote ordering records the human maintainer's '1 first 2 2nd' substrate", () => {
        if (OPEN_QUESTION_DBSP_CLIFFORD.kind === "open-question") {
            expect(OPEN_QUESTION_DBSP_CLIFFORD.voteOrdering).toEqual([0, 1]);
        }
    });
    test("primaryWorkingHypothesis returns strict-subset (operator-vote (A))", () => {
        const primary = primaryWorkingHypothesis(OPEN_QUESTION_DBSP_CLIFFORD);
        expect(primary).toContain("strict-subset");
    });
    test("primaryWorkingHypothesis returns null for non-open-question", () => {
        const resolved = { kind: "strict-restriction", rationale: "test" };
        expect(primaryWorkingHypothesis(resolved)).toBeNull();
    });
});
describe("substrate-engineering composition (end-to-end)", () => {
    test("annotate + verify + inheritance chain query", () => {
        const githubWorld = annotateHierarchy(EMPTY_WORLD, "git-forge");
        const verified = verifyHierarchy(githubWorld);
        expect(verified.ok).toBe(true);
        expect(inheritsFrom(githubWorld.substrateAlgebra, "clifford")).toBe(true);
        expect(inheritsFrom(githubWorld.substrateAlgebra, "dbsp")).toBe(true);
        expect(inheritsFrom(githubWorld.substrateAlgebra, "git")).toBe(true);
    });
    test("malformed Clifford root with non-null parent → expectedParent is null (not 'clifford' coalesced)", () => {
        // Regression test: a root CliffordWorld carrying a non-null
        // parentAlgebra is malformed. The feedback should say
        // "expected parent is null" (root has no parent), NOT
        // "expected parent is clifford" (which would imply the root
        // parents itself — a different, wrong, claim).
        const malformedClifford = {
            ...EMPTY_WORLD,
            substrateAlgebra: "clifford",
            hierarchyDepth: 0,
            parentAlgebra: "dbsp", // wrong; root should have null
        };
        const verified = verifyHierarchy(malformedClifford);
        expect(verified.ok).toBe(false);
        if (verified.ok)
            throw new Error("expected ok=false");
        expect(verified.feedback.kind).toBe("MissingIntermediateLayer");
        if (verified.feedback.kind !== "MissingIntermediateLayer")
            return;
        // The root expectation IS null — not a coalesced sentinel.
        expect(verified.feedback.expectedParent).toBeNull();
        expect(verified.feedback.actualParent).toBe("dbsp");
    });
});
