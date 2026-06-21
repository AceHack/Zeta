// Invariant tests for CodebergWorld per-host adapter (Gitea-derived).
import { describe, expect, test } from "bun:test";
import { buildGitWorld } from "./git-world.js";
import { buildCodebergWorld, CODEBERG_CONSERVATIVE_BUDGET, } from "./codeberg-world.js";
describe("CodebergWorld extends GiteaWorld + adds Codeberg-specifics", () => {
    test("inherits forgeName + base GitWorld substrate", () => {
        const w = buildCodebergWorld(buildGitWorld());
        expect(w.forgeName).toBe("git");
        expect(w.branchUniverse.length).toBe(4);
    });
    test("forgeSpecialization is codeberg (narrower than gitea)", () => {
        const w = buildCodebergWorld(buildGitWorld());
        expect(w.forgeSpecialization).toBe("codeberg");
    });
    test("inherits Gitea PR + review + action universes", () => {
        const w = buildCodebergWorld(buildGitWorld());
        expect(w.prUniverse.length).toBe(5);
        expect(w.reviewUniverse.length).toBe(2);
        expect(w.actionUniverse.length).toBe(5);
    });
    test("adds Codeberg-specific community + EU-sovereignty markers", () => {
        const w = buildCodebergWorld(buildGitWorld());
        expect(w.hostingPolicy).toBe("non-commercial-eu-sovereign");
        expect(w.communityGoverned).toBe(true);
    });
});
describe("CodebergWorld conservative budget defaults", () => {
    test("CODEBERG_CONSERVATIVE_BUDGET reflects shared community instance", () => {
        expect(CODEBERG_CONSERVATIVE_BUDGET.restLimit).toBe(500);
        expect(CODEBERG_CONSERVATIVE_BUDGET.restRemaining).toBe(300);
    });
    test("buildCodebergWorld accepts conservative budget", () => {
        const w = buildCodebergWorld(buildGitWorld(), CODEBERG_CONSERVATIVE_BUDGET);
        expect(w.resourceBudget?.restLimit).toBe(500);
    });
});
