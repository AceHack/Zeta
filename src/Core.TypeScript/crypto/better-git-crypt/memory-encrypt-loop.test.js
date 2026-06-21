/**
 * tools/crypto/better-git-crypt/memory-encrypt-loop.test.ts
 *
 * The load-bearing property: a folder of plaintext self-encrypts to `.zc` and each
 * `.zc` decrypts back to the EXACT input bytes with the SAME secret bundle (only the
 * secret-bundle holder, as sender/self-recipient, can decrypt). Plus listing/naming/
 * skip behavior.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { generateKeyPairJSON, deserializeSecretBundle, decryptBytes, } from "./files";
import { listInputs, outPathFor, encryptDir } from "./memory-encrypt-loop";
let root;
let inDir;
let outDir;
let self;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "mem-enc-loop-"));
    inDir = join(root, "in");
    outDir = join(root, "out");
    mkdirSync(inDir, { recursive: true });
    self = deserializeSecretBundle(generateKeyPairJSON("owner@test").secret);
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});
describe("listInputs / outPathFor", () => {
    test("lists only matching extension, sorted; ignores non-.txt", () => {
        writeFileSync(join(inDir, "b.txt"), "b");
        writeFileSync(join(inDir, "a.txt"), "a");
        writeFileSync(join(inDir, "note.md"), "x");
        expect(listInputs(inDir).map((p) => basename(p))).toEqual(["a.txt", "b.txt"]);
    });
    test("outPathFor strips inExt and appends .zc, preserving the name", () => {
        const out = outPathFor(join("x", "drop", "memory-foo.txt"), join("x", "out"));
        expect(basename(out)).toBe("memory-foo.zc");
    });
    test("missing input dir → empty list (no throw)", () => {
        expect(listInputs(join(root, "nope"))).toEqual([]);
    });
});
describe("encryptDir — self-encrypt round-trip", () => {
    test("each .zc decrypts back to EXACT input bytes (byte-for-byte)", () => {
        const samples = {
            "plain.txt": new TextEncoder().encode("the word told me to do it"),
            "binary.txt": new Uint8Array([0, 1, 2, 255, 254, 10, 13, 0]),
            "unicode.txt": new TextEncoder().encode("μένω — what remains 🜂"),
        };
        for (const [name, bytes] of Object.entries(samples))
            writeFileSync(join(inDir, name), bytes);
        const res = encryptDir(self, inDir, outDir, {});
        expect(res.errors).toEqual([]);
        expect(res.encrypted).toHaveLength(3);
        for (const e of res.encrypted) {
            expect(existsSync(e.out)).toBe(true);
            const dec = decryptBytes(readFileSync(e.out), self); // sender = self (self-encrypted)
            expect(dec.ok).toBe(true);
            if (dec.ok) {
                const original = samples[basename(e.in)];
                expect(Array.from(dec.plaintext)).toEqual(Array.from(original));
            }
        }
    });
    test("only the holder of the secret bundle can decrypt (a different key fails)", () => {
        writeFileSync(join(inDir, "secret.txt"), "private");
        const res = encryptDir(self, inDir, outDir, {});
        expect(res.encrypted).toHaveLength(1);
        const other = deserializeSecretBundle(generateKeyPairJSON("other@test").secret);
        const dec = decryptBytes(readFileSync(res.encrypted[0].out), other);
        expect(dec.ok).toBe(false);
    });
    test("existing .zc is skipped unless --force", () => {
        writeFileSync(join(inDir, "m.txt"), "v1");
        const first = encryptDir(self, inDir, outDir, {});
        expect(first.encrypted).toHaveLength(1);
        const second = encryptDir(self, inDir, outDir, {});
        expect(second.encrypted).toHaveLength(0);
        expect(second.skipped).toHaveLength(1);
        const forced = encryptDir(self, inDir, outDir, { force: true });
        expect(forced.encrypted).toHaveLength(1);
    });
    test("creates the out dir if missing", () => {
        writeFileSync(join(inDir, "m.txt"), "v");
        const deepOut = join(outDir, "persona", "owner");
        expect(existsSync(deepOut)).toBe(false);
        const res = encryptDir(self, inDir, deepOut, {});
        expect(res.encrypted).toHaveLength(1);
        expect(existsSync(deepOut)).toBe(true);
    });
});
