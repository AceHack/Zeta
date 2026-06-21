import { describe, expect, test } from "bun:test";
import { gearTable, genBytes, chunkLengths } from "./fastcdc";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.
describe("FastCDC golden vectors", () => {
    test("gear table samples agree", () => {
        const t = gearTable();
        for (const v of vectors.gearSamples) {
            expect(t[v.i].toString()).toBe(v.value);
        }
    });
    test("chunk lengths agree", () => {
        for (const v of vectors.chunk) {
            expect(chunkLengths(genBytes(v.count), v.min, v.avg, v.max)).toEqual(v.lengths);
        }
    });
});
