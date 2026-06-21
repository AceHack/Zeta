// gen.ts — the GENERATED-FROM-IR TypeScript oracle for the `nasam` mixer.
//
// nasam is the FIFTH "generated-from-ir" primitive and the SECOND grammar evolution: it is
// the first to need ops OUTSIDE the v2 `mul`/`xorshr`/`rotl` vocabulary. Pelle Evensen's
// public-domain nasam (mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-
// mixer.html) is a pure single-word finaliser whose mixing steps XOR the word with the XOR of
// SEVERAL self-transforms:
//   x ^= ror(x,25) ^ ror(x,47);  x *= M1;  x ^= x>>23 ^ x>>51;  x *= M2;  x ^= x>>23 ^ x>>51
// A v2 `rotl r` REPLACES the accumulator with its rotation; nasam needs to XOR rotations of
// the CURRENT word back IN — a parallel reuse no sequential mul/xorshr/rotl chain expresses.
// So nasam's IR ships under a NEW frozen schema tag, `zeta-ir-v3` (src/Core/ZetaIrV3.fs and
// the two-layer v1/v2/v3 firewall in ZetaIrV3.Tests), adding two ops:
//   { op: "xrotxor", rs: [r1,r2,...] }  // x ^= rotl(x,r1) ^ rotl(x,r2) ^ ...
//   { op: "xshrxor", ss: [s1,s2,...] }  // x ^= (x>>>s1) ^ (x>>>s2) ^ ...
// (`xshrxor [s]` is exactly v1/v2's `xorshr s`, so v3 GENERALISES the old op.)
//
// Like the other generated-from-ir oracles, this reads its IR from the RELATION
// (`generatorIr.byZetaId(idOf("hash.nasam", 1))`) and decodes it through the project's real
// `fromCanonicalJson`. A malformed/non-canonical IR is rejected as data.
//
// Tier: PROVEN that the IR-as-DynamicValue-row + a width-parametric total interpreter (now
// WITH xrotxor/xshrxor) byte-locks a FIFTH primitive under a TWICE-EXTENDED grammar against
// five independent hand-ports + canonical. The committed nasam.ir.json is the row's
// materialised view; ZetaIrV3.Tests pin the v3 freeze (golden, validator, the two-layer
// firewall, v2->v3 widening).
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
import * as generatorIr from "../../_harness/generator-ir-registry.js";
const MASK = (1n << 64n) - 1n;
const u64 = (x) => x & MASK;
/** Reinterpret a stored signed-int64 back to the u64 it bit-encodes. */
const fromI64 = (i) => u64(i);
// --- obtain the IR ROW from the relation (by content-addressed ZetaId) and decode it ---
const zetaId = generatorIr.idOf("hash.nasam", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow) {
    throw new Error(`no IR row on the relation for hash.nasam@1 (zetaId ${zetaId})`);
}
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok) {
    throw new Error(`hash.nasam@1 IR row is not a canonical DynamicValue: ${decoded.error}`);
}
// --- project the decoded DynamicValue (Tagged) down to (width, op list) ---
function field(obj, key) {
    if (obj.t !== "obj")
        throw new Error("IR: expected object");
    const hit = obj.v.find(([k]) => k === key);
    if (!hit)
        throw new Error(`IR: missing field "${key}"`);
    return hit[1];
}
function asInt(v) {
    if (v.t !== "int")
        throw new Error("IR: expected int");
    return BigInt(v.v);
}
function asStr(v) {
    if (v.t !== "str")
        throw new Error("IR: expected string");
    return v.v;
}
function asIntList(v) {
    if (v.t !== "arr")
        throw new Error("IR: expected array");
    return v.v.map(asInt);
}
// the v3 envelope carries the twice-bumped schema tag — assert it, so a v1/v2 artifact (or a
// drift) is rejected at the gate rather than silently folded.
const schema = asStr(field(decoded.value, "schema"));
if (schema !== "zeta-ir-v3")
    throw new Error(`IR: nasam expects schema zeta-ir-v3, got ${schema}`);
const width = asInt(field(decoded.value, "width"));
if (width !== 64n)
    throw new Error(`IR: nasam expects width 64, got ${width}`);
function parseOps(ir) {
    const opsNode = field(ir, "ops");
    if (opsNode.t !== "arr")
        throw new Error("IR: ops must be an array");
    return opsNode.v.map((node) => {
        const op = asStr(field(node, "op"));
        switch (op) {
            case "mul":
                return { op: "mul", k: fromI64(asInt(field(node, "k"))) };
            case "xorshr":
                return { op: "xorshr", s: asInt(field(node, "s")) };
            case "rotl":
                return { op: "rotl", r: asInt(field(node, "r")) };
            case "xrotxor":
                return { op: "xrotxor", rs: asIntList(field(node, "rs")) };
            case "xshrxor":
                return { op: "xshrxor", ss: asIntList(field(node, "ss")) };
            default:
                throw new Error(`IR: unknown op "${op}" (v3 grammar is mul | xorshr | rotl | xrotxor | xshrxor)`);
        }
    });
}
const NASAM_IR = parseOps(decoded.value);
/** rotate-left by r within `width` bits (constant rotate). */
const rotl = (x, r, w) => {
    const k = ((r % w) + w) % w;
    return k === 0n ? u64(x) : u64(((x << k) | (x >> (w - k))) & MASK);
};
/** The total interpreter: fold the IR (decoded from the row) over an input, at u64. */
function mix(x) {
    return NASAM_IR.reduce((z, step) => {
        switch (step.op) {
            case "mul":
                return u64(z * step.k);
            case "xorshr":
                return u64(z ^ (z >> step.s));
            case "rotl":
                return rotl(z, step.r, width);
            case "xrotxor":
                // XOR several rotations of the CURRENT word back into it.
                return u64(step.rs.reduce((acc, r) => acc ^ rotl(z, r, width), z));
            case "xshrxor":
                // XOR several right-shifts of the CURRENT word back into it.
                return u64(step.ss.reduce((acc, s) => acc ^ (z >> s), z));
        }
    }, u64(x));
}
const inputs = {
    "x-0": 0n,
    "x-1": 1n,
    "x-2": 2n,
    "x-10": 10n,
    "x-255": 255n,
    "x-u64max": 18446744073709551615n,
    "x-golden": 11400714819323198485n,
    "x-2pow63": 9223372036854775808n,
    "x-12345678901234567890": 12345678901234567890n,
    "x-1e18": 1000000000000000000n,
};
const out = { _source: "generated-from-ir" };
for (const [id, x] of Object.entries(inputs))
    out[id] = mix(x).toString();
const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ts-output.json (generated-from-ir, IR sourced from the relation row zetaId=${zetaId}, schema=zeta-ir-v3, width 64)`);
