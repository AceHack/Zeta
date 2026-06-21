// IR-DRIVEN TS oracle for the xoshiro256** OUTPUT SCRAMBLER — the FOURTH
// "generated-from-ir" oracle, and the FIRST under the EXTENDED `zeta-ir-v2` grammar.
//
// WHY THIS EXISTS
// ---------------
// The first three generated-from-ir oracles (splitmix64, fmix32, fmix64) all fold a
// finaliser written in ONE vocabulary: `mul` and `xorshr`. That shows the IR generalises
// ACROSS same-family primitives, but it never exercises a grammar that has to GROW. The
// xoshiro256** output scrambler needs an op the v1 grammar does not have: a constant
// rotate-left (`rotl`). Per the `zeta-ir-v1` evolution contract, a breaking grammar change
// bumps the schema tag — so this IR carries `"schema":"zeta-ir-v2"`, and the `rotl` op
// joins `mul`/`xorshr`. The v1 validator REJECTS this tag (the firewall); the v2 validator
// accepts it. The algorithm itself appears NOWHERE as code here — only the rotate-fold
// interpreter does; the specific pipeline (mul 5, rotl 7, mul 9) lives entirely in the row.
//
// THE PRIMITIVE (public-domain reference, Blackman & Vigna)
// --------------------------------------------------------
// https://prng.di.unimi.it/xoshiro256starstar.c — the per-call OUTPUT scrambler is
//   result = rotl(s1 * 5, 7) * 9      where rotl(x, k) = (x << k) | (x >> (64 - k))
// As a pure finaliser over an input word x: `mul 5 · rotl 7 · mul 9` at width 64. This
// oracle folds exactly that, sourcing the op list from the relation row, NOT from code.
//
// WHY rotl IS A REAL GRAMMAR EXTENSION (not expressible in v1)
// -----------------------------------------------------------
// `mul` only propagates carries UPWARD; `xorshr` (x ^= x>>>s) only moves bits DOWNWARD.
// `rotl` WRAPS the most-significant bit down to bit 0 (rotl(1<<63, 1) === 1n) — neither v1
// op can do that. So v2 is necessary, not gratuitous. (Pinned in the F# necessity test.)
//
// THE IR IS A ROW IN THE SCHEMA
// -----------------------------
// The IR is the payload of the registered generator `rng.xoshiro256ss@1`
// (`GeneratorIrRegistry`/`ZetaIrV2`; id 0af7672a…b589). It is read from the RELATION
// (`generatorIr.byZetaId(idOf("rng.xoshiro256ss", 1))`) and decoded through the project's
// real `fromCanonicalJson`. A malformed/non-canonical IR is rejected as data.
//
// Tier: PROVEN that the IR-as-DynamicValue-row + a width-parametric total interpreter
// (now WITH rotl) byte-locks a FOURTH primitive under an EXTENDED grammar against five
// independent hand-ports + canonical. The committed xoshiro256ss.ir.json is the row's
// materialised view; F# GeneratorIrRegistry.Tests pin byte-equality + the Z-set laws, and
// ZetaIrV2.Tests pin the v2 freeze (golden, validator, the v1/v2 firewall, v1->v2 widening).
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
import * as generatorIr from "../../_harness/generator-ir-registry.js";
const MASK = (1n << 64n) - 1n;
const u64 = (x) => x & MASK;
/** Reinterpret a stored signed-int64 back to the u64 it bit-encodes. */
const fromI64 = (i) => u64(i);
// --- obtain the IR ROW from the relation (by content-addressed ZetaId) and decode it ---
const zetaId = generatorIr.idOf("rng.xoshiro256ss", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow) {
    throw new Error(`no IR row on the relation for rng.xoshiro256ss@1 (zetaId ${zetaId})`);
}
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok) {
    throw new Error(`rng.xoshiro256ss@1 IR row is not a canonical DynamicValue: ${decoded.error}`);
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
// the v2 envelope carries the bumped schema tag — assert it, so a v1 artifact (or a drift)
// is rejected at the gate rather than silently folded.
const schema = asStr(field(decoded.value, "schema"));
if (schema !== "zeta-ir-v2")
    throw new Error(`IR: xoshiro256ss expects schema zeta-ir-v2, got ${schema}`);
const width = asInt(field(decoded.value, "width"));
if (width !== 64n)
    throw new Error(`IR: xoshiro256ss expects width 64, got ${width}`);
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
            default:
                throw new Error(`IR: unknown op "${op}" (v2 grammar is mul | xorshr | rotl)`);
        }
    });
}
const XOSHIRO_IR = parseOps(decoded.value);
/** rotate-left by r within `width` bits (constant rotate). */
const rotl = (x, r, w) => u64(((x << r) | (x >> (w - r))) & MASK);
/** The total interpreter: fold the IR (decoded from the row) over an input, at u64. */
function mix(x) {
    return XOSHIRO_IR.reduce((z, step) => {
        switch (step.op) {
            case "mul":
                return u64(z * step.k);
            case "xorshr":
                return u64(z ^ (z >> step.s));
            case "rotl":
                return rotl(z, step.r, width);
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
console.log(`wrote ts-output.json (generated-from-ir, IR sourced from the relation row zetaId=${zetaId}, schema=zeta-ir-v2, width 64)`);
