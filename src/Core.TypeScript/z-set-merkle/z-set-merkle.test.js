import { test, expect } from "bun:test";
import { ofEntries, stringCompare } from "../z-set/z-set";
import { root } from "./z-set-merkle";
import { toHex } from "../merkle/merkle";
import vectorsFile from "./golden-vectors.json";
const vectors = vectorsFile.vectors;
test("z-set-merkle golden vectors are present", () => {
    expect(vectors.length).toBeGreaterThan(0);
});
const encoder = new TextEncoder();
const encodeKey = (s) => encoder.encode(s);
for (const vc of vectors) {
    test(`ZSetMerkle root matches golden vector: ${vc.name}`, () => {
        const entries = vc.entries.map(e => ({ e: e.key, w: e.weight }));
        const z = ofEntries(stringCompare, entries);
        const rootHash = root(encodeKey, z);
        const got = toHex(rootHash);
        expect(got).toBe(vc.root);
    });
}
