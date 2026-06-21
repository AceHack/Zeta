import { describe, expect, test } from "bun:test";
import { observe, isLate, combine, Watermark, Timestamped, WatermarkTracker } from "./watermark";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.
describe("Watermark golden vectors", () => {
    test("observe agrees with the seed", () => {
        for (const v of vectors.observe) {
            expect(observe(v.strategy, v.lateness, v.events)).toEqual(v.result);
        }
    });
    test("isLate agrees with the seed", () => {
        for (const v of vectors.isLate) {
            expect(isLate(v.wm, v.eventTime)).toBe(v.result);
        }
    });
    test("combine agrees with the seed", () => {
        for (const v of vectors.combine) {
            expect(combine(v.sources)).toBe(v.result);
        }
    });
});
describe("WatermarkTracker stateful verification", () => {
    test("WatermarkTracker monotonic never decreases", () => {
        const t = new WatermarkTracker({ type: "monotonic" });
        expect(t.Observe(100)).toBe(100);
        expect(t.Observe(50)).toBe(100); // no regression
        expect(t.Observe(200)).toBe(200);
        expect(t.Current).toBe(200);
        expect(t.MaxObserved).toBe(200);
    });
    test("WatermarkTracker bounded-lateness subtracts allowance", () => {
        const t = new WatermarkTracker({ type: "bounded", maxLatenessMs: 10 });
        expect(t.Observe(100)).toBe(90);
        expect(t.Current).toBe(90);
        expect(t.MaxObserved).toBe(100);
    });
    test("WatermarkStrategy.Periodic subtracts lateness", () => {
        const t = new WatermarkTracker({ type: "periodic", intervalMs: 1000, latenessMs: 50 });
        expect(t.Observe(1000)).toBe(950);
        expect(t.Current).toBe(950);
        expect(t.MaxObserved).toBe(1000);
    });
    test("Watermark structure holds fields", () => {
        const wm = new Watermark(123, 2);
        expect(wm.EventTime).toBe(123);
        expect(wm.Source).toBe(2);
        expect(Watermark.MinValue.EventTime).toBe(Number.MIN_SAFE_INTEGER);
    });
    test("Timestamped holds value and eventTime", () => {
        const ts = new Timestamped("test-val", 456);
        expect(ts.Value).toBe("test-val");
        expect(ts.EventTime).toBe(456);
    });
});
