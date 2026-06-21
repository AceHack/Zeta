// ZSetMerkle INCLUSION-PROOF cross-language oracle — TypeScript peer (math-team row 4).
//
// INDEPENDENCE: this oracle re-derives the inclusion proof FROM SCRATCH — its own
// leaf encoding, byte-compare, combine, canonical sort and audit-path walk. It
// imports ONLY the shared digest primitive (`ofBytes`/`toHex` from ./merkle), the
// same digest the root oracle (cross-verify.ts) already uses; it deliberately does
// NOT import any proof logic from z-set-merkle.ts (there is none) nor share a path
// walker with the F# reference. Two independent implementations agreeing on the
// proof BYTES — and each proof verifying against the embedded root — is the proof.
//
// Canonical proof string (the byte-lock target):
//     <root_hex>|<leaf_key_hex>:<leaf_weight>|<step>,<step>,...
// where each step is `<R|L><sibling_hex>`: `R` = sibling on the right (self is the
// left child, parent = combine(self, sibling)); `L` = sibling is the left neighbour.
import { ofBytes, toHex } from "../merkle/merkle";
import { parse } from "../yaml/dom";
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
        const probe = asStr(field(m, "probe", ctx), `${ctx}.probe`);
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
        return { id, entries, probe };
    });
}
// ── independent Merkle inclusion-proof construction ──────────────────────────
const encoder = new TextEncoder();
const encodeKey = (s) => encoder.encode(s);
/** Lexicographic ordinal comparison of two byte arrays. */
function byteCompare(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i] !== b[i])
            return a[i] - b[i];
    }
    return a.length - b.length;
}
/** [4-byte LE keyLen][keyBytes][8-byte LE weight]. */
function leafBytes(keyBytes, weight) {
    const buf = new Uint8Array(4 + keyBytes.length + 8);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setInt32(0, keyBytes.length, true);
    buf.set(keyBytes, 4);
    view.setBigInt64(4 + keyBytes.length, weight, true);
    return buf;
}
/** Combine two child digests: 32 LE bytes a.hi a.lo b.hi b.lo, re-hashed. */
function combine(a, b) {
    const buf = new Uint8Array(32);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setBigUint64(0, a.hi, true);
    view.setBigUint64(8, a.lo, true);
    view.setBigUint64(16, b.hi, true);
    view.setBigUint64(24, b.lo, true);
    return ofBytes(buf);
}
/** Net-consolidate raw entries into a canonical, byte-sorted, weight-nonzero run. */
function consolidate(entries) {
    const acc = new Map();
    for (const e of entries) {
        const kb = encodeKey(e.key);
        const hexKey = Buffer.from(kb).toString("hex");
        const prev = acc.get(hexKey);
        acc.set(hexKey, { kb, w: (prev ? prev.w : 0n) + BigInt(e.weight) });
    }
    return [...acc.values()].filter((e) => e.w !== 0n).sort((a, b) => byteCompare(a.kb, b.kb));
}
/** Build an inclusion proof for `probe`; replays root's odd-node duplication. */
function proofFor(entries, probe) {
    const sorted = consolidate(entries);
    const target = encodeKey(probe);
    const leafIdx = sorted.findIndex((e) => byteCompare(e.kb, target) === 0);
    if (leafIdx < 0)
        return null;
    const leaf = sorted[leafIdx];
    let level = sorted.map((e) => ofBytes(leafBytes(e.kb, e.w)));
    const steps = [];
    let idx = leafIdx;
    while (level.length > 1) {
        const n = level.length;
        const selfIsLeft = idx % 2 === 0;
        const siblingIdx = selfIsLeft ? (idx + 1 < n ? idx + 1 : idx) : idx - 1;
        steps.push({ sibling: level[siblingIdx], siblingOnRight: selfIsLeft });
        const parents = [];
        for (let i = 0; i < n; i += 2) {
            const a = level[i];
            const b = i + 1 < n ? level[i + 1] : a;
            parents.push(combine(a, b));
        }
        level = parents;
        idx = Math.floor(idx / 2);
    }
    return { leafKeyBytes: leaf.kb, leafWeight: leaf.w, steps };
}
/** Recompute the root from a proof alone (third-party verification). */
function rootOfProof(p) {
    let acc = ofBytes(leafBytes(p.leafKeyBytes, p.leafWeight));
    for (const s of p.steps) {
        acc = s.siblingOnRight ? combine(acc, s.sibling) : combine(s.sibling, acc);
    }
    return acc;
}
/** Canonical Merkle root over the consolidated entries (for the embedded root). */
function root(entries) {
    const sorted = consolidate(entries);
    if (sorted.length === 0)
        return ofBytes(new Uint8Array(0));
    let level = sorted.map((e) => ofBytes(leafBytes(e.kb, e.w)));
    while (level.length > 1) {
        const parents = [];
        for (let i = 0; i < level.length; i += 2) {
            const a = level[i];
            const b = i + 1 < level.length ? level[i + 1] : a;
            parents.push(combine(a, b));
        }
        level = parents;
    }
    return level[0];
}
function proofString(rootHex, p) {
    const leafHex = Buffer.from(p.leafKeyBytes).toString("hex");
    const path = p.steps.map((s) => `${s.siblingOnRight ? "R" : "L"}${toHex(s.sibling)}`).join(",");
    return `${rootHex}|${leafHex}:${p.leafWeight}|${path}`;
}
// ── run ──────────────────────────────────────────────────────────────────────
const yamlPath = join(import.meta.dirname, "../../../tests/cross-verification/zset-merkle-proof/vectors.yaml");
const yamlText = await Bun.file(yamlPath).text();
const parsed = parse(yamlText);
if (!parsed.ok) {
    console.error(`FAIL: YAML parse failed: ${JSON.stringify(parsed.feedback)}`);
    process.exit(1);
}
const vectors = yamlValueToVectors(parsed.value);
const results = {};
let failures = 0;
for (const v of vectors) {
    const p = proofFor(v.entries, v.probe);
    if (p === null) {
        console.error(`FAIL ${v.id}: probe '${v.probe}' is not in the net support`);
        failures++;
        continue;
    }
    const rootHex = toHex(root(v.entries));
    // self-consistency: the proof must reproduce the root it embeds.
    if (toHex(rootOfProof(p)) !== rootHex) {
        console.error(`FAIL ${v.id}: proof does not verify against the root`);
        failures++;
        continue;
    }
    results[v.id] = proofString(rootHex, p);
}
const outputPath = join(import.meta.dirname, "../../../tests/cross-verification/zset-merkle-proof/ts-output.json");
await Bun.write(outputPath, JSON.stringify(results, null, 2) + "\n");
console.log(`TS ZSetMerkle inclusion-proof: computed ${Object.keys(results).length} vectors.`);
if (failures > 0) {
    console.error(`FAIL: ${failures} vector(s)`);
    process.exit(1);
}
