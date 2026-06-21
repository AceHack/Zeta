/**
 * src/Core.TypeScript/zflash/test-harness/scenarios.test.ts
 *
 * B-0891 PoC — invariant tests for scenario definitions.
 *
 * Run via: bun test src/Core.TypeScript/zflash/test-harness/
 */
import { describe, expect, it } from "bun:test";
import { SCENARIOS, computeRunnableSet, determineRunnability, findScenario, validateScenarios, } from "./scenarios";
describe("B-0891 scenarios.ts invariants", () => {
    it("has exactly 5 scenarios per operator-named matrix", () => {
        expect(SCENARIOS.length).toBe(5);
    });
    it("validates without throwing", () => {
        expect(() => validateScenarios(SCENARIOS)).not.toThrow();
    });
    it("orderIndex values are 1..5", () => {
        const orders = SCENARIOS.map((s) => s.orderIndex).sort();
        expect(orders).toEqual([1, 2, 3, 4, 5]);
    });
    it("ids are unique", () => {
        const ids = new Set(SCENARIOS.map((s) => s.id));
        expect(ids.size).toBe(SCENARIOS.length);
    });
    it("findScenario returns correct entry", () => {
        expect(findScenario("initial-format")?.orderIndex).toBe(1);
        expect(findScenario("boot-cluster-up")?.orderIndex).toBe(2);
        expect(findScenario("reformat-with-retention")?.orderIndex).toBe(3);
        expect(findScenario("reformat-from-scratch")?.orderIndex).toBe(4);
        expect(findScenario("cluster-joining")?.orderIndex).toBe(5);
    });
    it("findScenario returns undefined for unknown id", () => {
        expect(findScenario("nonexistent")).toBeUndefined();
    });
    it("gates only reference defined ids", () => {
        const ids = new Set(SCENARIOS.map((s) => s.id));
        for (const s of SCENARIOS) {
            for (const gate of s.gates) {
                expect(ids.has(gate)).toBe(true);
            }
        }
    });
    it("composes-with-existing scenarios cite src/Core.TypeScript/ci/ paths", () => {
        const composers = SCENARIOS.filter((s) => s.status === "composes-with-existing");
        expect(composers.length).toBeGreaterThan(0);
        for (const s of composers) {
            const hasCiHarness = s.composesWith.some((dep) => dep.startsWith("src/Core.TypeScript/ci/"));
            expect(hasCiHarness).toBe(true);
        }
    });
    it("all scenarios have non-empty acceptanceCriteria", () => {
        for (const s of SCENARIOS) {
            expect(s.acceptanceCriteria.length).toBeGreaterThan(0);
        }
    });
    it("keeps Kubernetes and ArgoCD health outside USB/ISO runtime scope", () => {
        const s = findScenario("boot-cluster-up");
        if (!s)
            throw new Error("scenario missing");
        expect(s.acceptanceCriteria.join(" ")).toContain("Kubernetes and ArgoCD health");
        expect(s.notes).toContain("orthogonal integration lane");
    });
    it("distinguishes retained identity from no-retention reformat identity", () => {
        const retained = findScenario("reformat-with-retention");
        const fresh = findScenario("reformat-from-scratch");
        if (!retained || !fresh)
            throw new Error("scenario missing");
        expect(retained.acceptanceCriteria.join(" ")).toContain("same cluster/node identity");
        expect(fresh.acceptanceCriteria.join(" ")).toContain("new cluster/node identity");
    });
    it("validateScenarios catches duplicate id", () => {
        const first = SCENARIOS[0];
        if (!first)
            throw new Error("SCENARIOS unexpectedly empty");
        const dup = [...SCENARIOS, { ...first }];
        expect(() => validateScenarios(dup)).toThrow();
    });
    it("validateScenarios catches wrong count", () => {
        const short = SCENARIOS.slice(0, 4);
        expect(() => validateScenarios(short)).toThrow();
    });
    it("validateScenarios catches unknown gate reference", () => {
        const broken = SCENARIOS.map((s, i) => (i === 0 ? { ...s, gates: ["nonexistent"] } : s));
        expect(() => validateScenarios(broken)).toThrow();
    });
});
describe("B-0891 determineRunnability discriminator", () => {
    // Substantive zflash-lane work per Aaron's 3-lane substrate-check
    // (Amara ferry §33.2 PR #5757) + standing PoC permission.
    // Structurally parallel to:
    //   - PR #5758 workflow-engine determineReviewLevel (workflow scope)
    //   - PR #5760 better-git-crypt determineEncryptionPath (encryption scope)
    // Same substrate-engineering substrate (Result-shaped discriminator)
    // operating at zflash-substrate scope.
    it("initial-format → can-run-now (composes with existing qemu-boot-test substrate)", () => {
        const s = findScenario("initial-format");
        if (!s)
            throw new Error("scenario missing");
        const verdict = determineRunnability(s, new Set());
        expect(verdict.kind).toBe("can-run-now");
        if (verdict.kind === "can-run-now") {
            expect(verdict.harnessEntry).toMatch(/qemu-boot-test/);
        }
    });
    it("boot-cluster-up → can-run-now (composes with qemu-full-install-test)", () => {
        const s = findScenario("boot-cluster-up");
        if (!s)
            throw new Error("scenario missing");
        const verdict = determineRunnability(s, new Set());
        expect(verdict.kind).toBe("can-run-now");
        if (verdict.kind === "can-run-now") {
            expect(verdict.harnessEntry).toMatch(/qemu-full-install-test/);
        }
    });
    it("reformat-with-retention → blocked-on-state-preservation", () => {
        const s = findScenario("reformat-with-retention");
        if (!s)
            throw new Error("scenario missing");
        const verdict = determineRunnability(s, new Set());
        expect(verdict.kind).toBe("blocked-on-state-preservation");
        if (verdict.kind === "blocked-on-state-preservation") {
            expect(verdict.required).toBe("persisted-kv");
        }
    });
    it("reformat-from-scratch → blocked-on-test-harness-path-fork", () => {
        const s = findScenario("reformat-from-scratch");
        if (!s)
            throw new Error("scenario missing");
        const verdict = determineRunnability(s, new Set());
        expect(verdict.kind).toBe("blocked-on-test-harness-path-fork");
    });
    it("cluster-joining → blocked-on-multi-vm-orchestration", () => {
        const s = findScenario("cluster-joining");
        if (!s)
            throw new Error("scenario missing");
        const verdict = determineRunnability(s, new Set());
        expect(verdict.kind).toBe("blocked-on-multi-vm-orchestration");
    });
    it("all scenarios resolve to a valid RunnabilityVerdict (exhaustiveness)", () => {
        // Acknowledger forces exhaustive switch — TS strict mode raises
        // "not all code paths return" at compile time if a NEW
        // RunnabilityVerdict variant is added without updating this switch.
        const acknowledge = (v) => {
            switch (v.kind) {
                case "can-run-now":
                case "blocked-on-upstream-gate":
                case "blocked-on-state-preservation":
                case "blocked-on-multi-vm-orchestration":
                case "blocked-on-test-harness-path-fork":
                case "requires-physical-usb":
                    return v.kind;
            }
        };
        for (const s of SCENARIOS) {
            const verdict = determineRunnability(s, new Set());
            expect(acknowledge(verdict)).toBe(verdict.kind);
        }
    });
    it("computeRunnableSet identifies composes-with-existing scenarios", () => {
        const runnable = computeRunnableSet();
        expect(runnable.has("initial-format")).toBe(true);
        expect(runnable.has("boot-cluster-up")).toBe(true);
        expect(runnable.has("reformat-with-retention")).toBe(false);
        expect(runnable.has("reformat-from-scratch")).toBe(false);
        expect(runnable.has("cluster-joining")).toBe(false);
    });
    it("computeRunnableSet count matches composes-with-existing scenario count", () => {
        const composesCount = SCENARIOS.filter((s) => s.status === "composes-with-existing").length;
        const runnable = computeRunnableSet();
        expect(runnable.size).toBe(composesCount);
    });
});
