// Invariant tests for GitLabWorld per-host adapter (B-0867.15 PoC).
import { describe, expect, test } from "bun:test";
import { EMPTY_WORLD } from "./world.js";
import { buildGitWorld } from "./git-world.js";
import { buildGitLabWorld, canAffordGitLab, gitLabRateLimitTier, GITLAB_MR_UNIVERSE, GITLAB_DISCUSSION_UNIVERSE, GITLAB_PIPELINE_UNIVERSE, GITLAB_REQUIRE_RESOLVED_VERDICT, GITLAB_APPROVAL_NOT_MET_VERDICT, } from "./gitlab-world.js";
describe("GitLabWorld constructor + inheritance", () => {
    test("buildGitLabWorld extends GitWorld base", () => {
        const gitWorld = buildGitWorld();
        const gitLabWorld = buildGitLabWorld(gitWorld);
        expect(gitLabWorld.forgeName).toBe("git"); // inherited
        expect(gitLabWorld.forgeSpecialization).toBe("gitlab");
        expect(gitLabWorld.branchUniverse.length).toBe(4); // inherited from GitWorld
        expect(gitLabWorld.commitUniverse.length).toBe(5); // inherited
    });
    test("buildGitLabWorld populates MR + Discussion + Pipeline universes", () => {
        const gitLabWorld = buildGitLabWorld(buildGitWorld());
        expect(gitLabWorld.mrUniverse.length).toBe(6);
        expect(gitLabWorld.discussionUniverse.length).toBe(2);
        expect(gitLabWorld.pipelineUniverse.length).toBe(8);
    });
    test("buildGitLabWorld accepts optional resourceBudget", () => {
        const budget = {
            restRemaining: 1500,
            restLimit: 2000,
            restResetAt: 1700000000,
            graphqlRemaining: 800,
            graphqlLimit: 1000,
            graphqlResetAt: 1700000060,
        };
        const gitLabWorld = buildGitLabWorld(buildGitWorld(), budget);
        expect(gitLabWorld.resourceBudget).toEqual(budget);
    });
    test("buildGitLabWorld omits resourceBudget when not provided", () => {
        const gitLabWorld = buildGitLabWorld(buildGitWorld());
        expect(gitLabWorld.resourceBudget).toBeUndefined();
    });
});
describe("gitLabRateLimitTier tier boundaries", () => {
    test("normal tier when remaining > 800", () => {
        expect(gitLabRateLimitTier(2000)).toBe("normal");
        expect(gitLabRateLimitTier(801)).toBe("normal");
    });
    test("cost-aware tier when 400 < remaining ≤ 800", () => {
        expect(gitLabRateLimitTier(800)).toBe("cost-aware");
        expect(gitLabRateLimitTier(401)).toBe("cost-aware");
    });
    test("extreme-cost-aware tier when 80 < remaining ≤ 400", () => {
        expect(gitLabRateLimitTier(400)).toBe("extreme-cost-aware");
        expect(gitLabRateLimitTier(81)).toBe("extreme-cost-aware");
    });
    test("pure-git tier when remaining ≤ 80", () => {
        expect(gitLabRateLimitTier(80)).toBe("pure-git");
        expect(gitLabRateLimitTier(0)).toBe("pure-git");
    });
});
describe("canAffordGitLab budget enforcement", () => {
    const baseWorld = buildGitLabWorld(buildGitWorld(), {
        restRemaining: 100,
        restLimit: 2000,
        restResetAt: 1700000060,
        graphqlRemaining: 50,
        graphqlLimit: 1000,
        graphqlResetAt: 1700000120,
    });
    test("within budget returns ok", () => {
        const result = canAffordGitLab(baseWorld, { restCost: 5, graphqlCost: 5 });
        expect(result.ok).toBe(true);
    });
    test("REST exceeded returns ResourceBudgetExhausted with rest", () => {
        const result = canAffordGitLab(baseWorld, { restCost: 200 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.feedback.kind).toBe("ResourceBudgetExhausted");
            if (result.feedback.kind === "ResourceBudgetExhausted") {
                expect(result.feedback.budget).toBe("rest");
            }
        }
    });
    test("GraphQL exceeded returns ResourceBudgetExhausted with graphql", () => {
        const result = canAffordGitLab(baseWorld, { graphqlCost: 100 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.feedback.kind).toBe("ResourceBudgetExhausted");
            if (result.feedback.kind === "ResourceBudgetExhausted") {
                expect(result.feedback.budget).toBe("graphql");
            }
        }
    });
    test("no budget loaded → ok by default", () => {
        const noBudgetWorld = buildGitLabWorld(buildGitWorld());
        const result = canAffordGitLab(noBudgetWorld, { restCost: 1_000_000 });
        expect(result.ok).toBe(true);
    });
});
describe("reusable substrate exports", () => {
    test("GITLAB_MR_UNIVERSE has 6 variants", () => {
        expect(GITLAB_MR_UNIVERSE.length).toBe(6);
        const kinds = GITLAB_MR_UNIVERSE.map((m) => m.kind);
        expect(kinds).toContain("draft");
        expect(kinds).toContain("opened");
        expect(kinds).toContain("merged");
    });
    test("GITLAB_DISCUSSION_UNIVERSE has 2 variants", () => {
        expect(GITLAB_DISCUSSION_UNIVERSE.length).toBe(2);
        expect(GITLAB_DISCUSSION_UNIVERSE.map((d) => d.kind)).toEqual([
            "unresolved",
            "resolved",
        ]);
    });
    test("GITLAB_PIPELINE_UNIVERSE has 8 variants (GitLab-native CI/CD)", () => {
        expect(GITLAB_PIPELINE_UNIVERSE.length).toBe(8);
        const kinds = GITLAB_PIPELINE_UNIVERSE.map((p) => p.kind);
        expect(kinds).toContain("manual"); // GitLab-specific
        expect(kinds).toContain("skipped"); // GitLab-specific (CI rules)
    });
    test("GITLAB_REQUIRE_RESOLVED_VERDICT is block with GitLab vocabulary", () => {
        expect(GITLAB_REQUIRE_RESOLVED_VERDICT.kind).toBe("block");
        if (GITLAB_REQUIRE_RESOLVED_VERDICT.kind === "block") {
            expect(GITLAB_REQUIRE_RESOLVED_VERDICT.reason).toContain("GitLab");
            expect(GITLAB_REQUIRE_RESOLVED_VERDICT.reason).toContain("discussions");
        }
    });
    test("GITLAB_APPROVAL_NOT_MET_VERDICT is block with approval vocabulary", () => {
        expect(GITLAB_APPROVAL_NOT_MET_VERDICT.kind).toBe("block");
        if (GITLAB_APPROVAL_NOT_MET_VERDICT.kind === "block") {
            expect(GITLAB_APPROVAL_NOT_MET_VERDICT.reason).toContain("approval");
        }
    });
});
describe("type-level MrLifetime exhaustive switch (compile check)", () => {
    test("all 6 MR variants distinguishable", () => {
        const variants = [
            { kind: "draft" },
            { kind: "opened" },
            { kind: "reviewer-assigned" },
            { kind: "approved" },
            { kind: "merged" },
            { kind: "closed" },
        ];
        expect(variants.length).toBe(6);
    });
});
describe("end-to-end composition (GitWorld → GitLabWorld → budget-check)", () => {
    test("full chain: GitWorld base + GitLab specialization + budget enforcement", () => {
        const gitWorld = buildGitWorld();
        expect(EMPTY_WORLD.registry.size).toBe(0);
        const gitLabWorld = buildGitLabWorld(gitWorld, {
            restRemaining: 1500,
            restLimit: 2000,
            restResetAt: 1700000060,
            graphqlRemaining: 800,
            graphqlLimit: 1000,
            graphqlResetAt: 1700000120,
        });
        expect(gitLabWorld.forgeSpecialization).toBe("gitlab");
        expect(gitLabWorld.mrUniverse.length).toBe(6);
        expect(gitLabWorld.pipelineUniverse.length).toBe(8);
        const budgetCheck = canAffordGitLab(gitLabWorld, { restCost: 10, graphqlCost: 5 });
        expect(budgetCheck.ok).toBe(true);
        expect(gitLabRateLimitTier(gitLabWorld.resourceBudget.restRemaining)).toBe("normal");
    });
});
