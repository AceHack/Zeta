import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { resolve, observeResolve } from "./soft-value";
// SoftValue TS oracle replay — reads the SAME seed the F#/C#/Rust oracles verify and asserts identical
// decisions (resolve / observe-then-resolve). The float confidence/entropy values are NOT cross-verified
// (floats don't byte-lock); only the exact decision behavior is.
const seed = seedJson;
test("TS SoftValue agrees with the shared golden seed (decisions)", () => {
    for (const v of seed.resolve)
        expect(resolve(v.candidates, v.num, v.den)).toBe(v.result);
    for (const v of seed.observeResolve) {
        expect(observeResolve(v.prior, v.likelihood, v.num, v.den)).toBe(v.result);
    }
});
