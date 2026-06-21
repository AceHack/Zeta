// gen-ir.test.ts — generator-fidelity self-test for the IR-driven xoshiro256ss oracle.
//
// WHY THIS EXISTS
// ---------------
// xoshiro256ss is the FOURTH "generated-from-ir" oracle, and the FIRST that needs an
// op OUTSIDE the v1 `mul`/`xorshr` vocabulary: the xoshiro256** output scrambler is
// `rotl(x * 5, 7) * 9` — i.e. `mul 5 · rotl 7 · mul 9` at width 64. `rotl` (rotate-left
// by a constant) is a GENUINELY NEW op: rotate wraps the top bits back to the bottom,
// which neither `mul` (carries only propagate upward) nor `xorshr` (bits move only
// downward) can reproduce. Because it BREAKS the v1 grammar, this generator's IR ships
// under a NEW frozen schema tag, `zeta-ir-v2` (see src/Core/ZetaIrV2.fs and the
// v1↔v2 firewall tests). Its row is `xoshiro256ss.ir.json`.
//
// The N-way harness proves the EMITTED bytes byte-lock against the five independent
// hand-ports (gen.fsx/csx/go/py/rs). This test guards the layer beneath that:
//   1. the IR ROW is a CANONICAL DynamicValue (the real `fromCanonicalJson` accepts it
//      AND the fixed-point `canonicalJson(decode x) === x` holds);
//   2. the IR decoded FROM THE ROW reproduces the canonical golden vectors at width 64;
//   3. CORRUPTING the IR (a multiplier, the ROTATE AMOUNT, a dropped op, or the WIDTH)
//      DIVERGES — a green that cannot turn red when the generator is wrong is a Sybil green.
//
// Run: `bun test tests/cross-verification/xoshiro256ss/_gen/gen-ir.test.ts`
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
const IR_TEXT = readFileSync(join(import.meta.dir, "xoshiro256ss.ir.json"), "utf8").trim();
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
        if (opNode.v === "rotl")
            return { op: "rotl", r: intOf(field(node, "r")) };
        return { op: "xorshr", s: intOf(field(node, "s")) };
    });
    return { width, ops };
}
/** The same width-parametric total interpreter gen.ts uses (with rotl). */
function runIr(width, ir, x) {
    const mask = (1n << width) - 1n;
    const m = (z) => z & mask;
    return ir.reduce((z, step) => {
        switch (step.op) {
            case "mul":
                return m(z * step.k);
            case "xorshr":
                return m(z ^ (z >> step.s));
            case "rotl": {
                const r = step.r % width;
                return m((z << r) | (z >> (width - r)));
            }
        }
    }, m(x));
}
// Canonical golden values (must match vectors.yaml / the hand-ports).
const GOLDEN = {
    "0": "0",
    "1": "5760",
    "2": "11520",
    "10": "57600",
    "11400714819323198485": "16155200969329072355",
    "9223372036854775808": "576",
    "18446744073709551615": "18446744073709546999",
};
test("the xoshiro256ss IR row is a CANONICAL DynamicValue (decoder accepts it; fixed-point holds)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok)
        return;
    expect(canonicalJson(decoded.value)).toEqual({ ok: true, value: IR_TEXT });
});
test("the IR row carries the zeta-ir-v2 schema tag (breaking grammar => new version)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const schema = field(decoded.value, "schema");
    expect(schema.t === "str" && schema.v).toBe("zeta-ir-v2");
});
test("IR decoded FROM THE ROW reproduces the canonical xoshiro256ss golden vectors", () => {
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
    // Flip the first multiplier (5 -> 7).
    let flipped = false;
    const corrupt = ops.map((op) => {
        if (!flipped && op.op === "mul") {
            flipped = true;
            return { op: "mul", k: 7n };
        }
        return op;
    });
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("the ROTATE AMOUNT is load-bearing: rotl 7 -> rotl 8 diverges from the golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const corrupt = ops.map((op) => (op.op === "rotl" ? { op: "rotl", r: 8n } : op));
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("dropping the rotl op diverges from the golden (rotl is not redundant)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const withoutRotl = ops.filter((op) => op.op !== "rotl");
    // mul 5 · mul 9 = mul 45 (mod 2^64), which is purely multiplicative — no bit can wrap,
    // so the golden (which depends on the rotate) must differ.
    expect(runIr(width, withoutRotl, 1n).toString()).not.toBe(GOLDEN["1"]);
});
test("the WIDTH field is load-bearing: folding at width 32 diverges from the u64 golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { ops } = parseIr(decoded.value);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(32n, ops, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
