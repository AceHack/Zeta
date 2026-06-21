import { describe, expect, test } from "bun:test";
import { compareHlc, send, receive, definitelyBefore, uncertain } from "./uncertain-clock";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.
describe("UncertainClock golden vectors", () => {
    test("compareHlc agrees with the seed", () => {
        for (const v of vectors.compareHlc) {
            expect(compareHlc(v.a, v.b)).toBe(v.result);
        }
    });
    test("send agrees with the seed", () => {
        for (const v of vectors.send) {
            expect(send(v.clock, v.now)).toEqual(v.result);
        }
    });
    test("receive agrees with the seed", () => {
        for (const v of vectors.receive) {
            expect(receive(v.clock, v.msg, v.now)).toEqual(v.result);
        }
    });
    test("definitelyBefore agrees with the seed", () => {
        for (const v of vectors.definitelyBefore) {
            expect(definitelyBefore(v.a.physical, v.a.eps, v.b.physical, v.b.eps)).toBe(v.result);
        }
    });
    test("uncertain agrees with the seed", () => {
        for (const v of vectors.uncertain) {
            expect(uncertain(v.a.physical, v.a.eps, v.b.physical, v.b.eps)).toBe(v.result);
        }
    });
});
