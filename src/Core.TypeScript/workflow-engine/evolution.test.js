/**
 * src/Core.TypeScript/workflow-engine/evolution.test.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.5 — invariant tests for pure-TS evolution agent.
 *
 * Run via: bun test src/Core.TypeScript/workflow-engine/evolution.test.ts
 */
import { describe, expect, it } from "bun:test";
import { evolveSurvivors, evolveTopN } from "./evolution";
const survivor = (id, substrate, skill) => ({
    id,
    substrate,
    conservativeSkill: skill,
    composesWith: [`source-${id}`],
});
describe("081KSNY2Z0008QG0R001YK61JQ.5 evolution agent substrate (mash + refine)", () => {
    it("simple-merge: top survivor's substrate as base + fills gaps from next", () => {
        const top = survivor("h1", { mechanism: "ER-stress-inhibition", drugCandidate: "cur-6", evidence: 0.8 }, 30);
        const next = survivor("h2", { mechanism: "kinase-inhibition", pathway: "PI3K-mTOR", evidence: 0.6 }, 20);
        const result = evolveSurvivors({ survivors: [top, next], strategy: "simple-merge" });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.variants.length).toBe(1);
        const variant = result.variants[0];
        expect(variant.strategy).toBe("simple-merge");
        expect(variant.derivedFrom).toEqual(["h1", "h2"]);
        // top wins on overlap
        expect(variant.substrate.mechanism).toBe("ER-stress-inhibition");
        expect(variant.substrate.drugCandidate).toBe("cur-6");
        expect(variant.substrate.evidence).toBe(0.8);
        // gap (pathway) filled from next
        expect(variant.substrate.pathway).toBe("PI3K-mTOR");
    });
    it("cross-pollinate: interleaves attributes between top 2", () => {
        const top = survivor("a", { mechanism: "A-mech", drugCandidate: "A-drug", pathway: "A-path", evidence: 0.9 }, 30);
        const next = survivor("b", { mechanism: "B-mech", drugCandidate: "B-drug", pathway: "B-path", evidence: 0.7 }, 20);
        const result = evolveSurvivors({ survivors: [top, next], strategy: "cross-pollinate" });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const variant = result.variants[0];
        expect(variant.strategy).toBe("cross-pollinate");
        // 4 keys sorted: drugCandidate, evidence, mechanism, pathway
        // indices: 0=drugCandidate (top), 1=evidence (next), 2=mechanism (top), 3=pathway (next)
        expect(variant.substrate.drugCandidate).toBe("A-drug");
        expect(variant.substrate.evidence).toBe(0.7);
        expect(variant.substrate.mechanism).toBe("A-mech");
        expect(variant.substrate.pathway).toBe("B-path");
    });
    it("mutate: applies caller-supplied transformer to top survivor", () => {
        const top = survivor("h1", { mechanism: "ER-stress", evidence: 0.8 }, 30);
        const result = evolveSurvivors({
            survivors: [top],
            strategy: "mutate",
            mutator: (s) => ({ ...s, evidence: s.evidence * 1.1 }),
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const variant = result.variants[0];
        expect(variant.strategy).toBe("mutate");
        expect(variant.derivedFrom).toEqual(["h1"]);
        expect(variant.substrate.evidence).toBeCloseTo(0.88, 6);
        expect(variant.substrate.mechanism).toBe("ER-stress");
    });
    it("mutate without mutator → MergeConflict", () => {
        const top = survivor("h1", { mechanism: "x", evidence: 0.5 }, 30);
        const result = evolveSurvivors({ survivors: [top], strategy: "mutate" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("MergeConflict");
        if (result.feedback.kind === "MergeConflict") {
            expect(result.feedback.survivorId).toBe("h1");
        }
    });
    it("empty survivor set → EmptySurvivorSet", () => {
        const result = evolveSurvivors({ survivors: [], strategy: "simple-merge" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("EmptySurvivorSet");
    });
    it("simple-merge with 1 survivor → InsufficientSurvivors", () => {
        const top = survivor("h1", { mechanism: "x", evidence: 0.5 }, 30);
        const result = evolveSurvivors({ survivors: [top], strategy: "simple-merge" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InsufficientSurvivors");
        if (result.feedback.kind === "InsufficientSurvivors") {
            expect(result.feedback.required).toBe(2);
            expect(result.feedback.provided).toBe(1);
        }
    });
    it("cross-pollinate with 1 survivor → InsufficientSurvivors", () => {
        const top = survivor("h1", { mechanism: "x", evidence: 0.5 }, 30);
        const result = evolveSurvivors({ survivors: [top], strategy: "cross-pollinate" });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InsufficientSurvivors");
    });
    it("derivedFrom + composesWith preserve provenance per honor-those-that-came-before", () => {
        const a = survivor("a", { mechanism: "x", evidence: 0.5 }, 30);
        const b = survivor("b", { mechanism: "y", evidence: 0.4 }, 20);
        const result = evolveSurvivors({ survivors: [a, b], strategy: "simple-merge" });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const variant = result.variants[0];
        expect(variant.derivedFrom).toEqual(["a", "b"]);
        // composesWith includes source attributions + the evolution row
        expect(variant.composesWith).toContain("source-a");
        expect(variant.composesWith).toContain("source-b");
        expect(variant.composesWith).toContain("081KSNY2Z0008QG0R001YK61JQ.5");
    });
    it("evolveTopN slices top-N from sorted survivors", () => {
        const survivors = [
            survivor("h1", { mechanism: "alpha", evidence: 0.9 }, 30),
            survivor("h2", { mechanism: "beta", evidence: 0.8 }, 25),
            survivor("h3", { mechanism: "gamma", evidence: 0.7 }, 20),
            survivor("h4", { mechanism: "delta", evidence: 0.6 }, 15),
        ];
        const result = evolveTopN(survivors, 2, "simple-merge");
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        // Only top 2 used for evolution
        expect(result.variants[0].derivedFrom).toEqual(["h1", "h2"]);
    });
    it("evolveTopN with N=1 mutate works", () => {
        const survivors = [
            survivor("h1", { mechanism: "alpha", evidence: 0.9 }, 30),
            survivor("h2", { mechanism: "beta", evidence: 0.8 }, 25),
        ];
        const result = evolveTopN(survivors, 1, "mutate", {
            mutator: (s) => ({ ...s, evidence: s.evidence + 0.01 }),
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.variants[0].substrate.evidence).toBeCloseTo(0.91, 6);
    });
    it("variant id includes prefix + strategy + survivor ids", () => {
        const a = survivor("foo", { mechanism: "x", evidence: 0.5 }, 30);
        const b = survivor("bar", { mechanism: "y", evidence: 0.4 }, 20);
        const result = evolveSurvivors({
            survivors: [a, b],
            strategy: "simple-merge",
            variantIdPrefix: "test",
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.variants[0].id).toBe("test-merge-foo-bar");
    });
    it("EvolutionStrategy union exhaustive switch (compile-time check)", () => {
        const acknowledge = (s) => {
            switch (s) {
                case "simple-merge":
                case "cross-pollinate":
                case "mutate":
                    return s;
            }
        };
        expect(acknowledge("simple-merge")).toBe("simple-merge");
        expect(acknowledge("cross-pollinate")).toBe("cross-pollinate");
        expect(acknowledge("mutate")).toBe("mutate");
    });
});
