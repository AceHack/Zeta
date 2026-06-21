// IR-DRIVEN TS oracle for MurmurHash3 fmix64 — the THIRD "generated-from-ir"
// oracle, proving the DynamicValue IR vocabulary generalises to a SECOND member of
// the hash family at the u64 width.
//
// WHY THIS EXISTS
// ---------------
// splitmix64 (width 64) and fmix32 (width 32) were the first two oracles whose mixer
// is DATA — an ordered list of total u-word ops carried in a real DynamicValue row —
// folded by a tiny width-parametric interpreter rather than hand-written code. This
// file does the same for a THIRD primitive: MurmurHash3's 64-bit finalizer, fmix64.
// It is the same `mul`/`xorshr` vocabulary as the other two, at width 64 (splitmix64's
// width) but in the hash family (fmix32's family). The only thing that changes between
// the three generators is the IR row — proving the IR is neither splitmix64- nor
// fmix32-specific. The emitted oracle tags `"_source": "generated-from-ir"`; the N-way
// harness byte-locks it against the five independent hand-ports + canonical.
//
// THE IR IS A ROW IN THE SCHEMA
// -----------------------------
// The finaliser IR is the payload of the registered generator `hash.fmix64@1`
// (`GeneratorIrRegistry`/`ZetaIrV1`; id a24500e8…e78d). It is read from the RELATION
// (`generatorIr.byZetaId(idOf("hash.fmix64", 1))`) and decoded through the project's
// real decoder (`src/Core.TypeScript/dynamic-value/json.ts` — `fromCanonicalJson`).
// The algorithm appears NOWHERE as code here; it lives in the row. A malformed or
// non-canonical IR is rejected as data, never silently mis-folded.
//
// INT64 DOMAIN NOTE (honest constraint)
// -------------------------------------
// DynamicValue.Int is int64, but fmix64's multiplier constants are u64. They are
// stored as their two's-complement SIGNED-int64 bit-pattern (e.g. 0xff51afd7ed558ccd
// -> -49064778989728563). Because multiply is mod 2^64, reinterpreting the stored i64
// back to u64 (`& MASK`) is bit-identical — the round-trip is exact. Public-domain
// smhasher MurmurHash3.cpp:
//   k ^= k>>33; k *= 0xff51afd7ed558ccd; k ^= k>>33; k *= 0xc4ceb9fe1a85ec53; k ^= k>>33
//
// Tier: PROVEN that the IR-as-DynamicValue-row + width-parametric total interpreter
// byte-locks a THIRD primitive against the five independent hand-ports and canonical.
// The committed fmix64.ir.json is the row's materialised view; the F#
// GeneratorIrRegistry.Tests pin the byte-for-byte equality and the register/retract/
// full==incremental Z-set laws, and ZetaIrV1.Tests pin the legacy-from-v1 derivation.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
import * as generatorIr from "../../_harness/generator-ir-registry.js";
const MASK = (1n << 64n) - 1n;
const u64 = (x) => x & MASK;
/** Reinterpret a stored signed-int64 back to the u64 it bit-encodes. */
const fromI64 = (i) => u64(i);
// --- obtain the IR ROW from the relation (by content-addressed ZetaId) and decode it ---
const zetaId = generatorIr.idOf("hash.fmix64", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow) {
    throw new Error(`no IR row on the relation for hash.fmix64@1 (zetaId ${zetaId})`);
}
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok) {
    throw new Error(`hash.fmix64@1 IR row is not a canonical DynamicValue: ${decoded.error}`);
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
const width = asInt(field(decoded.value, "width"));
if (width !== 64n)
    throw new Error(`IR: fmix64 expects width 64, got ${width}`);
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
            default:
                throw new Error(`IR: unknown op "${op}"`);
        }
    });
}
const FMIX64_IR = parseOps(decoded.value);
/** The total interpreter: fold the IR (decoded from the row) over an input, at u64. */
function mix(x) {
    return FMIX64_IR.reduce((z, step) => {
        switch (step.op) {
            case "mul":
                return u64(z * step.k);
            case "xorshr":
                return u64(z ^ (z >> step.s));
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
console.log(`wrote ts-output.json (generated-from-ir, IR sourced from the relation row zetaId=${zetaId}, width 64)`);
