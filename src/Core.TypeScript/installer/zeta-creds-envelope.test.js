// zeta-creds-envelope.test.ts — 081KSKBP80008QG0R003AX2A69.2a wire-format serializer tests.
import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "./zeta-creds-crypto";
import { HEADER_LEN, MAGIC, MIN_BLOB_LEN, decodeBundle, encodeBundle, parseEnvelope, serializeEnvelope, } from "./zeta-creds-envelope";
const UUID = "test-uuid-1234-5678-90ab";
const PASS = "test-passphrase";
describe("serializeEnvelope + parseEnvelope round-trip", () => {
    it("serializes + parses a small envelope", () => {
        const env = {
            salt: randomBytes(32),
            iv: randomBytes(12),
            tag: randomBytes(16),
            ciphertext: Buffer.from("hello world", "utf8"),
        };
        const blob = serializeEnvelope(env);
        const parsed = parseEnvelope(blob);
        if (!("salt" in parsed))
            throw new Error(`unexpected error: ${parsed.error}`);
        expect(Buffer.from(parsed.salt).equals(Buffer.from(env.salt))).toBe(true);
        expect(Buffer.from(parsed.iv).equals(Buffer.from(env.iv))).toBe(true);
        expect(Buffer.from(parsed.tag).equals(Buffer.from(env.tag))).toBe(true);
        expect(Buffer.from(parsed.ciphertext).equals(Buffer.from(env.ciphertext))).toBe(true);
    });
    it("round-trips with actual encrypt() output", () => {
        const plaintext = Buffer.from("real cred data");
        const env = encrypt(plaintext, UUID, PASS);
        const blob = serializeEnvelope(env);
        const parsed = parseEnvelope(blob);
        if (!("salt" in parsed))
            throw new Error(`unexpected error: ${parsed.error}`);
        // Decrypt round-trip via the parsed envelope
        const decrypted = decrypt(parsed, UUID, PASS);
        if ("error" in decrypted)
            throw new Error(`decrypt failed: ${decrypted.error}`);
        expect(decrypted.equals(plaintext)).toBe(true);
    });
    it("emits canonical magic header bytes", () => {
        const env = encrypt(Buffer.from("x"), UUID, PASS);
        const blob = serializeEnvelope(env);
        expect(blob.subarray(0, 4).equals(MAGIC)).toBe(true);
        expect(blob.subarray(0, 4).toString("ascii")).toBe("ZCV1");
    });
    it("reserved bytes are zero", () => {
        const env = encrypt(Buffer.from("x"), UUID, PASS);
        const blob = serializeEnvelope(env);
        expect(blob.readUInt32LE(4)).toBe(0);
    });
});
describe("parseEnvelope — error paths", () => {
    it("rejects too-small blob", () => {
        const result = parseEnvelope(Buffer.alloc(10));
        expect("error" in result).toBe(true);
    });
    it("rejects wrong magic", () => {
        const blob = Buffer.alloc(MIN_BLOB_LEN + 100);
        blob.write("XXXX", 0, 4, "ascii");
        const result = parseEnvelope(blob);
        if (!("error" in result))
            throw new Error("expected error");
        expect(result.error).toContain("magic");
    });
    it("rejects truncated salt", () => {
        const env = encrypt(Buffer.from("x"), UUID, PASS);
        const blob = serializeEnvelope(env);
        const truncated = blob.subarray(0, HEADER_LEN + 2 + 16); // header + salt-len + half salt
        const result = parseEnvelope(truncated);
        expect("error" in result).toBe(true);
    });
    it("rejects trailing bytes beyond ciphertext", () => {
        const env = encrypt(Buffer.from("x"), UUID, PASS);
        const blob = Buffer.concat([serializeEnvelope(env), Buffer.from("extra")]);
        const result = parseEnvelope(blob);
        if (!("error" in result))
            throw new Error("expected error");
        expect(result.error).toContain("trailing");
    });
});
describe("encodeBundle + decodeBundle round-trip", () => {
    it("round-trips empty bundle", () => {
        const bundle = { schemaVersion: 1, globalCreds: {}, personaCreds: {} };
        const encoded = encodeBundle(bundle);
        const decoded = decodeBundle(encoded);
        if ("error" in decoded)
            throw new Error(decoded.error);
        expect(Object.keys(decoded.globalCreds).length).toBe(0);
        expect(Object.keys(decoded.personaCreds).length).toBe(0);
    });
    it("round-trips bundle with global + persona creds", () => {
        const bundle = {
            schemaVersion: 1,
            globalCreds: {
                "gh-cli": Buffer.from("TEST-NOT-A-REAL-TOKEN-abc"),
                "ssh-operator-pubkey": Buffer.from("ssh-ed25519 AAAAxxx test@host"),
            },
            personaCreds: {
                otto: {
                    claude: Buffer.from('{"creds":"opaque"}'),
                    gemini: Buffer.from('{"oauth":"opaque"}'),
                },
                lior: {
                    gemini: Buffer.from('{"oauth":"diff"}'),
                },
            },
        };
        const encoded = encodeBundle(bundle);
        const decoded = decodeBundle(encoded);
        if ("error" in decoded)
            throw new Error(decoded.error);
        expect(decoded.globalCreds["gh-cli"].equals(bundle.globalCreds["gh-cli"])).toBe(true);
        expect(decoded.globalCreds["ssh-operator-pubkey"].equals(bundle.globalCreds["ssh-operator-pubkey"])).toBe(true);
        expect(decoded.personaCreds.otto.claude.equals(bundle.personaCreds.otto.claude)).toBe(true);
        expect(decoded.personaCreds.otto.gemini.equals(bundle.personaCreds.otto.gemini)).toBe(true);
        expect(decoded.personaCreds.lior.gemini.equals(bundle.personaCreds.lior.gemini)).toBe(true);
    });
    it("preserves binary content (non-utf8 bytes)", () => {
        const bytes = randomBytes(256);
        const bundle = {
            schemaVersion: 1,
            globalCreds: { binary: bytes },
            personaCreds: {},
        };
        const encoded = encodeBundle(bundle);
        const decoded = decodeBundle(encoded);
        if ("error" in decoded)
            throw new Error(decoded.error);
        expect(decoded.globalCreds.binary.equals(bytes)).toBe(true);
    });
});
describe("decodeBundle — error paths", () => {
    it("rejects malformed JSON", () => {
        expect("error" in decodeBundle(Buffer.from("not json {{"))).toBe(true);
    });
    it("rejects wrong schemaVersion", () => {
        const result = decodeBundle(Buffer.from(JSON.stringify({ schemaVersion: 99, globalCreds: {}, personaCreds: {} })));
        expect("error" in result).toBe(true);
    });
    it("rejects missing globalCreds", () => {
        const result = decodeBundle(Buffer.from(JSON.stringify({ schemaVersion: 1, personaCreds: {} })));
        expect("error" in result).toBe(true);
    });
    it("rejects non-string values in globalCreds", () => {
        const result = decodeBundle(Buffer.from(JSON.stringify({ schemaVersion: 1, globalCreds: { x: 42 }, personaCreds: {} })));
        expect("error" in result).toBe(true);
    });
    it("rejects non-object input", () => {
        expect("error" in decodeBundle(Buffer.from("[]"))).toBe(true);
        expect("error" in decodeBundle(Buffer.from("null"))).toBe(true);
        expect("error" in decodeBundle(Buffer.from('"string"'))).toBe(true);
    });
});
describe("full pipeline — bundle → encode → encrypt → serialize → parse → decrypt → decode", () => {
    it("round-trips through all layers", () => {
        const original = {
            schemaVersion: 1,
            globalCreds: {
                "gh-cli": Buffer.from("test-token-value"),
            },
            personaCreds: {
                otto: { claude: Buffer.from('{"k":"v"}') },
            },
        };
        // bundle → encoded plaintext
        const plaintext = encodeBundle(original);
        // plaintext → encrypted envelope
        const env = encrypt(plaintext, UUID, PASS);
        // envelope → wire blob
        const blob = serializeEnvelope(env);
        // === simulating disk round-trip ===
        // wire blob → envelope
        const parsedEnv = parseEnvelope(blob);
        if (!("salt" in parsedEnv))
            throw new Error(parsedEnv.error);
        // envelope → decrypted plaintext
        const decrypted = decrypt(parsedEnv, UUID, PASS);
        if ("error" in decrypted)
            throw new Error(decrypted.error);
        // plaintext → bundle
        const decoded = decodeBundle(decrypted);
        if ("error" in decoded)
            throw new Error(decoded.error);
        expect(decoded.globalCreds["gh-cli"].equals(original.globalCreds["gh-cli"])).toBe(true);
        expect(decoded.personaCreds.otto.claude.equals(original.personaCreds.otto.claude)).toBe(true);
    });
});
