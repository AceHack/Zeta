/**
 * tools/crypto/better-git-crypt/dynamic-value.test.ts
 *
 * B-0883 × B-0982 — privacy-face codec tests. Verifies the fence property
 * (decryptValue(encryptValue(v)) ≡ v at VALUE identity, even though the .zc
 * bytes differ every call) across every Tagged variant + nested, plus the two
 * failure channels (crypto feedback vs decode error).
 */
import { describe, expect, test } from "bun:test";
import { encryptValue, decryptValue } from "./dynamic-value";
import { encryptBytes, generateKeyPairJSON, deserializeSecretBundle } from "./files";
import { f64ToBitsHex } from "../../dynamic-value/cbor";
function selfFrom(identity) {
    return deserializeSecretBundle(generateKeyPairJSON(identity).secret);
}
// A value exercising every Tagged variant (null/bool/int/float/str/bytes/arr/obj) + nesting.
const RICH = {
    t: "obj",
    v: [
        ["nul", { t: "null" }],
        ["yes", { t: "bool", v: true }],
        ["n", { t: "int", v: "-9223372036854775808" }], // i64 min — exact decimal string
        ["pi", { t: "float", v: f64ToBitsHex(Math.PI) }], // float v = f64 bit-pattern hex
        ["who", { t: "str", v: "μένω — the seed that remains" }],
        ["raw", { t: "bytes", v: "000102ff" }], // bytes v = lowercase hex
        ["list", { t: "arr", v: [{ t: "int", v: "1" }, { t: "int", v: "2" }] }],
        ["nested", { t: "obj", v: [["deep", { t: "str", v: "knot" }]] }],
    ],
};
describe("better-git-crypt dynamic-value.ts — privacy face round-trip", () => {
    test("the fence preserves VALUE identity across every Tagged variant", () => {
        const self = selfFrom("aaron@zeta");
        const enc = encryptValue(RICH, self);
        expect(enc.ok).toBe(true);
        if (!enc.ok)
            return;
        const dec = decryptValue(enc.envelopeBytes, self);
        expect(dec.ok).toBe(true);
        if (!dec.ok)
            return;
        expect(dec.value).toEqual(RICH);
    });
    test.each([
        ["null", { t: "null" }],
        ["bool", { t: "bool", v: false }],
        ["int", { t: "int", v: "42" }],
        ["float", { t: "float", v: f64ToBitsHex(0.5) }],
        ["str", { t: "str", v: "" }],
        ["bytes", { t: "bytes", v: "" }],
        ["empty arr", { t: "arr", v: [] }],
        ["empty obj", { t: "obj", v: [] }],
    ])("round-trips a top-level %s", (_label, value) => {
        const self = selfFrom("v@zeta");
        const enc = encryptValue(value, self);
        expect(enc.ok).toBe(true);
        if (!enc.ok)
            return;
        const dec = decryptValue(enc.envelopeBytes, self);
        expect(dec.ok).toBe(true);
        if (!dec.ok)
            return;
        expect(dec.value).toEqual(value);
    });
    test("privacy fence: bytes DIFFER each call (nonce), VALUE is identical", () => {
        const self = selfFrom("fence@zeta");
        const a = encryptValue(RICH, self);
        const b = encryptValue(RICH, self);
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok)
            return;
        // ciphertext is nonce-non-deterministic → the .zc bytes are NOT equal
        expect(Buffer.from(a.envelopeBytes).equals(Buffer.from(b.envelopeBytes))).toBe(false);
        // ...but both decrypt to the exact same value (the deterministic inner)
        const da = decryptValue(a.envelopeBytes, self);
        const db = decryptValue(b.envelopeBytes, self);
        expect(da.ok && db.ok).toBe(true);
        if (!da.ok || !db.ok)
            return;
        expect(da.value).toEqual(RICH);
        expect(db.value).toEqual(RICH);
    });
});
describe("better-git-crypt dynamic-value.ts — multi-recipient + fail-closed", () => {
    test("an extra recipient can also recover the value", () => {
        const sender = selfFrom("sender@zeta");
        const other = selfFrom("other@zeta");
        const enc = encryptValue(RICH, sender, [other.pub]);
        expect(enc.ok).toBe(true);
        if (!enc.ok)
            return;
        const dec = decryptValue(enc.envelopeBytes, other, sender.pub.publicSigKey);
        expect(dec.ok).toBe(true);
        if (!dec.ok)
            return;
        expect(dec.value).toEqual(RICH);
    });
    test("wrong key fails on the crypto channel (feedback), not decode", () => {
        const owner = selfFrom("owner@zeta");
        const stranger = selfFrom("stranger@zeta");
        const enc = encryptValue(RICH, owner);
        expect(enc.ok).toBe(true);
        if (!enc.ok)
            return;
        const dec = decryptValue(enc.envelopeBytes, stranger, owner.pub.publicSigKey);
        expect(dec.ok).toBe(false);
        if (dec.ok)
            return;
        expect("feedback" in dec).toBe(true);
    });
    test("a non-CBOR plaintext surfaces on the decode channel, not crypto", () => {
        // Encrypt RAW bytes that are not canonical CBOR, then decode-as-value.
        const self = selfFrom("raw@zeta");
        const enc = encryptBytes(new TextEncoder().encode("not cbor at all — plain text"), self);
        expect(enc.ok).toBe(true);
        if (!enc.ok)
            return;
        const dec = decryptValue(enc.envelopeBytes, self);
        expect(dec.ok).toBe(false);
        if (dec.ok)
            return;
        expect("decodeError" in dec).toBe(true);
    });
});
