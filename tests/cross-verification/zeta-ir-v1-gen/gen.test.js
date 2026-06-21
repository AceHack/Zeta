// gen.test.ts — fidelity for the zeta-ir-v1-gen Phase-B oracle.
//
// Pins that the value-preservation green can turn RED: any mutation of the frozen v1 IR
// (a constant, the declared width, or the op sequence) makes the folded output diverge
// from the committed legacy golden. If these never failed, the byte-lock would be
// decorative. Runs in the bun test sweep.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emit, SPLITMIX64, FMIX32 } from "./_gen/gen.js";
const DIR = import.meta.dir;
const CV = join(DIR, "..");
function values(vec) {
    const { _source, ...rest } = vec;
    void _source;
    return rest;
}
function golden(primitive) {
    return values(JSON.parse(readFileSync(join(CV, primitive, "ts-output.json"), "utf8")));
}
function sameAsGolden(spec) {
    const got = values(emit(spec));
    const want = golden(spec.goldenPrimitive);
    const keys = new Set([...Object.keys(got), ...Object.keys(want)]);
    for (const k of keys)
        if (got[k] !== want[k])
            return false;
    return true;
}
test("v1 fold reproduces the legacy golden for both generators", () => {
    expect(sameAsGolden(SPLITMIX64)).toBe(true);
    expect(sameAsGolden(FMIX32)).toBe(true);
});
test("corrupting one mul constant diverges from the golden", () => {
    const corrupted = {
        ...SPLITMIX64,
        ops: SPLITMIX64.ops.map((o, i) => (i === 0 && o.op === "mul" ? { op: "mul", k: o.k + 1n } : o)),
    };
    expect(sameAsGolden(corrupted)).toBe(false);
});
test("changing the declared width is load-bearing (splitmix64 at width 63 diverges)", () => {
    // splitmix64's legacy row had NO width; v1 supplies width:64 as DATA. Prove the
    // width genuinely drives the fold: width 63 must change the output.
    const narrowed = { ...SPLITMIX64, width: 63 };
    expect(sameAsGolden(narrowed)).toBe(false);
});
test("dropping the last op diverges from the golden", () => {
    const truncated = { ...FMIX32, ops: FMIX32.ops.slice(0, -1) };
    expect(sameAsGolden(truncated)).toBe(false);
});
test("reordering two ops diverges from the golden", () => {
    // swap the first two fmix32 ops (xorshr 16, then mul) — order is load-bearing.
    const [first, second, ...rest] = FMIX32.ops;
    if (first === undefined || second === undefined)
        throw new Error("fmix32 needs >= 2 ops");
    const reordered = { ...FMIX32, ops: [second, first, ...rest] };
    expect(sameAsGolden(reordered)).toBe(false);
});
