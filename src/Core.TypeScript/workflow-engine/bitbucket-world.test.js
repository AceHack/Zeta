// Invariant tests for BitbucketWorld per-host adapter.
import { describe, expect, test } from "bun:test";
import { buildGitWorld } from "./git-world.js";
import { buildBitbucketWorld, canAffordBitbucket, bitbucketRateLimitTier, BITBUCKET_PR_UNIVERSE, BITBUCKET_PIPELINE_UNIVERSE, BITBUCKET_APPROVALS_MISSING_VERDICT, } from "./bitbucket-world.js";
describe("BitbucketWorld constructor + inheritance", () => {
    test("buildBitbucketWorld extends GitWorld base", () => {
        const w = buildBitbucketWorld(buildGitWorld());
        expect(w.forgeName).toBe("git");
        expect(w.forgeSpecialization).toBe("bitbucket");
        expect(w.branchUniverse.length).toBe(4);
    });
    test("populates PR (4) + comment (4) + pipeline (7) + branchRestriction (3) universes", () => {
        const w = buildBitbucketWorld(buildGitWorld());
        expect(w.prUniverse.length).toBe(4); // open/declined/merged/superseded (no draft)
        expect(w.commentUniverse.length).toBe(4);
        expect(w.pipelineUniverse.length).toBe(7);
        expect(w.branchRestrictionUniverse.length).toBe(3);
    });
});
describe("bitbucketRateLimitTier (1000/hour OAuth default)", () => {
    test("tier boundaries scaled for Bitbucket", () => {
        expect(bitbucketRateLimitTier(800)).toBe("normal");
        expect(bitbucketRateLimitTier(300)).toBe("cost-aware");
        expect(bitbucketRateLimitTier(100)).toBe("extreme-cost-aware");
        expect(bitbucketRateLimitTier(20)).toBe("pure-git");
    });
});
describe("canAffordBitbucket", () => {
    test("within budget → ok", () => {
        const w = buildBitbucketWorld(buildGitWorld(), { hourlyRemaining: 500, hourlyLimit: 1000, hourlyResetAt: 1700003600 });
        expect(canAffordBitbucket(w, 100).ok).toBe(true);
    });
    test("exceeded → ResourceBudgetExhausted", () => {
        const w = buildBitbucketWorld(buildGitWorld(), { hourlyRemaining: 10, hourlyLimit: 1000, hourlyResetAt: 1700003600 });
        const r = canAffordBitbucket(w, 100);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.feedback.kind).toBe("ResourceBudgetExhausted");
    });
});
describe("reusable exports", () => {
    test("PR + pipeline + verdict shapes", () => {
        expect(BITBUCKET_PR_UNIVERSE.map(p => p.kind)).toContain("declined");
        expect(BITBUCKET_PR_UNIVERSE.map(p => p.kind)).toContain("superseded");
        expect(BITBUCKET_PIPELINE_UNIVERSE.length).toBe(7);
        expect(BITBUCKET_APPROVALS_MISSING_VERDICT.kind).toBe("block");
    });
});
