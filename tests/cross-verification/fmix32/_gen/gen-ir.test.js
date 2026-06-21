// gen-ir.test.ts — generator-fidelity self-test for the IR-driven fmix32 oracle.
//
// WHY THIS EXISTS
// ---------------
// fmix32 is the SECOND "generated-from-ir" oracle: its mixer is DATA — an ordered
// list of total u-word ops carried in a real DynamicValue row (`fmix32.ir.json`,
// `width: 32`), decoded through the project's canonical-JSON decoder and folded by
// the same width-parametric interpreter that drives splitmix64 (see `gen.ts`). The
// N-way harness proves the EMITTED bytes byte-lock against the five independent
// hand-ports.
//
// This test guards the layer beneath that. It proves:
//   1. the IR ROW is a CANONICAL DynamicValue (the real `fromCanonicalJson`
//      accepts it AND the fixed-point `canonicalJson(decode x) === x` holds);
//   2. the IR decoded FROM THE ROW reproduces the canonical golden vectors at
//      width 32;
//   3. CORRUPTING the IR (one constant, a dropped round, or the WIDTH) DIVERGES —
//      the generator-fidelity invariant: a green that cannot turn red when the
//      generator is wrong is a Sybil green. The width case is unique to this
//      second primitive and proves the width field is load-bearing.
//
// Run: `bun test tests/cross-verification/fmix32/_gen/gen-ir.test.ts`
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
const IR_TEXT = readFileSync(join(import.meta.dir, "fmix32.ir.json"), "utf8").trim();
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
    "1": "1364076727",
    "2": "821347078",
    "10": "3911517328",
    "4294967295": "2180083513",
};
test("the fmix32 IR row is a CANONICAL DynamicValue (decoder accepts it; fixed-point holds)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok)
        return;
    expect(canonicalJson(decoded.value)).toEqual({ ok: true, value: IR_TEXT });
});
test("IR decoded FROM THE ROW reproduces the canonical fmix32 golden vectors", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok)
        return;
    const { width, ops } = parseIr(decoded.value);
    expect(width).toBe(32n);
    for (const [input, expected] of Object.entries(GOLDEN)) {
        expect(runIr(width, ops, BigInt(input)).toString()).toBe(expected);
    }
});
test("a one-constant corruption of the IR diverges from the golden (fidelity bites)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    // Flip the first multiplier's low bit (0x85ebca6b -> 0x85ebca6a).
    const corrupt = ops.map((op) => op.op === "mul" && op.k === 0x85ebca6bn ? { op: "mul", k: 0x85ebca6an } : op);
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
test("the WIDTH field is load-bearing: folding fmix32 at width 64 diverges from the u32 golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { ops } = parseIr(decoded.value);
    // Same ops, wrong width — the high bits no longer wrap, so results differ.
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(64n, ops, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
