// gen-ir.test.ts — generator-fidelity self-test for the IR-driven nasam oracle.
//
// WHY THIS EXISTS
// ---------------
// nasam is the FIFTH "generated-from-ir" oracle, and the SECOND grammar evolution: it is the
// first to need ops OUTSIDE the v2 `mul`/`xorshr`/`rotl` vocabulary. Pelle Evensen's
// public-domain nasam mixer is a pure single-word finaliser whose mixing steps XOR the word
// with the XOR of SEVERAL self-transforms:
//   x ^= ror(x,25) ^ ror(x,47);  x *= M1;  x ^= x>>23 ^ x>>51;  x *= M2;  x ^= x>>23 ^ x>>51
// A v2 `rotl r` REPLACES the accumulator with its rotation; nasam needs to XOR rotations of
// the CURRENT word back IN — a parallel reuse no sequential mul/xorshr/rotl chain expresses.
// Because it BREAKS the v2 grammar, this generator's IR ships under a NEW frozen schema tag,
// `zeta-ir-v3` (see src/Core/ZetaIrV3.fs and the TWO-LAYER v1/v2/v3 firewall tests). Its row
// is `nasam.ir.json`, adding two ops: `xrotxor [r...]` (x ^= rotl(x,r_i) ^ ...) and
// `xshrxor [s...]` (x ^= (x>>s_i) ^ ...); the one-term `xshrxor [s]` is exactly v1/v2's
// `xorshr s`, so v3 GENERALISES the old op.
//
// The N-way harness proves the EMITTED bytes byte-lock against the five independent
// hand-ports (gen.fsx/csx/go/py/rs). This test guards the layer beneath that:
//   1. the IR ROW is a CANONICAL DynamicValue (the real `fromCanonicalJson` accepts it
//      AND the fixed-point `canonicalJson(decode x) === x` holds);
//   2. the IR decoded FROM THE ROW reproduces the canonical golden vectors at width 64;
//   3. CORRUPTING the IR (a multiplier, a ROTATE TERM, a SHIFT TERM, dropping a term from a
//      multi-term op, dropping an op, or the WIDTH) DIVERGES — a green that cannot turn red
//      when the generator is wrong is a Sybil green.
//
// Run: `bun test tests/cross-verification/nasam/_gen/gen-ir.test.ts`
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
const IR_TEXT = readFileSync(join(import.meta.dir, "nasam.ir.json"), "utf8").trim();
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
            default:
                return { op: "xorshr", s: intOf(field(node, "s")) };
        }
    });
    return { width, ops };
}
/** The same width-parametric total interpreter gen.ts uses (with xrotxor/xshrxor). */
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
        }
    }, m(x));
}
// Canonical golden values (must match vectors.yaml / the hand-ports).
const GOLDEN = {
    "0": "0",
    "1": "11248308645848015117",
    "2": "4049871018963231258",
    "10": "15619865334026328962",
    "11400714819323198485": "5316353314353495237",
    "9223372036854775808": "3708717314784509798",
    "18446744073709551615": "7929819594426970889",
};
test("the nasam IR row is a CANONICAL DynamicValue (decoder accepts it; fixed-point holds)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok)
        return;
    expect(canonicalJson(decoded.value)).toEqual({ ok: true, value: IR_TEXT });
});
test("the IR row carries the zeta-ir-v3 schema tag (breaking grammar a 2nd time => new version)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const schema = field(decoded.value, "schema");
    expect(schema.t === "str" && schema.v).toBe("zeta-ir-v3");
});
test("IR decoded FROM THE ROW reproduces the canonical nasam golden vectors", () => {
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
    // Flip the first multiplier's low byte.
    let flipped = false;
    const corrupt = ops.map((op) => {
        if (!flipped && op.op === "mul") {
            flipped = true;
            return { op: "mul", k: (op.k ^ 1n) & ((1n << width) - 1n) };
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
test("a ROTATE TERM is load-bearing: xrotxor [39,17] -> [40,17] diverges from the golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const corrupt = ops.map((op) => op.op === "xrotxor" ? { op: "xrotxor", rs: op.rs.map((r, i) => (i === 0 ? r + 1n : r)) } : op);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("a SHIFT TERM is load-bearing: xshrxor [23,51] -> [23,50] diverges from the golden", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const corrupt = ops.map((op) => op.op === "xshrxor" ? { op: "xshrxor", ss: op.ss.map((s, i) => (i === op.ss.length - 1 ? s - 1n : s)) } : op);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("DROPPING the 2nd term of a multi-term op diverges (xshrxor [23,51] -> [23] is not the same)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    // Reducing xshrxor [23,51] to the SINGLE-term form is exactly a v2 `xorshr 23` — proving the
    // multi-term form is not redundant (a v2 op cannot stand in for it).
    const corrupt = ops.map((op) => op.op === "xshrxor" ? { op: "xshrxor", ss: op.ss.slice(0, 1) } : op);
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(width, corrupt, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
});
test("dropping the xrotxor op diverges from the golden (xrotxor is not redundant)", () => {
    const decoded = fromCanonicalJson(IR_TEXT);
    if (!decoded.ok)
        throw new Error("row did not decode");
    const { width, ops } = parseIr(decoded.value);
    const withoutXrotxor = ops.filter((op) => op.op !== "xrotxor");
    let differedSomewhere = false;
    for (const [input, expected] of Object.entries(GOLDEN)) {
        if (input === "0")
            continue;
        if (runIr(width, withoutXrotxor, BigInt(input)).toString() !== expected)
            differedSomewhere = true;
    }
    expect(differedSomewhere).toBe(true);
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
