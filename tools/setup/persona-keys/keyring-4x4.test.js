// Keyring 4x4 treaty conformance — the SERIALIZER axis.
//   COMMUTE   — JSON and CBOR decode to the SAME keyring (the 4x4 cross-serializer
//               agreement; mirrors dynamic-value/format-matrix.test.ts).
//   BYTE-LOCK — derived+serialized bytes match the golden vector exactly (the seed
//               the F#/C#/Rust oracles must replay).
//   ROUND-TRIP— decode(encode(x)) == x for each serializer.
//   DETERMINISM— re-derive+re-serialize is byte-identical (DST; full 1000x is in
//               keyring.dst1000.test.ts for derivation).
// Run: bun test keyring-4x4.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { keyring4x4, keyringToTagged, serializeKeyring, deserializeKeyring } from "./keyring-4x4.js";
import { deriveKeyring } from "./derive.js";
const HERE = new URL(".", import.meta.url).pathname;
const gv = JSON.parse(readFileSync(HERE + "golden-vectors-keyring.json", "utf8"));
const gv4 = JSON.parse(readFileSync(HERE + "golden-vectors-keyring-4x4.json", "utf8"));
const M = gv.input.mnemonic;
test("COMMUTE: JSON, CBOR and XML all decode the keyring to the same value", () => {
    const { json, cborHex, xml } = keyring4x4(M, "zeta");
    const { fromJson, fromCbor, fromXml } = deserializeKeyring(json, cborHex, xml);
    expect(fromJson.ok).toBe(true);
    expect(fromCbor.ok).toBe(true);
    expect(fromXml.ok).toBe(true);
    expect(JSON.stringify(fromJson)).toBe(JSON.stringify(fromCbor));
    expect(JSON.stringify(fromCbor)).toBe(JSON.stringify(fromXml));
});
test("BYTE-LOCK: serialized bytes match the golden vector (the treaty seed)", () => {
    const { json, cborHex, xml } = keyring4x4(M, "zeta");
    expect(json).toBe(gv4.expected.canonical_json);
    expect(cborHex).toBe(gv4.expected.canonical_cbor_hex);
    expect(xml).toBe(gv4.expected.canonical_xml);
});
test("ROUND-TRIP: decode(encode(keyring)) recovers the Tagged for all three serializers", () => {
    const tagged = keyringToTagged(deriveKeyring(M, "zeta").pub);
    const { json, cborHex, xml } = serializeKeyring(deriveKeyring(M, "zeta").pub);
    const { fromJson, fromCbor, fromXml } = deserializeKeyring(json, cborHex, xml);
    expect(fromJson.ok && JSON.stringify(fromJson.value)).toBe(JSON.stringify(tagged));
    expect(fromCbor.ok && JSON.stringify(fromCbor.value)).toBe(JSON.stringify(tagged));
    expect(fromXml.ok && JSON.stringify(fromXml.value)).toBe(JSON.stringify(tagged));
});
test("DETERMINISM: re-derive + re-serialize is byte-identical", () => {
    const a = keyring4x4(M, "zeta");
    const b = keyring4x4(M, "zeta");
    expect(a.json).toBe(b.json);
    expect(a.cborHex).toBe(b.cborHex);
    expect(a.xml).toBe(b.xml);
});
test("the golden CBOR hex is text (no binary in the proof lineage) + even-length hex", () => {
    expect(gv4.expected.canonical_cbor_hex).toMatch(/^[0-9a-f]*$/);
    expect(gv4.expected.canonical_cbor_hex.length % 2).toBe(0);
});
test("no private material leaks into any serialized form", () => {
    const { json, cborHex, xml } = keyring4x4(M, "zeta");
    for (const blob of [json, xml, JSON.stringify(deserializeKeyring(json, cborHex, xml))]) {
        expect(blob).not.toContain("nsec");
        expect(blob).not.toContain("privkey");
        expect(blob).not.toMatch(/BEGIN .*PRIVATE KEY/);
    }
});
