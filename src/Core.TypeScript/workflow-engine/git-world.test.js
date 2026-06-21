/**
 * src/Core.TypeScript/workflow-engine/git-world.test.ts
 *
 * Invariant tests for git-world + github-world specialization substrate.
 */
import { describe, expect, it } from "bun:test";
import { GITHUB_PR_UNIVERSE, GITHUB_REVIEW_THREAD_UNIVERSE, REQUIRE_RESOLVED_VERDICT, buildGitHubWorld, buildGitWorld, canAfford, rateLimitTier, registerInGitHub, } from "./git-world";
describe("git-world + github-world specialization substrate", () => {
    it("buildGitWorld: forgeName='git' + branch+commit universes populated", () => {
        const gitWorld = buildGitWorld();
        expect(gitWorld.forgeName).toBe("git");
        expect(gitWorld.branchUniverse.length).toBe(4); // fresh, active, merged, deleted
        expect(gitWorld.commitUniverse.length).toBe(5); // pending, signed, pushed, merged, reverted
        expect(gitWorld.registry.size).toBe(0);
    });
    it("buildGitHubWorld: inherits GitWorld + adds PR + review-thread universes", () => {
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld);
        expect(githubWorld.forgeName).toBe("git"); // inherited
        expect(githubWorld.forgeSpecialization).toBe("github"); // added
        expect(githubWorld.branchUniverse.length).toBe(4); // inherited
        expect(githubWorld.commitUniverse.length).toBe(5); // inherited
        expect(githubWorld.prUniverse.length).toBe(6); // added
        expect(githubWorld.reviewThreadUniverse.length).toBe(3); // added
    });
    it("buildGitHubWorld: optional resource budget", () => {
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld, {
            restCoreRemaining: 4500,
            restCoreLimit: 5000,
            restCoreResetAt: 1700000000,
            graphqlRemaining: 4800,
            graphqlLimit: 5000,
            graphqlResetAt: 1700000000,
        });
        expect(githubWorld.resourceBudget).toBeDefined();
        expect(githubWorld.resourceBudget?.restCoreRemaining).toBe(4500);
    });
    it("rateLimitTier: > 2000 → normal", () => {
        expect(rateLimitTier(5000)).toBe("normal");
        expect(rateLimitTier(2001)).toBe("normal");
    });
    it("rateLimitTier: 1000-2000 → cost-aware", () => {
        expect(rateLimitTier(2000)).toBe("cost-aware");
        expect(rateLimitTier(1001)).toBe("cost-aware");
    });
    it("rateLimitTier: 200-1000 → extreme-cost-aware", () => {
        expect(rateLimitTier(1000)).toBe("extreme-cost-aware");
        expect(rateLimitTier(201)).toBe("extreme-cost-aware");
    });
    it("rateLimitTier: 0-200 → pure-git", () => {
        expect(rateLimitTier(200)).toBe("pure-git");
        expect(rateLimitTier(0)).toBe("pure-git");
    });
    it("canAfford: operation within budget → ok", () => {
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld, {
            restCoreRemaining: 100,
            restCoreLimit: 5000,
            restCoreResetAt: 1700000000,
            graphqlRemaining: 100,
            graphqlLimit: 5000,
            graphqlResetAt: 1700000000,
        });
        const result = canAfford(githubWorld, { restCoreCost: 50, graphqlCost: 50 });
        expect(result.ok).toBe(true);
    });
    it("canAfford: rest-core exhausted → ResourceBudgetExhausted/rest-core", () => {
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld, {
            restCoreRemaining: 10,
            restCoreLimit: 5000,
            restCoreResetAt: 1700000000,
            graphqlRemaining: 5000,
            graphqlLimit: 5000,
            graphqlResetAt: 1700000000,
        });
        const result = canAfford(githubWorld, { restCoreCost: 100 });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("ResourceBudgetExhausted");
        if (result.feedback.kind === "ResourceBudgetExhausted") {
            expect(result.feedback.budget).toBe("rest-core");
        }
    });
    it("canAfford: graphql exhausted → ResourceBudgetExhausted/graphql", () => {
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld, {
            restCoreRemaining: 5000,
            restCoreLimit: 5000,
            restCoreResetAt: 1700000000,
            graphqlRemaining: 10,
            graphqlLimit: 5000,
            graphqlResetAt: 1700000000,
        });
        const result = canAfford(githubWorld, { graphqlCost: 100 });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        if (result.feedback.kind === "ResourceBudgetExhausted") {
            expect(result.feedback.budget).toBe("graphql");
        }
    });
    it("canAfford: no budget loaded → ok (caller manages discipline)", () => {
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld); // no budget
        const result = canAfford(githubWorld, { restCoreCost: 1000000 });
        expect(result.ok).toBe(true); // permissive when budget not loaded
    });
    it("registerInGitHub: adds lifetime pair; preserves GitHubWorld substrate", () => {
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld);
        const matrix = new Map([
            ["open:unresolved", REQUIRE_RESOLVED_VERDICT],
            ["approved:resolved", { kind: "advance" }],
        ]);
        const updated = registerInGitHub(githubWorld, "pr-review-thread", matrix);
        expect(updated.registry.size).toBe(1);
        expect(updated.registry.has("pr-review-thread")).toBe(true);
        // GitHubWorld-specific substrate preserved
        expect(updated.forgeSpecialization).toBe("github");
        expect(updated.prUniverse.length).toBe(6);
    });
    it("REQUIRE_RESOLVED_VERDICT: block with substrate-honest reason", () => {
        expect(REQUIRE_RESOLVED_VERDICT.kind).toBe("block");
        if (REQUIRE_RESOLVED_VERDICT.kind === "block") {
            expect(REQUIRE_RESOLVED_VERDICT.reason).toContain("required_conversation_resolution");
        }
    });
    it("GITHUB_PR_UNIVERSE exports all 6 PR states", () => {
        expect(GITHUB_PR_UNIVERSE.length).toBe(6);
        const kinds = GITHUB_PR_UNIVERSE.map((p) => p.kind).sort();
        expect(kinds).toEqual(["approved", "closed", "draft", "merged", "open", "review-requested"]);
    });
    it("GITHUB_REVIEW_THREAD_UNIVERSE exports 3 thread states", () => {
        expect(GITHUB_REVIEW_THREAD_UNIVERSE.length).toBe(3);
        const kinds = GITHUB_REVIEW_THREAD_UNIVERSE.map((t) => t.kind).sort();
        expect(kinds).toEqual(["outdated", "resolved", "unresolved"]);
    });
    it("substrate-engineering substrate: GitHubWorld composes git+forge substrate cleanly", () => {
        // Showcase: build GitHubWorld + register pr-review pair + verify
        // composition works end-to-end
        const gitWorld = buildGitWorld();
        const githubWorld = buildGitHubWorld(gitWorld, {
            restCoreRemaining: 3000,
            restCoreLimit: 5000,
            restCoreResetAt: 1700000000,
            graphqlRemaining: 1500,
            graphqlLimit: 5000,
            graphqlResetAt: 1700000000,
        });
        // Check current tier
        expect(rateLimitTier(githubWorld.resourceBudget.graphqlRemaining)).toBe("cost-aware");
        // Register PR-review composed-lifetime matrix
        const matrix = new Map([
            ["draft:unresolved", { kind: "no-op" }],
            ["open:unresolved", REQUIRE_RESOLVED_VERDICT],
            ["open:resolved", { kind: "advance" }],
            ["approved:resolved", { kind: "advance" }],
            ["merged:resolved", { kind: "complete" }],
        ]);
        const enriched = registerInGitHub(githubWorld, "pr-review", matrix);
        expect(enriched.registry.size).toBe(1);
        expect(enriched.forgeSpecialization).toBe("github");
        expect(enriched.resourceBudget?.graphqlRemaining).toBe(1500);
    });
    it("registerLifetimePair preserves subclass fields when called with specialized world", () => {
        // Regression test for the spread-replace pattern: registerLifetimePair
        // returning `{ registry: newRegistry }` would silently drop all
        // GitHubWorld-specific fields (forgeName, forgeSpecialization,
        // branchUniverse, commitUniverse, prUniverse, reviewThreadUniverse,
        // resourceBudget). Generic-over-W signature + spread preserves them.
        const githubWorld = buildGitHubWorld(buildGitWorld(), {
            restCoreRemaining: 4000,
            restCoreLimit: 5000,
            restCoreResetAt: 1_700_000_000,
            graphqlRemaining: 4500,
            graphqlLimit: 5000,
            graphqlResetAt: 1_700_000_000,
        });
        const matrix = new Map([
            ["open:resolved", { kind: "advance" }],
        ]);
        const after = registerInGitHub(githubWorld, "pr-review", matrix);
        // Registry updated
        expect(after.registry.size).toBe(1);
        expect(after.registry.has("pr-review")).toBe(true);
        // ALL GitHubWorld-specific fields survive
        expect(after.forgeName).toBe("git");
        expect(after.forgeSpecialization).toBe("github");
        expect(after.branchUniverse.length).toBeGreaterThan(0);
        expect(after.commitUniverse.length).toBeGreaterThan(0);
        expect(after.prUniverse.length).toBeGreaterThan(0);
        expect(after.reviewThreadUniverse.length).toBeGreaterThan(0);
        expect(after.resourceBudget?.graphqlRemaining).toBe(4500);
        // Return type is GitHubWorld (compile-time check via field access above)
    });
});
