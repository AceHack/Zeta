// gen-ir.test.ts — generator-fidelity self-test for the IR-driven fmix64 oracle.
//
// WHY THIS EXISTS
// ---------------
// fmix64 is the THIRD "generated-from-ir" oracle: its mixer is DATA — an ordered
// list of total u-word ops carried in a real DynamicValue row (`fmix64.ir.json`,
// `width: 64`), decoded through the project's canonical-JSON decoder and folded by
// the same width-parametric interpreter that drives splitmix64 and fmix32 (see
// `gen.ts`). The N-way harness proves the EMITTED bytes byte-lock against the five
// independent hand-ports. This third primitive is the same `mul`/`xorshr`
// vocabulary at width 64 in the HASH family — proving the IR generalises beyond the
// seed pair.
//
// This test guards the layer beneath that. It proves:
//   1. the IR ROW is a CANONICAL DynamicValue (the real `fromCanonicalJson`
//      accepts it AND the fixed-point `canonicalJson(decode x) === x` holds);
//   2. the IR decoded FROM THE ROW reproduces the canonical golden vectors at
//      width 64;
//   3. CORRUPTING the IR (one constant, a dropped round, or the WIDTH) DIVERGES —
//      the generator-fidelity invariant: a green that cannot turn red when the
//      generator is wrong is a Sybil green.
//
// Run: `bun test tests/cross-verification/fmix64/_gen/gen-ir.test.ts`
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
const IR_TEXT = readFileSync(join(import.meta.dir, "fmix64.ir.json"), "utf8").trim();
function field(obj, key) {
    if (obj.t !== "obj")
        throw new Error("expected object");
    const hit = obj.v.find(([k]) => k === key);
    if (!hit)
        throw new Error(`missing field ${key}`);
    return hit[1];
}
function intOf(v) {
    if (v.t !== "int")
        throw new Error("expected int");
    return BigInt(v.v);
}
function parseIr(ir) {
    const width = intOf(field(ir, "width"));
    const opsNode = field(ir, "ops");
    if (opsNode.t !== "arr")
        throw new Error("ops must be array");
    const mask = (1n << width) - 1n;
    const ops = opsNode.v.map((node) => {
        const opNode = field(node, "op");
        if (opNode.t !== "str")
            throw new Error("op must be str");
        if (opNode.v === "mul")
            return { op: "mul", k: intOf(field(node, "k")) & mask };
        return { op: "xorshr", s: intOf(field(node, "s")) };
    });
    return { width, ops };
}
/** The same width-parametric total interpreter gen.ts uses. */
function runIr(width, ir, x) {
    const mask = (1n << width) - 1n;
    const m = (z) => z & mask;
    return ir.reduce((z, step) => {
        switch (step.op) {
            case "mul":
                return m(z * step.k);
            case "xorshr":
                return m(z ^ (z >> step.s));
        }
    }, m(x));
}
// Canonical golden values (must match vectors.yaml / the hand-ports).
const GOLDEN = {
    "0": "0",
    "1": "12994781566227106604",
    "2": "4233148493373801447",
    "10": "7233188113542599437",
    "18446744073709551615": "7256831767414464289",
};
// The fmix64 first multiplier as the u64 mask of its signed-int64 storage form.
const C1 = 0xff51afd7ed558ccdn;
test("the fmix64 IR row is a CANONICAL DynamicValue (decoder accepts it; fixed-point holds)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok)
        return;
    expect(canonicalJson(decoded.value)).toEqual({ ok: true, value: IR_TEXT });
});
test("IR decoded FROM THE ROW reproduces the canonical fmix64 golden vectors", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok)
        return;
    const { width, ops } = parseIr(decoded.value);
    expect(width).toBe(64n);
    for (const [input, expected] of Object.entries(GOLDEN)) {
        expect(runIr(width, ops, BigInt(input)).toString()).toBe(expected);
    }
});
test("a one-constant corruption of the IR diverges from the golden (fidelity bites)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    // Flip the first multiplier's low bit.
    const corrupt = ops.map((op) => op.op === "mul" && op.k === C1 ? { op: "mul", k: C1 ^ 1n } : op);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("dropping a round from the IR diverges from the golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const truncated = ops.slice(0, ops.length - 1); // drop final xor-shift
    expect(runIr(width, truncated, 1n).toString()).not.toBe(GOLDEN["1"]);
});
test("the WIDTH field is load-bearing: folding fmix64 at width 32 diverges from the u64 golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { ops } = parseIr(decoded.value);
    // Same ops, wrong width — the high bits no longer survive, so results differ.
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(32n, ops, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
