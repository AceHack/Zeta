// ZSetMerkle cross-language conformance oracle.
//
// Verifies every present language output against the canonical vectors in
// vectors.yaml: each implementation must produce expected_hex for every vector
// id, with the exact vector key-set. Absent implementation outputs are skipped so
// ports can land independently, but at least one implementation must be present.
import { readFileSync } from "fs";
import { parse } from "../../../src/Core.TypeScript/yaml/dom";
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
function loadOutput(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return null;
    }
}
const parsed = parse(readFileSync("vectors.yaml", "utf8"));
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
    const entries = asMap(item, `vectors[${i}]`);
    const id = asStr(field(entries, "id"));
    const expectedHex = asStr(field(entries, "expected_hex"));
    if (id === undefined || expectedHex === undefined) {
        throw new Error(`vectors[${i}]: missing id or expected_hex`);
    }
    return { id, expectedHex: expectedHex.toLowerCase() };
});
const expected = Object.fromEntries(vectors.map((v) => [v.id, v.expectedHex]));
const expectedKeys = Object.keys(expected);
if (expectedKeys.length === 0) {
    console.error("zset-merkle: no expected_hex vectors parsed from vectors.yaml");
    process.exit(1);
}
const implementations = [
    ["TS", "ts-output.json"],
    ["F#", "fsharp-output.json"],
    ["C#", "cs-output.json"],
    ["Rust", "rust-output.json"],
    ["Python", "python-output.json"],
    ["Go", "go-output.json"],
];
let mismatches = 0;
let present = 0;
const expectedKeySet = new Set(expectedKeys);
console.log("ZSetMerkle cross-verification:");
console.log(`  expected: ${expectedKeys.length} vectors`);
for (const [name, file] of implementations) {
    const output = loadOutput(file);
    if (output === null) {
        console.log(`  ${name}: MISSING (skipped)`);
        continue;
    }
    present += 1;
    const outputKeys = Object.keys(output);
    console.log(`  ${name}: ${outputKeys.length} vectors`);
    for (const key of outputKeys) {
        if (!expectedKeySet.has(key)) {
            console.error(`Extra vector in ${name} not present in fixture: ${key}`);
            mismatches += 1;
        }
    }
    for (const key of expectedKeys) {
        const got = output[key];
        if (got === undefined) {
            console.error(`Mismatch ${key}: ${name}=MISSING expected=${expected[key]}`);
            mismatches += 1;
            continue;
        }
        if (got.toLowerCase() !== expected[key]) {
            console.error(`Mismatch ${key}: ${name}=${got} expected=${expected[key]}`);
            mismatches += 1;
        }
    }
}
if (present === 0) {
    console.error("zset-merkle: no language outputs present to verify");
    process.exit(1);
}
if (mismatches === 0) {
    console.log(`OK: ${present} implementation(s) agree with the canonical ${expectedKeys.length} vectors.`);
    process.exit(0);
}
console.log(`${mismatches} mismatch(es).`);
process.exit(1);
