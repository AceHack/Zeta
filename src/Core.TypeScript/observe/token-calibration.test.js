import { test, expect } from "bun:test";
import { estimateTokens, fitRatio } from "./token-calibration";
// B-1016 bytes→tokens calibration — the MATH is exact and tested; the ratio
// constant is empirical (flagged uncalibrated until --fit with a real tokenizer).
test("estimateTokens is exact division by the ratio", () => {
    expect(estimateTokens(380, 3.8)).toBe(100);
    expect(estimateTokens(0, 3.8)).toBe(0);
});
test("estimateTokens is monotone non-decreasing in bytes", () => {
    expect(estimateTokens(100, 3.8)).toBeLessThan(estimateTokens(200, 3.8));
});
test("fitRatio recovers a known ratio exactly (clean samples)", () => {
    // construct samples with an exact 4.0 bytes/token relationship
    const samples = [
        { name: "a", bytes: 400, observedTokens: 100 },
        { name: "b", bytes: 800, observedTokens: 200 },
        { name: "c", bytes: 40, observedTokens: 10 },
    ];
    const fit = fitRatio(samples);
    expect(fit.bytesPerToken).toBeCloseTo(4.0, 12);
    expect(fit.sampleCount).toBe(3);
    expect(fit.meanAbsPctError).toBeCloseTo(0, 12);
});
test("fitRatio reports nonzero error on noisy samples", () => {
    const samples = [
        { name: "a", bytes: 400, observedTokens: 100 }, // 4.0
        { name: "b", bytes: 600, observedTokens: 100 }, // 6.0
    ];
    const fit = fitRatio(samples);
    expect(fit.bytesPerToken).toBeCloseTo(5.0, 12); // (400+600)/(100+100)
    expect(fit.meanAbsPctError).toBeGreaterThan(0);
});
test("fitRatio rejects empty or token-less samples", () => {
    expect(() => fitRatio([])).toThrow();
    expect(() => fitRatio([{ name: "x", bytes: 10, observedTokens: 0 }])).toThrow();
});
