import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse } from "yaml";
import { fromCanonicalJson } from "../../../../src/Core.TypeScript/dynamic-value/json.js";
import * as generatorIr from "../../_harness/generator-ir-registry.js";
const MASK = (1n << 32n) - 1n;
const u32 = (x) => x & MASK;
const fromI64 = (i) => u32(i);
const zetaId = generatorIr.idOf("rng.lcg32_glibc", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow)
    throw new Error(`no IR row on the relation for rng.lcg32_glibc@1`);
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok)
    throw new Error(`rng.lcg32_glibc@1 IR row is not a canonical DynamicValue: ${decoded.error}`);
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
const schema = asStr(field(decoded.value, "schema"));
if (schema !== "zeta-ir-v4")
    throw new Error(`IR: lcg32_glibc expects schema zeta-ir-v4, got ${schema}`);
const width = asInt(field(decoded.value, "width"));
if (width !== 32n)
    throw new Error(`IR: lcg32_glibc expects width 32, got ${width}`);
function parseOps(ir) {
    const opsNode = field(ir, "ops");
    if (opsNode.t !== "arr")
        throw new Error("IR: ops must be an array");
    return opsNode.v.map((node) => {
        const op = asStr(field(node, "op"));
        switch (op) {
            case "mul": return { op: "mul", k: fromI64(asInt(field(node, "k"))) };
            case "xorshr": return { op: "xorshr", s: asInt(field(node, "s")) };
            case "rotl": return { op: "rotl", r: asInt(field(node, "r")) };
            case "xrotxor": return { op: "xrotxor", rs: asIntList(field(node, "rs")) };
            case "xshrxor": return { op: "xshrxor", ss: asIntList(field(node, "ss")) };
            case "add": return { op: "add", k: fromI64(asInt(field(node, "k"))) };
            default: throw new Error(`IR: unknown op "${op}"`);
        }
    });
}
const LCG_IR = parseOps(decoded.value);
const rotl = (x, r, w) => {
    const k = ((r % w) + w) % w;
    return k === 0n ? u32(x) : u32(((x << k) | (x >> (w - k))) & MASK);
};
function mix(x) {
    return LCG_IR.reduce((z, step) => {
        switch (step.op) {
            case "mul": return u32(z * step.k);
            case "xorshr": return u32(z ^ (z >> step.s));
            case "rotl": return rotl(z, step.r, width);
            case "xrotxor": return u32(step.rs.reduce((acc, r) => acc ^ rotl(z, r, width), z));
            case "xshrxor": return u32(step.ss.reduce((acc, s) => acc ^ (z >> s), z));
            case "add": return u32(z + step.k);
        }
    }, u32(x));
}
const dir = dirname(import.meta.dir);
const vectorsPath = join(dir, "vectors.yaml");
const vectorsYaml = readFileSync(vectorsPath, "utf8");
const vectors = parse(vectorsYaml).vectors;
const out = { _source: "generated-from-ir" };
for (const v of vectors) {
    out[v.id] = mix(BigInt(v.state)).toString();
}
writeFileSync(join(dir, 'ts-output.json'), JSON.stringify(out, null, 2));
