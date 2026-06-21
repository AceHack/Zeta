// gen-ir.test.ts — generator-fidelity self-test for the IR-driven lcg32_numerical_recipes oracle.
//
// lcg32_numerical_recipes is the second "generated-from-ir" oracle to use the `add` op,
// proving the v4 grammar generalizes.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
const IR_TEXT = readFileSync(join(import.meta.dir, "lcg32_numerical_recipes.ir.json"), "utf8").trim();
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
function intListOf(v) {
    if (v.t !== "arr")
        throw new Error("expected array");
    return v.v.map(intOf);
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
        switch (opNode.v) {
            case "mul":
                return { op: "mul", k: intOf(field(node, "k")) & mask };
            case "rotl":
                return { op: "rotl", r: intOf(field(node, "r")) };
            case "xrotxor":
                return { op: "xrotxor", rs: intListOf(field(node, "rs")) };
            case "xshrxor":
                return { op: "xshrxor", ss: intListOf(field(node, "ss")) };
            case "add":
                return { op: "add", k: intOf(field(node, "k")) & mask };
            default:
                return { op: "xorshr", s: intOf(field(node, "s")) };
        }
    });
    return { width, ops };
}
function runIr(width, ir, x) {
    const mask = (1n << width) - 1n;
    const m = (z) => z & mask;
    const rotl = (z, r) => {
        const k = ((r % width) + width) % width;
        return k === 0n ? m(z) : m((z << k) | (z >> (width - k)));
    };
    return ir.reduce((z, step) => {
        switch (step.op) {
            case "mul":
                return m(z * step.k);
            case "xorshr":
                return m(z ^ (z >> step.s));
            case "rotl":
                return rotl(z, step.r);
            case "xrotxor":
                return m(step.rs.reduce((acc, r) => acc ^ rotl(z, r), z));
            case "xshrxor":
                return m(step.ss.reduce((acc, s) => acc ^ (z >> s), z));
            case "add":
                return m(z + step.k);
        }
    }, m(x));
}
const GOLDEN = {
    "0": "1013904223",
    "1": "1015568748",
    "2": "1017233273",
    "10": "1030549473",
    "255": "1438358098",
    "4294967295": "1012239698",
    "2654435769": "1120982980",
    "2147483648": "3161387871",
    "1234567890": "78562313",
    "1000000000": "2848404831",
};
test("the lcg32_numerical_recipes IR row is a CANONICAL DynamicValue (decoder accepts it; fixed-point holds)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok)
        return;
    expect(canonicalJson(decoded.value)).toEqual({ ok: true, value: IR_TEXT });
});
test("the IR row carries the zeta-ir-v4 schema tag", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const schema = field(decoded.value, "schema");
    expect(schema.t === "str" && schema.v).toBe("zeta-ir-v4");
});
test("IR decoded FROM THE ROW reproduces the canonical golden vectors", () => {
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
test("a one-constant corruption of the multiplier diverges from the golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const corrupt = ops.map((op) => op.op === "mul" ? { op: "mul", k: (op.k ^ 1n) & ((1n << width) - 1n) } : op);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("a one-constant corruption of the addend diverges from the golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const corrupt = ops.map((op) => op.op === "add" ? { op: "add", k: (op.k ^ 1n) & ((1n << width) - 1n) } : op);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("the WIDTH field is load-bearing: folding at width 64 diverges from the u32 golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { ops } = parseIr(decoded.value);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (runIr(64n, ops, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
