import { describe, expect, test } from "bun:test";
import { quorumThreshold, decide } from "./consensus";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.
describe("BFT consensus golden vectors", () => {
    test("quorumThreshold agrees with the seed", () => {
        for (const v of vectors.quorumThreshold) {
            expect(quorumThreshold(v.n)).toBe(v.result);
        }
    });
    test("decide agrees with the seed", () => {
        for (const v of vectors.decide) {
            expect(decide(v.votes)).toEqual(v.result);
        }
    });
});
