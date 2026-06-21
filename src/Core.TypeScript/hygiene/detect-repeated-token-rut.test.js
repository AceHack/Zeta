import { describe, expect, test } from "bun:test";
import { DEFAULT_THRESHOLDS, detectRepeatedTokenRut, tokenize, } from "./detect-repeated-token-rut";
describe("tokenize", () => {
    test("whitespace-splits and drops empties", () => {
        expect(tokenize("  a  b\tc\n d ", false)).toEqual(["a", "b", "c", "d"]);
    });
    test("line mode trims and drops blank lines", () => {
        expect(tokenize("Holding.\n\n  Holding. \nGreen.", true)).toEqual([
            "Holding.",
            "Holding.",
            "Green.",
        ]);
    });
});
describe("detectRepeatedTokenRut — the live glitch", () => {
    test("the actual rut ('court' ×N) is flagged via RUN", () => {
        const v = detectRepeatedTokenRut("court ".repeat(12).trim());
        expect(v.isRut).toBe(true);
        expect(v.reasons).toContain("run");
        expect(v.evidence.longestRun).toBe(12);
        expect(v.evidence.longestRunToken).toBe("court");
    });
    test("repeated whole-line rut is flagged in line mode", () => {
        const text = Array(10).fill("Holding.").join("\n");
        const v = detectRepeatedTokenRut(text, { lines: true });
        expect(v.isRut).toBe(true);
        // single distinct line dominating + zero diversity
        expect(v.reasons).toContain("run");
        expect(v.reasons).toContain("dominance");
        expect(v.reasons).toContain("low-diversity");
    });
});
describe("detectRepeatedTokenRut — signatures", () => {
    test("RUN trips on exactly maxRun identical consecutive tokens", () => {
        const atThreshold = "x ".repeat(DEFAULT_THRESHOLDS.maxRun).trim();
        expect(detectRepeatedTokenRut(atThreshold).reasons).toContain("run");
        const belowThreshold = "x ".repeat(DEFAULT_THRESHOLDS.maxRun - 1).trim();
        expect(detectRepeatedTokenRut(belowThreshold).reasons).not.toContain("run");
    });
    test("DOMINANCE trips when one token dominates a long-enough stream", () => {
        // 8 tokens: 6× "spam" interleaved so no run >=5, plus 2 distinct.
        const text = "spam a spam b spam spam spam spam";
        const v = detectRepeatedTokenRut(text);
        expect(v.evidence.totalTokens).toBe(8);
        expect(v.reasons).toContain("dominance");
    });
    test("LOW-DIVERSITY trips when distinct/total is tiny", () => {
        // 10 tokens, 2 distinct → ratio 0.2 (<= 0.2 default) → low-diversity.
        const text = "a b a b a b a b a b";
        const v = detectRepeatedTokenRut(text);
        expect(v.evidence.diversityRatio).toBeCloseTo(0.2, 5);
        expect(v.reasons).toContain("low-diversity");
    });
});
describe("detectRepeatedTokenRut — does NOT false-positive", () => {
    test("normal prose is clean", () => {
        const prose = "Green and holding; the gate passed and the branch is in sync with origin main.";
        const v = detectRepeatedTokenRut(prose);
        expect(v.isRut).toBe(false);
        expect(v.reason).toBe("");
    });
    test("short legitimate repetition under minTokens is not a rut", () => {
        // "ok ok" — dominance/low-diversity gated by minTokens; run under maxRun.
        const v = detectRepeatedTokenRut("ok ok");
        expect(v.isRut).toBe(false);
    });
    test("empty input is not a rut", () => {
        const v = detectRepeatedTokenRut("");
        expect(v.isRut).toBe(false);
        expect(v.evidence.totalTokens).toBe(0);
        expect(v.evidence.diversityRatio).toBe(1);
    });
});
describe("detectRepeatedTokenRut — determinism (DST)", () => {
    test("same input + thresholds yields byte-identical verdict", () => {
        const text = "court ".repeat(7) + "green holding sync";
        const a = JSON.stringify(detectRepeatedTokenRut(text));
        const b = JSON.stringify(detectRepeatedTokenRut(text));
        expect(a).toBe(b);
    });
    test("top-token tie resolves deterministically (first-seen wins)", () => {
        // "a" and "b" both appear 5×; first-seen "a" must win, every run.
        const text = "a b a b a b a b a b";
        const v = detectRepeatedTokenRut(text);
        expect(v.evidence.topToken).toBe("a");
        expect(v.evidence.topTokenCount).toBe(5);
    });
});
