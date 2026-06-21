// IR-DRIVEN TS oracle for MurmurHash3 fmix32 — the SECOND "generated-from-ir"
// oracle, proving the DynamicValue IR vocabulary generalises.
//
// WHY THIS EXISTS
// ---------------
// splitmix64 was the first oracle whose mixer is DATA (a DynamicValue row) folded
// by a tiny total interpreter rather than hand-written code. This file does the
// same for a DIFFERENT primitive at a DIFFERENT integer width (u32), using the
// SAME op vocabulary (`mul`, `xorshr`) plus a single `width` field on the row. The
// only thing that changes between the two generators is the row — proving the IR
// is not splitmix64-specific. The emitted oracle tags `"_source": "generated-from-
// ir"`; the N-way harness byte-locks it against the five independent hand-ports +
// canonical.
//
// THE IR IS A ROW IN THE SCHEMA
// -----------------------------
// The finaliser IR is read from `fmix32.ir.json` (a canonical-JSON DynamicValue)
// and decoded through the project's real decoder
// (`src/Core.TypeScript/dynamic-value/json.ts` — `fromCanonicalJson`). The
// algorithm appears NOWHERE as code here; it lives in the row. A malformed or
// non-canonical IR is rejected as data, never silently mis-folded.
//
// WIDTH NOTE
// ----------
// fmix32 is u32, so the row carries `width: 32` and the interpreter masks to
// 2^width - 1 after every step. fmix32's multiplier constants are < 2^31, so they
// fit DynamicValue.Int (int64) directly with NO signed reinterpretation (unlike
// splitmix64's u64 constants). The same interpreter handles width 64 by setting
// `width: 64` and reinterpreting any stored-negative `k` back to u-word.
//
// Tier: PROVEN that the IR-as-DynamicValue-row + width-parametric total interpreter
// byte-locks a SECOND primitive against the five independent hand-ports and
// canonical. The IR is now sourced FROM THE RELATION:
// `generatorIr.byZetaId(idOf("hash.fmix32", 1))` returns the row whose payload is
// the canonical-JSON IR (the committed fmix32.ir.json is that row's materialised
// view; the F# GeneratorIrRegistry.Tests pin the byte-for-byte equality and the
// register/retract/full==incremental Z-set laws).
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
import * as generatorIr from "../../_harness/generator-ir-registry.js";
// --- obtain the IR ROW from the relation (by content-addressed ZetaId) and decode it ---
const zetaId = generatorIr.idOf("hash.fmix32", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow) {
    throw new Error(`no IR row on the relation for hash.fmix32@1 (zetaId ${zetaId})`);
}
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok) {
    throw new Error(`hash.fmix32@1 IR row is not a canonical DynamicValue: ${decoded.error}`);
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
if (width !== 32n && width !== 64n)
    throw new Error(`IR: unsupported width ${width}`);
const MASK = (1n << width) - 1n;
const uword = (x) => x & MASK;
/** Reinterpret a stored (possibly signed-int64) constant back to the u-word it encodes. */
const fromStored = (i) => uword(i);
function parseOps(ir) {
    const opsNode = field(ir, "ops");
    if (opsNode.t !== "arr")
        throw new Error("IR: ops must be an array");
    return opsNode.v.map((node) => {
        const op = asStr(field(node, "op"));
        switch (op) {
            case "mul":
                return { op: "mul", k: fromStored(asInt(field(node, "k"))) };
            case "xorshr":
                return { op: "xorshr", s: asInt(field(node, "s")) };
            default:
                throw new Error(`IR: unknown op "${op}"`);
        }
    });
}
const FMIX32_IR = parseOps(decoded.value);
/** The total interpreter: fold the IR (decoded from the row) over an input, at the
 *  IR's declared width. Identical to the splitmix64 interpreter except the mask is
 *  width-parametric. */
function mix(x) {
    return FMIX32_IR.reduce((z, step) => {
        switch (step.op) {
            case "mul":
                return uword(z * step.k);
            case "xorshr":
                return uword(z ^ (z >> step.s));
        }
    }, uword(x));
}
const inputs = {
    "x-0": 0n,
    "x-1": 1n,
    "x-2": 2n,
    "x-10": 10n,
    "x-255": 255n,
    "x-u32max": 4294967295n,
    "x-0x9e3779b9": 2654435769n,
    "x-2pow31": 2147483648n,
    "x-3735928559": 3735928559n,
    "x-1e9": 1000000000n,
};
const out = { _source: "generated-from-ir" };
for (const [id, x] of Object.entries(inputs))
    out[id] = mix(x).toString();
const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ts-output.json (generated-from-ir, IR sourced from the relation row zetaId=${zetaId}, width 32)`);
