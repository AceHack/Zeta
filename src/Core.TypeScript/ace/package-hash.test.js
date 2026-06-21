import { describe, expect, test } from "bun:test";
import { packageHash, safePackageHash } from "./package-hash.js";
const base = {
    manifest: { format_version: 1, name: "x", version: "1.0.0", content_hash: "blake3:deadbeef00000000000000000000000000000000000000000000000000000000" },
    files: { "a.txt": "a" },
};
describe("packageHash", () => {
    test("blake3:<hex> form", () => {
        expect(packageHash(base)).toMatch(/^blake3:[0-9a-f]{64}$/);
    });
    test("deterministic + key-order-independent", () => {
        const reordered = {
            manifest: { version: "1.0.0", content_hash: "blake3:deadbeef00000000000000000000000000000000000000000000000000000000", name: "x", format_version: 1 },
            files: { "a.txt": "a" },
        };
        expect(packageHash(reordered)).toBe(packageHash(base));
    });
    test("EXCLUDES signature — adding a signature does not change the hash", () => {
        const signed = {
            manifest: { ...base.manifest, signature: { algo: "ed25519", key_id: "ed25519:abcd", sig: "AAAA" } },
            files: base.files,
        };
        expect(packageHash(signed)).toBe(packageHash(base));
    });
    test("EXCLUDES signature — two different signatures yield the same hash", () => {
        const sigA = { manifest: { ...base.manifest, signature: { algo: "ed25519", key_id: "ed25519:aaaa", sig: "AAAA" } }, files: base.files };
        const sigB = { manifest: { ...base.manifest, signature: { algo: "ed25519", key_id: "ed25519:bbbb", sig: "BBBB" } }, files: base.files };
        expect(packageHash(sigA)).toBe(packageHash(sigB));
    });
    test("content change DOES change the hash", () => {
        const diffVersion = { manifest: { ...base.manifest, version: "2.0.0" }, files: base.files };
        expect(packageHash(diffVersion)).not.toBe(packageHash(base));
        const diffFiles = { manifest: base.manifest, files: { "a.txt": "b" } };
        expect(packageHash(diffFiles)).not.toBe(packageHash(base));
    });
    test("dependencies are part of the identity", () => {
        const withDeps = {
            manifest: { ...base.manifest, dependencies: [{ kind: "registry", name: "dep", version: "^1.0.0" }] },
            files: base.files,
        };
        expect(packageHash(withDeps)).toMatch(/^blake3:[0-9a-f]{64}$/);
        expect(packageHash(withDeps)).not.toBe(packageHash(base));
    });
    test("throws (via toTagged) on a non-safe-integer or lone-surrogate field", () => {
        const floatPkg = { manifest: { ...base.manifest, bogus: 1.5 }, files: base.files };
        expect(() => packageHash(floatPkg)).toThrow();
        const surrPkg = { manifest: { ...base.manifest, bogus: "\uD800" }, files: base.files };
        expect(() => packageHash(surrPkg)).toThrow();
    });
});
describe("safePackageHash", () => {
    test("well-formed package: { ok: true, hash } matching packageHash", () => {
        const r = safePackageHash(base);
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(r.hash).toBe(packageHash(base));
    });
    test("float field: { ok: false } with a safe-integer reason (no throw)", () => {
        const floatPkg = { manifest: { ...base.manifest, bogus: 1.5 }, files: base.files };
        const r = safePackageHash(floatPkg);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toMatch(/safe integer/);
    });
    test("lone-surrogate field: { ok: false } with a lone-surrogate reason (no throw)", () => {
        const surrPkg = { manifest: { ...base.manifest, bogus: "\uD800" }, files: base.files };
        const r = safePackageHash(surrPkg);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toMatch(/lone surrogate/);
    });
});
