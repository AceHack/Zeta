import { sha256Hex } from "./sha256";
import { parse } from "../yaml/dom";
function inputBytes(v) {
    if (typeof v.input_utf8 === "string")
        return new TextEncoder().encode(v.input_utf8);
    if (typeof v.input_hex === "string") {
        const h = v.input_hex;
        const out = new Uint8Array(h.length / 2);
        for (let i = 0; i < out.length; i++)
            out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
        return out;
    }
    throw new Error(`vector ${v.id}: needs input_utf8 or input_hex`);
}
// Read the fixture through OUR YAML port (own-the-interface; not Bun.YAML directly).
function asMap(v, ctx) {
    if (v.t !== "Map")
        throw new Error(`expected Map at ${ctx}, got ${v.t}`);
    return v.entries;
}
function field(entries, key) {
    for (const [k, val] of entries)
        if (k === key)
            return val;
    return undefined;
}
function asStr(v) {
    return v !== undefined && v.t === "Str" ? v.value : undefined;
}
const parsed = parse(await Bun.file("vectors.yaml").text());
if (!parsed.ok) {
    console.error(`YAML parse failed: ${JSON.stringify(parsed.feedback)}`);
    process.exit(1);
}
const root = asMap(parsed.value, "root");
const vectorsNode = field(root, "vectors");
if (vectorsNode === undefined || vectorsNode.t !== "Seq") {
    console.error("fixture: missing `vectors` sequence");
    process.exit(1);
}
const vectors = vectorsNode.items.map((item, i) => {
    const e = asMap(item, `vectors[${i}]`);
    const id = asStr(field(e, "id"));
    const expectedHex = asStr(field(e, "expected_hex"));
    if (id === undefined || expectedHex === undefined) {
        throw new Error(`vectors[${i}]: missing id or expected_hex`);
    }
    const inputUtf8 = asStr(field(e, "input_utf8"));
    const inputHex = asStr(field(e, "input_hex"));
    return {
        id,
        expected_hex: expectedHex,
        ...(inputUtf8 !== undefined ? { input_utf8: inputUtf8 } : {}),
        ...(inputHex !== undefined ? { input_hex: inputHex } : {}),
    };
});
const results = {};
let mismatches = 0;
for (const v of vectors) {
    const hex = sha256Hex(inputBytes(v));
    results[v.id] = hex;
    if (hex !== v.expected_hex) {
        mismatches++;
        console.error(`Hex MISMATCH ${v.id}: got ${hex} expected ${v.expected_hex}`);
    }
}
await Bun.write("ts-output.json", JSON.stringify(results, null, 2));
console.log(`Cross-verify: ${vectors.length} vectors. Hex matches expected ${vectors.length - mismatches}/${vectors.length}.`);
// Enforce: non-zero exit on any mismatch so CI / automation catches regressions.
if (mismatches > 0) {
    console.error(`FAIL: ${mismatches} hex mismatch`);
    process.exit(1);
}
