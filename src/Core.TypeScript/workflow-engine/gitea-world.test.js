// Invariant tests for GiteaWorld per-host adapter.
import { describe, expect, test } from "bun:test";
import { buildGitWorld } from "./git-world.js";
import { buildGiteaWorld, canAffordGitea, giteaRateLimitTier, GITEA_PR_UNIVERSE, GITEA_REVIEW_UNIVERSE, GITEA_ACTION_UNIVERSE, GITEA_REQUIRE_RESOLVED_VERDICT, } from "./gitea-world.js";
describe("GiteaWorld constructor + inheritance", () => {
    test("buildGiteaWorld extends GitWorld base", () => {
        const w = buildGiteaWorld(buildGitWorld());
        expect(w.forgeName).toBe("git");
        expect(w.forgeSpecialization).toBe("gitea");
        expect(w.branchUniverse.length).toBe(4);
        expect(w.commitUniverse.length).toBe(5);
    });
    test("populates PR + review + action universes", () => {
        const w = buildGiteaWorld(buildGitWorld());
        expect(w.prUniverse.length).toBe(5);
        expect(w.reviewUniverse.length).toBe(2);
        expect(w.actionUniverse.length).toBe(5);
    });
    test("accepts optional resourceBudget", () => {
        const w = buildGiteaWorld(buildGitWorld(), { restRemaining: 1500, restLimit: 2000, restResetAt: 1700000000 });
        expect(w.resourceBudget?.restRemaining).toBe(1500);
    });
});
describe("giteaRateLimitTier", () => {
    test("tier boundaries", () => {
        expect(giteaRateLimitTier(2000)).toBe("normal");
        expect(giteaRateLimitTier(500)).toBe("cost-aware");
        expect(giteaRateLimitTier(200)).toBe("extreme-cost-aware");
        expect(giteaRateLimitTier(50)).toBe("pure-git");
    });
});
describe("canAffordGitea", () => {
    test("within budget → ok", () => {
        const w = buildGiteaWorld(buildGitWorld(), { restRemaining: 100, restLimit: 1000, restResetAt: 1700000060 });
        expect(canAffordGitea(w, 50).ok).toBe(true);
    });
    test("exceeded → ResourceBudgetExhausted", () => {
        const w = buildGiteaWorld(buildGitWorld(), { restRemaining: 10, restLimit: 1000, restResetAt: 1700000060 });
        const r = canAffordGitea(w, 50);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.feedback.kind).toBe("ResourceBudgetExhausted");
    });
    test("no budget → ok", () => {
        const w = buildGiteaWorld(buildGitWorld());
        expect(canAffordGitea(w, 1_000_000).ok).toBe(true);
    });
});
describe("reusable exports", () => {
    test("PR + review + action + verdict shapes", () => {
        expect(GITEA_PR_UNIVERSE.length).toBe(5);
        expect(GITEA_REVIEW_UNIVERSE.length).toBe(2);
        expect(GITEA_ACTION_UNIVERSE.length).toBe(5);
        expect(GITEA_REQUIRE_RESOLVED_VERDICT.kind).toBe("block");
    });
});
