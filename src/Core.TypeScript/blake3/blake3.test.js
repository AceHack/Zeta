import { test, expect } from "bun:test";
import { ContentHash256, hasher } from "./blake3";
import { toHex } from "../merkle/merkle";
test("BLAKE3 empty input known-answers match the treaty", () => {
    const empty = new Uint8Array(0);
    // 1. Full 256-bit raw digest hex
    const h256 = ContentHash256.ofBytes(empty);
    expect(h256.toHex()).toBe("af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262");
    // 2. Compact 128-bit LE MerkleHash hex
    const h128 = ContentHash256.toContentAddress128(h256);
    expect(toHex(h128)).toBe("49c9dc36ea4d40a0a6a1f9f5b94913af");
    // 3. IContentHasher adapter matches
    const adapterHash = hasher.hash(empty);
    expect(toHex(adapterHash)).toBe("49c9dc36ea4d40a0a6a1f9f5b94913af");
});
test("BLAKE3 raw value comparisons work", () => {
    const data1 = new TextEncoder().encode("Zeta sovereign DB");
    const data2 = new TextEncoder().encode("Zeta sovereign DB!");
    const h1 = ContentHash256.ofBytes(data1);
    const h2 = ContentHash256.ofBytes(data1);
    const h3 = ContentHash256.ofBytes(data2);
    expect(h1.equals(h2)).toBe(true);
    expect(h1.equals(h3)).toBe(false);
});
