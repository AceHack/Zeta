/**
 * codegen-zset-merkle.ts — Phase C: generate cross-language ZSet Merkle verifiers.
 *
 * Unlike the arithmetic IR (Phase B), ZSet Merkle is an algorithm specification
 * rather than an op pipeline. The codegen produces test scripts that implement
 * the canonical algorithm and verify against committed golden vectors.
 *
 * Algorithm (total, deterministic, byte-specified):
 *   1. Encode each entry: [4-byte LE keyLen][UTF-8 key bytes][8-byte LE weight]
 *   2. Hash each leaf with xxhash128
 *   3. Sort leaves by key bytes (lexicographic ordinal)
 *   4. Fold bottom-up: combine pairs by hashing [16-byte LE hi.a, lo.a, hi.b, lo.b]
 *   5. Odd trailing node promotes (hashed with itself)
 *   6. Root = final fold result; empty set = hash(empty bytes)
 *
 * Usage:
 *   bun tests/cross-verification/_harness/codegen-zset-merkle.ts
 *
 * Verifies the TS implementation produces the golden vectors.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "../../../src/Core.TypeScript/z-set-merkle/z-set-merkle";
import { ofEntries, stringCompare } from "../../../src/Core.TypeScript/z-set/z-set";
function parseVectors() {
    // Simple YAML-enough parser for the vectors file
    const text = readFileSync(join(import.meta.dir, "../zset-merkle/vectors.yaml"), "utf-8");
    const vectors = [];
    let current = null;
    let entries = [];
    for (const line of text.split("\n")) {
        const idMatch = line.match(/^\s+- id:\s*(.+)/);
        if (idMatch) {
            if (current)
                vectors.push({ id: current.id, entries, expected_hex: current.expected_hex });
            current = { id: idMatch[1].trim() };
            entries = [];
            continue;
        }
        const hexMatch = line.match(/^\s+expected_hex:\s*"([0-9a-f]+)"/);
        if (hexMatch && current) {
            current.expected_hex = hexMatch[1];
            continue;
        }
        const keyMatch = line.match(/^\s+- key:\s*"(.*)"/);
        if (keyMatch) {
            entries.push({ key: keyMatch[1], weight: 0 });
            continue;
        }
        const weightMatch = line.match(/^\s+weight:\s*(-?\d+)/);
        if (weightMatch && entries.length > 0) {
            entries[entries.length - 1].weight = parseInt(weightMatch[1], 10);
        }
    }
    if (current)
        vectors.push({ id: current.id, entries, expected_hex: current.expected_hex });
    return vectors;
}
// ─── Verify ──────────────────────────────────────────────────────────────────
function hashToHex(h) {
    const hi = h.hi.toString(16).padStart(16, "0");
    const lo = h.lo.toString(16).padStart(16, "0");
    return hi + lo;
}
function main() {
    const vectors = parseVectors();
    const encoder = new TextEncoder();
    let failures = 0;
    for (const v of vectors) {
        const zset = ofEntries(stringCompare, v.entries.map(e => ({ e: e.key, w: e.weight })));
        const h = root((key) => encoder.encode(key), zset);
        const hex = hashToHex(h);
        if (hex === v.expected_hex) {
            console.log(`  OK: ${v.id} = ${hex}`);
        }
        else {
            console.error(`  FAIL: ${v.id} got ${hex} expected ${v.expected_hex}`);
            failures++;
        }
    }
    console.log(`\n[zset-merkle] ${vectors.length - failures}/${vectors.length} passed`);
    return failures > 0 ? 1 : 0;
}
if (import.meta.main) {
    process.exit(main());
}
export { parseVectors, hashToHex };
