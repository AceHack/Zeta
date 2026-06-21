/**
 * src/Core.TypeScript/workflow-engine/proximity.test.ts
 *
 * B-0914.6 — invariant tests for proximity-dedup substrate.
 */
import { describe, expect, it } from "bun:test";
import { clusterByCanonical, clusterBySimilarity, defaultTokenize, jaccardSimilarity, uniqueRepresentatives, } from "./proximity";
describe("B-0914.6 proximity-dedup substrate", () => {
    it("clusterByCanonical groups items with same canonical form", () => {
        const corpus = [
            { mechanism: "ER-stress", drugCandidate: "cur-6", evidence: 0.8 },
            { mechanism: "ER-Stress", drugCandidate: "Cur-6", evidence: 0.7 }, // case-only diff
            { mechanism: "kinase", drugCandidate: "drug-x", evidence: 0.6 },
        ];
        const result = clusterByCanonical(corpus, (h) => `${h.mechanism.toLowerCase()}|${h.drugCandidate.toLowerCase()}`);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.uniqueCount).toBe(2);
        expect(result.clusters[0].members.length).toBe(2); // ER-stress + ER-Stress
        expect(result.clusters[1].members.length).toBe(1); // kinase
    });
    it("clusterByCanonical: first-seen is representative", () => {
        const corpus = [
            { mechanism: "x", drugCandidate: "a", evidence: 0.5 }, // first
            { mechanism: "x", drugCandidate: "a", evidence: 0.9 }, // duplicate
        ];
        const result = clusterByCanonical(corpus, (h) => `${h.mechanism}|${h.drugCandidate}`);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.clusters[0].representative.evidence).toBe(0.5); // first-seen
    });
    it("clusterByCanonical empty corpus → EmptyCorpus", () => {
        const result = clusterByCanonical([], (h) => h.mechanism);
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("EmptyCorpus");
    });
    it("clusterByCanonical: all unique returns N clusters of size 1", () => {
        const corpus = [
            { mechanism: "a", drugCandidate: "1", evidence: 0.1 },
            { mechanism: "b", drugCandidate: "2", evidence: 0.2 },
            { mechanism: "c", drugCandidate: "3", evidence: 0.3 },
        ];
        const result = clusterByCanonical(corpus, (h) => `${h.mechanism}|${h.drugCandidate}`);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.uniqueCount).toBe(3);
        for (const c of result.clusters) {
            expect(c.members.length).toBe(1);
        }
    });
    it("jaccardSimilarity: identical token sets = 1.0", () => {
        const a = new Set(["alpha", "beta", "gamma"]);
        const b = new Set(["alpha", "beta", "gamma"]);
        expect(jaccardSimilarity(a, b)).toBe(1.0);
    });
    it("jaccardSimilarity: disjoint token sets = 0.0", () => {
        const a = new Set(["alpha", "beta"]);
        const b = new Set(["gamma", "delta"]);
        expect(jaccardSimilarity(a, b)).toBe(0.0);
    });
    it("jaccardSimilarity: partial overlap returns intersection/union", () => {
        const a = new Set(["alpha", "beta", "gamma"]);
        const b = new Set(["beta", "gamma", "delta"]);
        // intersection = {beta, gamma} (size 2)
        // union = {alpha, beta, gamma, delta} (size 4)
        // jaccard = 2/4 = 0.5
        expect(jaccardSimilarity(a, b)).toBe(0.5);
    });
    it("jaccardSimilarity: both empty returns 1.0", () => {
        expect(jaccardSimilarity(new Set(), new Set())).toBe(1.0);
    });
    it("jaccardSimilarity: one empty returns 0.0", () => {
        expect(jaccardSimilarity(new Set(["x"]), new Set())).toBe(0.0);
        expect(jaccardSimilarity(new Set(), new Set(["x"]))).toBe(0.0);
    });
    it("defaultTokenize: lowercase + filter stop words + filter single-char", () => {
        const tokens = defaultTokenize("The quick BROWN fox jumps over the lazy dog");
        expect(tokens.has("quick")).toBe(true);
        expect(tokens.has("brown")).toBe(true);
        expect(tokens.has("the")).toBe(false); // stop word
        expect(tokens.has("over")).toBe(true);
    });
    it("clusterBySimilarity: threshold catches near-duplicates", () => {
        const corpus = [
            "ER-stress inhibition via cur-6 targeting unfolded protein response",
            "ER-stress inhibition via cur-6 mechanism", // shares 'ER-stress', 'inhibition', 'via', 'cur-6'
            "kinase inhibition via drug-x targeting cellular signaling",
        ];
        const result = clusterBySimilarity({
            corpus,
            extractTokens: defaultTokenize,
            threshold: 0.4, // moderate threshold
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        // First 2 should cluster; third is distinct
        expect(result.uniqueCount).toBe(2);
    });
    it("clusterBySimilarity: high threshold keeps all distinct", () => {
        const corpus = ["alpha beta", "alpha beta gamma", "alpha beta delta"];
        const result = clusterBySimilarity({
            corpus,
            extractTokens: defaultTokenize,
            threshold: 1.0, // unanimous-only
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.uniqueCount).toBe(3);
    });
    it("clusterBySimilarity: low threshold clusters aggressively", () => {
        const corpus = ["alpha beta gamma", "alpha", "beta", "gamma"];
        const result = clusterBySimilarity({
            corpus,
            extractTokens: defaultTokenize,
            threshold: 0.2,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        // First item has all 3; others share 1 of 3 with first → 1/3 ≈ 0.33 > 0.2 → cluster
        expect(result.uniqueCount).toBe(1);
    });
    it("clusterBySimilarity: invalid threshold → InvalidThreshold", () => {
        const result = clusterBySimilarity({
            corpus: ["x"],
            extractTokens: defaultTokenize,
            threshold: 1.5,
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InvalidThreshold");
    });
    it("clusterBySimilarity: empty corpus → EmptyCorpus", () => {
        const result = clusterBySimilarity({
            corpus: [],
            extractTokens: defaultTokenize,
            threshold: 0.5,
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("EmptyCorpus");
    });
    it("uniqueRepresentatives extracts representative-only list", () => {
        const corpus = [
            { mechanism: "x", drugCandidate: "a", evidence: 0.5 },
            { mechanism: "x", drugCandidate: "a", evidence: 0.9 },
            { mechanism: "y", drugCandidate: "b", evidence: 0.7 },
        ];
        const result = clusterByCanonical(corpus, (h) => `${h.mechanism}|${h.drugCandidate}`);
        const reps = uniqueRepresentatives(result);
        expect(reps.length).toBe(2);
        expect(reps[0].mechanism).toBe("x");
        expect(reps[1].mechanism).toBe("y");
    });
    it("uniqueRepresentatives returns empty for failed result", () => {
        const result = clusterByCanonical([], (h) => h.mechanism);
        expect(uniqueRepresentatives(result).length).toBe(0);
    });
    it("compose with evolution substrate: pre-sort by score → representative is best", () => {
        // Simulates: TrueSkill ranks survivors → proximity dedups → take representatives
        const survivors = [
            { id: "h3", canonical: "ER-stress", skill: 30 },
            { id: "h1", canonical: "ER-stress", skill: 20 },
            { id: "h2", canonical: "kinase", skill: 25 },
        ];
        // Pre-sort by skill descending (highest-rank first)
        const sorted = [...survivors].sort((a, b) => b.skill - a.skill);
        const result = clusterByCanonical(sorted, (s) => s.canonical);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        // h3 (skill 30) was first-seen for "ER-stress" cluster
        const erStressCluster = result.clusters.find((c) => c.canonicalForm === "ER-stress");
        expect(erStressCluster?.representative.id).toBe("h3");
    });
    it("ProximityFeedback exhaustive switch (compile-time check)", () => {
        const acknowledge = (r) => {
            if (r.ok)
                return "ok";
            switch (r.feedback.kind) {
                case "EmptyCorpus":
                case "InvalidThreshold":
                    return r.feedback.kind;
            }
        };
        const r = clusterByCanonical([], (h) => h.mechanism);
        expect(acknowledge(r)).toBe("EmptyCorpus");
    });
});
