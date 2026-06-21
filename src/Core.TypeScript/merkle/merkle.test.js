import { test, expect } from "bun:test";
import vectors from "./golden-vectors-merkle.json";
import { MerkleTree, toHex } from "./merkle";
import { xxh3_128 } from "./xxh3";
// Cross-language byte-lock: the TS Merkle root must match the F# implementation byte-for-byte
// over the same leaves. The fixture golden-vectors-merkle.json was generated from
// src/Core/Merkle.fs and covers the XXH3 input-length classes (0, 1-3, 4-8, 9-16, 17-128,
// 129-240, 241+) plus tree shapes (1/2/3/5 leaves, odd fan-in). If this passes, TS agrees
// with F#/C#/Rust on every root — closing Merkle's 4-lang leg. The XXH3-128 is a pure-TS
// port (no dependency) per Aaron's Merkle 4-lang decision.
const hexToBytes = (s) => {
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
};
const cases = vectors;
test("golden vectors are present", () => {
    expect(cases.length).toBeGreaterThan(0);
});
for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    test(`Merkle root matches F# golden vector #${i} (${c.leaves.length} leaves)`, () => {
        const leaves = c.leaves.map(hexToBytes);
        const got = toHex(new MerkleTree(leaves).root());
        expect(got).toBe(c.root);
    });
}
// XXH3-128 known-answer: empty input is a fixed XXH3 constant (sanity anchor independent of
// the Merkle layer). XXH3_128("") low64 = 0x6001c324468d497f, high64 = 0x99aa06d3014798d8.
test("xxh3_128 of empty input matches the known XXH3 constant", () => {
    const { low, high } = xxh3_128(new Uint8Array(0));
    expect(low.toString(16).padStart(16, "0")).toBe("6001c324468d497f");
    expect(high.toString(16).padStart(16, "0")).toBe("99aa06d3014798d8");
});
