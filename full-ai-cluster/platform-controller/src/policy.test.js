// full-ai-cluster/platform-controller/src/policy.test.ts
//
// The no-directives decision matrix: standing authority for in-bounds domains,
// proposal for gated classes (even when the domain is auto), and the hard floor.
import { describe, expect, test } from "bun:test";
import { decide, isAutonomous } from "./policy.js";
// The default Policy (mirrors policy-default.yaml).
const POLICY = {
    domains: [
        { name: "lifecycle", autonomy: "auto" },
        { name: "scaling", autonomy: "auto" },
        { name: "config", autonomy: "auto" },
        { name: "mods", autonomy: "propose" },
        { name: "spend", autonomy: "propose" },
        { name: "data", autonomy: "forbidden" },
        { name: "security", autonomy: "forbidden" },
    ],
    gatedClasses: ["budget", "non-reversible", "wont-do", "hard-limits", "force-push", "external-repo"],
};
const act = (domain, gated) => ({ domain, summary: `${domain}${gated ? `/${gated}` : ""}`, ...(gated ? { gated } : {}) });
describe("decide — domain autonomy", () => {
    test("in-bounds reversible domains run on standing authority", () => {
        for (const d of ["lifecycle", "scaling", "config"])
            expect(decide(POLICY, act(d)).level).toBe("auto");
    });
    test("side-effecting domains require a proposal", () => {
        for (const d of ["mods", "spend"])
            expect(decide(POLICY, act(d)).level).toBe("propose");
    });
    test("data + security are human-only", () => {
        for (const d of ["data", "security"])
            expect(decide(POLICY, act(d)).level).toBe("forbidden");
    });
    test("an unknown domain fails closed (least privilege)", () => {
        expect(decide(POLICY, act("teleport")).level).toBe("forbidden");
    });
});
describe("decide — gated classes escalate above auto", () => {
    test("a budget-gated scaling action becomes propose even though scaling is auto", () => {
        const d = decide(POLICY, act("scaling", "budget"));
        expect(d.level).toBe("propose");
        if (d.level === "propose")
            expect(d.gated).toBe("budget");
    });
    test("a non-reversible config action becomes propose despite config being auto", () => {
        expect(decide(POLICY, act("config", "non-reversible")).level).toBe("propose");
    });
    test("hard-floor classes (wont-do, hard-limits) are forbidden even on an auto domain", () => {
        expect(decide(POLICY, act("lifecycle", "wont-do")).level).toBe("forbidden");
        expect(decide(POLICY, act("config", "hard-limits")).level).toBe("forbidden");
    });
    test("force-push / external-repo gated actions need a human grant", () => {
        expect(decide(POLICY, act("config", "force-push")).level).toBe("propose");
        expect(decide(POLICY, act("config", "external-repo")).level).toBe("propose");
    });
});
describe("isAutonomous", () => {
    test("true only for an auto domain with no gated class", () => {
        expect(isAutonomous(POLICY, act("scaling"))).toBe(true);
        expect(isAutonomous(POLICY, act("scaling", "budget"))).toBe(false);
        expect(isAutonomous(POLICY, act("mods"))).toBe(false);
    });
});
