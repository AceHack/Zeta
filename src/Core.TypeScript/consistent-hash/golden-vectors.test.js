import { describe, expect, test } from "bun:test";
import { seeds, pick } from "./consistent-hash";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.
describe("Rendezvous consistent-hash golden vectors", () => {
    test("seeds agree with the seed", () => {
        const got = seeds(vectors.seeds.n).map((b) => b.toString());
        expect(got).toEqual(vectors.seeds.result);
    });
    test("pick agrees with the seed", () => {
        for (const v of vectors.pick) {
            expect(pick(v.buckets, BigInt(v.key))).toBe(v.result);
        }
    });
});
