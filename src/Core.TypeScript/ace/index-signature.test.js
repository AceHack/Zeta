import { describe, expect, test } from "bun:test";
import { generateKeypair } from "./signing.js";
import { signIndex, verifyIndexSignature } from "./index-signature.js";
const indexContent = {
    format_version: 1, sequence: 3, issued_at: "2026-06-01T12:00:00Z",
    packages: { leaf: { "1.0.0": { url: "https://x/leaf-1.0.0.json", package_hash: "blake3:aa" } } },
};
describe("index signing", () => {
    test("sign + verify round-trips against a trusted key", () => {
        const kp = generateKeypair();
        const sig = signIndex(indexContent, kp.privatePem);
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const r = verifyIndexSignature(indexContent, sig, trust);
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(r.key_id).toBe(kp.keyId);
    });
    test("untrusted key → untrusted-key", () => {
        const kp = generateKeypair();
        const sig = signIndex(indexContent, kp.privatePem);
        const r = verifyIndexSignature(indexContent, sig, new Map());
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("untrusted-key");
    });
    test("tampered content → bad-signature", () => {
        const kp = generateKeypair();
        const sig = signIndex(indexContent, kp.privatePem);
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const tampered = { ...indexContent, sequence: 4 };
        const r = verifyIndexSignature(tampered, sig, trust);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("bad-signature");
    });
    test("tampered sig → bad-signature", () => {
        const kp = generateKeypair();
        const sig = signIndex(indexContent, kp.privatePem);
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const badSig = { ...sig, sig: sig.sig.slice(0, -4) + (sig.sig.endsWith("AAAA") ? "BBBB" : "AAAA") };
        const r = verifyIndexSignature(indexContent, badSig, trust);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("bad-signature");
    });
    test("non-ed25519 algo → unsupported-algo", () => {
        const kp = generateKeypair();
        const sig = { ...signIndex(indexContent, kp.privatePem), algo: "rsa" };
        const r = verifyIndexSignature(indexContent, sig, new Map());
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("unsupported-algo");
    });
});
