/**
 * src/Core.TypeScript/workflow-engine/trueskill.test.ts
 *
 * B-0914.1 — invariant tests for pure-TS TrueSkill 1v1 scaffold.
 *
 * Run via: bun test src/Core.TypeScript/workflow-engine/trueskill.test.ts
 */
import { describe, expect, it } from "bun:test";
import { DEFAULT_INITIAL_RATING, DEFAULT_PARAMS, conservativeSkill, rate1v1, } from "./trueskill";
describe("B-0914.1 pure-TS TrueSkill 1v1 substrate", () => {
    it("default initial rating matches Xbox Live convention (mu=25 sigma=25/3)", () => {
        expect(DEFAULT_INITIAL_RATING.mu).toBe(25);
        expect(DEFAULT_INITIAL_RATING.sigma).toBeCloseTo(25 / 3, 6);
    });
    it("default params match paper convention (beta=mu/6 tau=mu/300 drawProb=0.10)", () => {
        expect(DEFAULT_PARAMS.beta).toBeCloseTo(25 / 6, 6);
        expect(DEFAULT_PARAMS.tau).toBeCloseTo(25 / 300, 6);
        expect(DEFAULT_PARAMS.drawProbability).toBe(0.1);
    });
    it("conservativeSkill returns mu - 3*sigma", () => {
        expect(conservativeSkill(DEFAULT_INITIAL_RATING)).toBeCloseTo(25 - 3 * (25 / 3), 6);
        expect(conservativeSkill({ mu: 30, sigma: 5 })).toBe(15);
    });
    it("win-A: A's mu increases, B's mu decreases", () => {
        const result = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-A" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.ratingA.mu).toBeGreaterThan(DEFAULT_INITIAL_RATING.mu);
            expect(result.ratingB.mu).toBeLessThan(DEFAULT_INITIAL_RATING.mu);
        }
    });
    it("win-B: B's mu increases, A's mu decreases", () => {
        const result = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-B" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.ratingB.mu).toBeGreaterThan(DEFAULT_INITIAL_RATING.mu);
            expect(result.ratingA.mu).toBeLessThan(DEFAULT_INITIAL_RATING.mu);
        }
    });
    it("both sigmas decrease after a match (uncertainty reduction)", () => {
        const result = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-A" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Note: sigma can increase slightly due to dynamics (tau²); but the
            // posterior shift dominates for default params, so sigma should net-decrease
            expect(result.ratingA.sigma).toBeLessThan(DEFAULT_INITIAL_RATING.sigma);
            expect(result.ratingB.sigma).toBeLessThan(DEFAULT_INITIAL_RATING.sigma);
        }
    });
    it("after 2 matches both sigmas decrease + mus drift is bounded (path-dependent updates)", () => {
        const r1 = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "win-A" });
        expect(r1.ok).toBe(true);
        if (!r1.ok)
            return;
        const r2 = rate1v1(r1.ratingA, r1.ratingB, { kind: "win-B" });
        expect(r2.ok).toBe(true);
        if (!r2.ok)
            return;
        // Both sigmas decrease (more info → less uncertainty)
        expect(r2.ratingA.sigma).toBeLessThan(DEFAULT_INITIAL_RATING.sigma);
        expect(r2.ratingB.sigma).toBeLessThan(DEFAULT_INITIAL_RATING.sigma);
        // Mu drift exists but bounded — second match has smaller impact due to
        // sigma reduction from first match; assertion is loose tolerance for
        // path-dependent updates rather than exact baseline-return
        expect(Math.abs(r2.ratingA.mu - DEFAULT_INITIAL_RATING.mu)).toBeLessThan(5);
        expect(Math.abs(r2.ratingB.mu - DEFAULT_INITIAL_RATING.mu)).toBeLessThan(5);
    });
    it("strong player beats weak player → small mu shift (expected outcome)", () => {
        const strong = { mu: 40, sigma: 5 };
        const weak = { mu: 10, sigma: 5 };
        const result = rate1v1(strong, weak, { kind: "win-A" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Strong player beating weak player → small skill update (expected)
            const muShift = result.ratingA.mu - strong.mu;
            expect(muShift).toBeGreaterThan(0);
            expect(muShift).toBeLessThan(1); // < 1 point shift for fully-expected win
        }
    });
    it("weak player beats strong player → large mu shift (upset)", () => {
        const strong = { mu: 40, sigma: 5 };
        const weak = { mu: 10, sigma: 5 };
        const result = rate1v1(weak, strong, { kind: "win-A" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Weak player upsetting strong player → large skill update
            const muShift = result.ratingA.mu - weak.mu;
            expect(muShift).toBeGreaterThan(5); // upset = significant rating gain
        }
    });
    it("draw between equal players → minimal mu change", () => {
        const result = rate1v1(DEFAULT_INITIAL_RATING, DEFAULT_INITIAL_RATING, { kind: "draw" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Equal players drawing → mu barely changes
            expect(Math.abs(result.ratingA.mu - DEFAULT_INITIAL_RATING.mu)).toBeLessThan(0.1);
            expect(Math.abs(result.ratingB.mu - DEFAULT_INITIAL_RATING.mu)).toBeLessThan(0.1);
        }
    });
    it("draw between unequal players → strong player loses mu, weak gains", () => {
        const strong = { mu: 40, sigma: 5 };
        const weak = { mu: 10, sigma: 5 };
        const result = rate1v1(strong, weak, { kind: "draw" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Drawing against a weak player → strong loses rating
            expect(result.ratingA.mu).toBeLessThan(strong.mu);
            expect(result.ratingB.mu).toBeGreaterThan(weak.mu);
        }
    });
    it("returns InvalidRating for non-finite mu", () => {
        const bad = { mu: NaN, sigma: 5 };
        const result = rate1v1(bad, DEFAULT_INITIAL_RATING, { kind: "win-A" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.feedback.kind).toBe("InvalidRating");
        }
    });
    it("returns InvalidRating for non-positive sigma", () => {
        const bad = { mu: 25, sigma: 0 };
        const result = rate1v1(DEFAULT_INITIAL_RATING, bad, { kind: "win-A" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.feedback.kind).toBe("InvalidRating");
            if (result.feedback.kind === "InvalidRating") {
                expect(result.feedback.identity).toBe("B");
            }
        }
    });
    it("returns InvalidRating for negative sigma", () => {
        const bad = { mu: 25, sigma: -5 };
        const result = rate1v1(bad, DEFAULT_INITIAL_RATING, { kind: "win-A" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.feedback.kind).toBe("InvalidRating");
        }
    });
    it("conservativeSkill ranking: confident-strong > confident-weak > unconfident-new (high sigma punishes)", () => {
        const strong = { mu: 40, sigma: 3 };
        const newPlayer = DEFAULT_INITIAL_RATING; // mu=25 sigma=25/3 → conservative=0
        const weak = { mu: 10, sigma: 3 }; // confident-weak → conservative=1
        // Confident strong player has highest conservative skill
        expect(conservativeSkill(strong)).toBeGreaterThan(conservativeSkill(weak));
        // Confident weak player has HIGHER conservative skill than unconfident new player
        // (the conservative-skill metric punishes uncertainty — new player COULD be much
        // stronger but COULD be much weaker, so conservative bound is lower)
        expect(conservativeSkill(weak)).toBeGreaterThan(conservativeSkill(newPlayer));
        expect(conservativeSkill(newPlayer)).toBe(0); // 25 - 3*(25/3) = 0
    });
    it("tournament simulation: 5 matches with consistent outcomes converges sigma", () => {
        let ratingA = DEFAULT_INITIAL_RATING;
        let ratingB = DEFAULT_INITIAL_RATING;
        const initialSigma = ratingA.sigma;
        // Simulate 5 matches where A consistently wins
        for (let i = 0; i < 5; i++) {
            const result = rate1v1(ratingA, ratingB, { kind: "win-A" });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            ratingA = result.ratingA;
            ratingB = result.ratingB;
        }
        // After 5 wins, A's skill should be clearly higher than B's
        expect(ratingA.mu).toBeGreaterThan(ratingB.mu + 5);
        // Both sigmas should be significantly reduced
        expect(ratingA.sigma).toBeLessThan(initialSigma * 0.85);
        expect(ratingB.sigma).toBeLessThan(initialSigma * 0.85);
    });
    it("MatchOutcome union exhaustive switch (compile-time check)", () => {
        const acknowledge = (o) => {
            switch (o.kind) {
                case "win-A":
                case "win-B":
                case "draw":
                    return o.kind;
            }
        };
        expect(acknowledge({ kind: "win-A" })).toBe("win-A");
        expect(acknowledge({ kind: "win-B" })).toBe("win-B");
        expect(acknowledge({ kind: "draw" })).toBe("draw");
    });
});
