import { test, expect } from "bun:test";
import { canonicalJson, fromCanonicalJson } from "./json";
import { canonicalCbor, fromCanonicalCbor } from "./cbor";
// NOTE: `Tagged` is defined separately in json.ts AND cbor.ts (structurally
// identical, nominally distinct) — the DUPLICATION the DynamicValue-unify decision
// (B-1011) removes. Bridged with casts here until they share one type.
import { encode } from "../yaml/encoder";
import { parse } from "../yaml/dom";
import { canonicalXml, fromCanonicalXml } from "./xml";
// TS format-agreement matrix (mirror of the F# DynamicValueYamlBridgeTests): JSON +
// CBOR + YAML all recover the SAME DynamicValue on the locked shapes — all paths
// commute on the common value. Locked Tagged subset = null/bool/int/str/arr/obj
// (the intersection all three lock; no float/bytes here).
// bridge: Tagged (DynamicValue) <-> YamlValue (the locked shapes)
function dvToYaml(t) {
    switch (t.t) {
        case "null": return { t: "Null" };
        case "bool": return { t: "Bool", value: t.v };
        case "int": return { t: "Int", value: BigInt(t.v) };
        case "str": return { t: "Str", value: t.v };
        case "arr": return { t: "Seq", items: t.v.map(dvToYaml) };
        case "obj": return { t: "Map", entries: t.v.map(([k, c]) => [k, dvToYaml(c)]) };
        default: throw new Error(`Unsupported tag in dvToYaml: ${t.t}`);
    }
}
function yamlToDv(y) {
    switch (y.t) {
        case "Null": return { t: "null" };
        case "Bool": return { t: "bool", v: y.value };
        case "Int": return { t: "int", v: y.value.toString() };
        case "Str": return { t: "str", v: y.value };
        case "Seq": return { t: "arr", v: y.items.map(yamlToDv) };
        case "Map": return { t: "obj", v: y.entries.map(([k, c]) => [k, yamlToDv(c)]) };
        case "Float": throw new Error("Float is not in the locked Tagged subset");
    }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const jsonRT = (t) => {
    const enc = canonicalJson(t);
    if (!enc.ok)
        return false;
    const r = fromCanonicalJson(enc.value);
    return r.ok && eq(r.value, t);
};
const cborRT = (t) => {
    const enc = canonicalCbor(t);
    if (!enc.ok)
        return false;
    const r = fromCanonicalCbor(enc.value);
    return r.ok && eq(r.value, t);
};
const yamlRT = (t) => { const r = parse(encode(dvToYaml(t))); return r.ok && eq(yamlToDv(r.value), t); };
const xmlRT = (t) => {
    const enc = canonicalXml(t);
    if (!enc.ok)
        return false;
    const r = fromCanonicalXml(enc.value);
    return r.ok && eq(r.value, t);
};
const cases = [
    { t: "obj", v: [["a", { t: "int", v: "1" }], ["b", { t: "str", v: "x" }], ["n", { t: "null" }], ["f", { t: "bool", v: true }]] },
    { t: "arr", v: [{ t: "int", v: "1" }, { t: "str", v: "two" }, { t: "bool", v: false }] },
    { t: "obj", v: [["nested", { t: "obj", v: [["deep", { t: "arr", v: [{ t: "str", v: "x" }] }]] }]] },
    { t: "obj", v: [["looksInt", { t: "str", v: "123" }], ["looksBool", { t: "str", v: "true" }]] },
];
test("format-agreement matrix: JSON + CBOR + YAML all commute on DynamicValue (TS, locked shapes)", () => {
    for (const t of cases) {
        expect(jsonRT(t)).toBe(true);
        expect(cborRT(t)).toBe(true);
        expect(yamlRT(t)).toBe(true);
        expect(xmlRT(t)).toBe(true);
    }
});
