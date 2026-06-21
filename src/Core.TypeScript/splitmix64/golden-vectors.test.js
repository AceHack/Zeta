import { describe, expect, test } from "bun:test";
import { mix } from "./splitmix64";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.
// uint64 is carried as decimal strings -> BigInt for exactness.
describe("SplitMix64 golden vectors", () => {
    test("mix agrees with the seed", () => {
        for (const v of vectors.mix) {
            expect(mix(BigInt(v.x)).toString()).toBe(v.result);
        }
    });
});
