// Invariant tests for SourcehutWorld per-host adapter.
import { describe, expect, test } from "bun:test";
import { buildGitWorld } from "./git-world.js";
import { buildSourcehutWorld, canAffordSrhtBuild, srhtRateLimitTier, SRHT_PATCH_UNIVERSE, SRHT_BUILD_UNIVERSE, SRHT_MANUAL_APPLY_VERDICT, } from "./sourcehut-world.js";
describe("SourcehutWorld constructor + inheritance", () => {
    test("buildSourcehutWorld extends GitWorld base", () => {
        const w = buildSourcehutWorld(buildGitWorld());
        expect(w.forgeName).toBe("git");
        expect(w.forgeSpecialization).toBe("sourcehut");
        expect(w.branchUniverse.length).toBe(4);
    });
    test("populates email-patch + list-thread + build + ticket universes", () => {
        const w = buildSourcehutWorld(buildGitWorld());
        expect(w.patchUniverse.length).toBe(7); // email-patches DU
        expect(w.listThreadUniverse.length).toBe(5); // mailing-list threads
        expect(w.buildUniverse.length).toBe(7); // builds.sr.ht
        expect(w.ticketUniverse.length).toBe(5); // todo.sr.ht
    });
});
describe("EmailPatchLifetime — qualitatively different from PR/MR", () => {
    test("includes Sourcehut-specific 'sent' + 'applied' + 'abandoned' variants", () => {
        const kinds = SRHT_PATCH_UNIVERSE.map(p => p.kind);
        expect(kinds).toContain("sent"); // patch sent to list
        expect(kinds).toContain("under-review"); // replies in thread
        expect(kinds).toContain("applied"); // maintainer applied locally
        expect(kinds).toContain("abandoned"); // faded; no activity
    });
    test("does NOT include PR-specific 'closed' or 'draft' variants", () => {
        const kinds = SRHT_PATCH_UNIVERSE.map(p => p.kind);
        expect(kinds).not.toContain("closed");
        expect(kinds).not.toContain("draft");
    });
});
describe("srhtRateLimitTier", () => {
    test("normal when buildJobsRemaining > 0", () => {
        expect(srhtRateLimitTier(5)).toBe("normal");
    });
    test("constrained when buildJobsRemaining == 0", () => {
        expect(srhtRateLimitTier(0)).toBe("constrained");
    });
});
describe("canAffordSrhtBuild", () => {
    test("within build-slot budget → ok", () => {
        const w = buildSourcehutWorld(buildGitWorld(), { buildJobsRemaining: 4, buildJobsLimit: 4, listSendsPerHour: 50 });
        expect(canAffordSrhtBuild(w, 2).ok).toBe(true);
    });
    test("build slots exhausted → BuildSlotsExhausted", () => {
        const w = buildSourcehutWorld(buildGitWorld(), { buildJobsRemaining: 1, buildJobsLimit: 4, listSendsPerHour: 50 });
        const r = canAffordSrhtBuild(w, 3);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.feedback.kind).toBe("BuildSlotsExhausted");
            if (r.feedback.kind === "BuildSlotsExhausted") {
                expect(r.feedback.required).toBe(3);
                expect(r.feedback.available).toBe(1);
            }
        }
    });
});
describe("Manual-apply discipline (Sourcehut workflow expectation)", () => {
    test("SRHT_MANUAL_APPLY_VERDICT captures the email-patches manual-apply discipline", () => {
        expect(SRHT_MANUAL_APPLY_VERDICT.kind).toBe("block");
        if (SRHT_MANUAL_APPLY_VERDICT.kind === "block") {
            expect(SRHT_MANUAL_APPLY_VERDICT.reason).toContain("email-patches");
            expect(SRHT_MANUAL_APPLY_VERDICT.reason).toContain("manual");
        }
    });
});
describe("Builds.sr.ht state machine", () => {
    test("8 build states including Sourcehut-specific timeout variant", () => {
        expect(SRHT_BUILD_UNIVERSE.length).toBe(7); // pending/queued/running/success/failed/timeout/cancelled
        const kinds = SRHT_BUILD_UNIVERSE.map(b => b.kind);
        expect(kinds).toContain("timeout"); // Sourcehut explicit timeout state
    });
});
