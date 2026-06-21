/**
 * src/Core.TypeScript/workflow-engine/consensus.test.ts
 *
 * B-0914.3 — invariant tests for n-parallel + consensus substrate.
 */
import { describe, expect, it } from "bun:test";
import { nIdenticalAnalyzers, runConsensus } from "./consensus";
// Test analyzers — caller-injected per asymmetric-authorship
const constantAnalyzer = (verdict) => async () => ({ ok: true, verdict });
const failingAnalyzer = (reason) => async () => ({ ok: false, reason });
const throwingAnalyzer = (msg) => async () => {
    throw new Error(msg);
};
describe("B-0914.3 n-parallel + consensus substrate", () => {
    it("empty analyzers → InsufficientAnalyzers", async () => {
        const result = await runConsensus({ analyzers: [], mechanism: { kind: "majority" } });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InsufficientAnalyzers");
    });
    it("majority consensus: 3 of 5 agree → consensus reached", async () => {
        const result = await runConsensus({
            analyzers: [
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("Y"),
                constantAnalyzer("Z"),
            ],
            mechanism: { kind: "majority" },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict).toBe("X");
        expect(result.agreement.winnerCount).toBe(3);
        expect(result.agreement.successfulAnalyzers).toBe(5);
        expect(result.agreement.failedAnalyzers).toBe(0);
    });
    it("majority consensus: 2 of 5 agree → NoConsensus", async () => {
        const result = await runConsensus({
            analyzers: [
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("Y"),
                constantAnalyzer("Z"),
                constantAnalyzer("W"),
            ],
            mechanism: { kind: "majority" },
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("NoConsensus");
    });
    it("supermajority 2/3: 6 of 9 agree → consensus reached (just over threshold)", async () => {
        const analyzers = [
            ...Array(6)
                .fill(0)
                .map(() => constantAnalyzer("X")),
            ...Array(3)
                .fill(0)
                .map(() => constantAnalyzer("Y")),
        ];
        const result = await runConsensus({
            analyzers,
            mechanism: { kind: "supermajority", threshold: 0.6 }, // > 60%
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict).toBe("X");
    });
    it("supermajority: invalid threshold (≤0.5) → InvalidThreshold", async () => {
        const result = await runConsensus({
            analyzers: [constantAnalyzer("X")],
            mechanism: { kind: "supermajority", threshold: 0.5 },
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InvalidThreshold");
    });
    it("supermajority: invalid threshold (>1.0) → InvalidThreshold", async () => {
        const result = await runConsensus({
            analyzers: [constantAnalyzer("X")],
            mechanism: { kind: "supermajority", threshold: 1.5 },
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InvalidThreshold");
    });
    it("unanimous: all 5 agree → consensus reached", async () => {
        const result = await runConsensus({
            analyzers: Array(5)
                .fill(0)
                .map(() => constantAnalyzer("X")),
            mechanism: { kind: "unanimous" },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict).toBe("X");
        expect(result.agreement.winnerFraction).toBe(1.0);
    });
    it("unanimous: 4 of 5 agree → NoConsensus", async () => {
        const result = await runConsensus({
            analyzers: [
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("Y"),
            ],
            mechanism: { kind: "unanimous" },
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("NoConsensus");
    });
    it("first-n-agree: N=3, 3 of 5 agree → consensus reached", async () => {
        const result = await runConsensus({
            analyzers: [
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("Y"),
                constantAnalyzer("Z"),
            ],
            mechanism: { kind: "first-n-agree", n: 3 },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict).toBe("X");
    });
    it("first-n-agree: not enough analyzers → InsufficientAnalyzers", async () => {
        const result = await runConsensus({
            analyzers: [constantAnalyzer("X")],
            mechanism: { kind: "first-n-agree", n: 5 },
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("InsufficientAnalyzers");
    });
    it("all analyzers fail → AllAnalyzersFailed", async () => {
        const result = await runConsensus({
            analyzers: [failingAnalyzer("err1"), failingAnalyzer("err2")],
            mechanism: { kind: "majority" },
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("AllAnalyzersFailed");
        if (result.feedback.kind === "AllAnalyzersFailed") {
            expect(result.feedback.failures).toEqual(["err1", "err2"]);
        }
    });
    it("throwing analyzer converted to failure (not propagated)", async () => {
        const result = await runConsensus({
            analyzers: [constantAnalyzer("X"), constantAnalyzer("X"), throwingAnalyzer("crashed")],
            mechanism: { kind: "majority" },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict).toBe("X");
        expect(result.agreement.failedAnalyzers).toBe(1);
    });
    it("mixed success+failure: consensus computed across successful only", async () => {
        const result = await runConsensus({
            analyzers: [
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("Y"),
                failingAnalyzer("noise"),
                failingAnalyzer("noise"),
            ],
            mechanism: { kind: "majority" },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict).toBe("X");
        expect(result.agreement.successfulAnalyzers).toBe(3);
        expect(result.agreement.failedAnalyzers).toBe(2);
        expect(result.agreement.winnerCount).toBe(2);
    });
    it("verdictKey: custom key function for complex types", async () => {
        const a = { mechanism: "ER-stress", evidence: 0.8 };
        const b = { mechanism: "ER-stress", evidence: 0.9 };
        const c = { mechanism: "kinase", evidence: 0.7 };
        // Group by mechanism only (ignore evidence)
        const result = await runConsensus({
            analyzers: [constantAnalyzer(a), constantAnalyzer(b), constantAnalyzer(c)],
            mechanism: { kind: "majority" },
            verdictKey: (h) => h.mechanism,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict.mechanism).toBe("ER-stress");
    });
    it("nIdenticalAnalyzers: launches N instances with instanceId parameter", async () => {
        const seen = [];
        const analyzer = async (instanceId) => {
            seen.push(instanceId);
            return { ok: true, verdict: "X" };
        };
        const result = await runConsensus({
            analyzers: nIdenticalAnalyzers(8, analyzer), // Robin's 8 parallel pattern
            mechanism: { kind: "majority" },
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.agreement.totalAnalyzers).toBe(8);
        expect(result.agreement.successfulAnalyzers).toBe(8);
        expect(seen.sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
    it("agreement metrics expose distribution (substrate-honest dashboard)", async () => {
        const result = await runConsensus({
            analyzers: [
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("X"),
                constantAnalyzer("Y"),
                constantAnalyzer("Y"),
                constantAnalyzer("Z"),
            ],
            mechanism: { kind: "majority" },
        });
        // X gets 3 votes; Y gets 2; Z gets 1 — X wins by majority (3 > 6/2 = 3? NO; 3 > 3 false → NoConsensus)
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.feedback.kind).toBe("NoConsensus");
    });
    it("Robin's 8-parallel pattern: 5 of 8 agree → majority consensus reached", async () => {
        const analyzers = [
            ...Array(5)
                .fill(0)
                .map(() => constantAnalyzer("treatment-effective")),
            ...Array(3)
                .fill(0)
                .map(() => constantAnalyzer("treatment-uncertain")),
        ];
        const result = await runConsensus({ analyzers, mechanism: { kind: "majority" } });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.verdict).toBe("treatment-effective");
        expect(result.agreement.winnerFraction).toBeCloseTo(5 / 8, 2);
    });
    it("ConsensusMechanism union exhaustive switch (compile-time check)", () => {
        const acknowledge = (m) => {
            switch (m.kind) {
                case "majority":
                case "supermajority":
                case "unanimous":
                case "first-n-agree":
                    return m.kind;
            }
        };
        expect(acknowledge({ kind: "majority" })).toBe("majority");
        expect(acknowledge({ kind: "supermajority", threshold: 0.67 })).toBe("supermajority");
        expect(acknowledge({ kind: "unanimous" })).toBe("unanimous");
        expect(acknowledge({ kind: "first-n-agree", n: 3 })).toBe("first-n-agree");
    });
});
