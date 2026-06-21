import { parse } from "../yaml/dom";
import { root } from "./z-set-merkle";
import { toHex } from "../merkle/merkle";
import { ofEntries, stringCompare } from "../z-set/z-set";
import { join } from "node:path";
function expectMap(v, ctx) {
    if (v.t !== "Map")
        throw new Error(`expected Map at ${ctx}, got ${v.t}`);
    return v.entries;
}
function field(entries, key, ctx) {
    const found = entries.find(([k]) => k === key);
    if (found === undefined)
        throw new Error(`missing field '${key}' at ${ctx}`);
    return found[1];
}
function asStr(v, ctx) {
    if (v.t !== "Str")
        throw new Error(`expected Str at ${ctx}, got ${v.t}`);
    return v.value;
}
function asNum(v, ctx) {
    if (v.t !== "Int")
        throw new Error(`expected Int at ${ctx}, got ${v.t}`);
    return Number(v.value);
}
function yamlValueToVectors(rootVal) {
    const top = expectMap(rootVal, "<root>");
    const vectorsVal = field(top, "vectors", "<root>");
    if (vectorsVal.t !== "Seq")
        throw new Error(`expected Seq at vectors, got ${vectorsVal.t}`);
    return vectorsVal.items.map((item, i) => {
        const ctx = `vectors[${i}]`;
        const m = expectMap(item, ctx);
        const id = asStr(field(m, "id", ctx), `${ctx}.id`);
        const expected_hex = asStr(field(m, "expected_hex", ctx), `${ctx}.expected_hex`);
        const entriesNode = field(m, "entries", ctx);
        let entries = [];
        if (entriesNode.t === "Seq") {
            entries = entriesNode.items.map((entryItem, j) => {
                const entryCtx = `${ctx}.entries[${j}]`;
                const em = expectMap(entryItem, entryCtx);
                return {
                    key: asStr(field(em, "key", entryCtx), `${entryCtx}.key`),
                    weight: asNum(field(em, "weight", entryCtx), `${entryCtx}.weight`),
                };
            });
        }
        else if (entriesNode.t !== "Null") {
            throw new Error(`expected Seq or Null at ${ctx}.entries, got ${entriesNode.t}`);
        }
        return { id, entries, expected_hex };
    });
}
const yamlPath = join(import.meta.dirname, "../../../tests/cross-verification/zset-merkle/vectors.yaml");
const yamlText = await Bun.file(yamlPath).text();
const parsed = parse(yamlText);
if (!parsed.ok) {
    console.error(`FAIL: YAML parse failed: ${JSON.stringify(parsed.feedback)}`);
    process.exit(1);
}
const vectors = yamlValueToVectors(parsed.value);
const results = {};
let mismatches = 0;
const encoder = new TextEncoder();
const encodeKey = (s) => encoder.encode(s);
for (const v of vectors) {
    const entries = v.entries.map(e => ({ e: e.key, w: e.weight }));
    const z = ofEntries(stringCompare, entries);
    const rootHash = root(encodeKey, z);
    const hex = toHex(rootHash);
    results[v.id] = hex;
    if (hex !== v.expected_hex) {
        mismatches++;
        console.error(`Hex MISMATCH for ${v.id}: got ${hex}, expected ${v.expected_hex}`);
    }
}
const outputPath = join(import.meta.dirname, "../../../tests/cross-verification/zset-merkle/ts-output.json");
await Bun.write(outputPath, JSON.stringify(results, null, 2) + "\n");
console.log(`TS ZSetMerkle: computed ${vectors.length} vectors.`);
if (mismatches > 0) {
    console.error(`FAIL: ${mismatches} mismatches`);
    process.exit(1);
}
