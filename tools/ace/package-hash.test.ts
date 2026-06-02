import { describe, expect, test } from "bun:test";
import { packageHash } from "./package-hash.ts";
import type { AcePackage } from "./store.ts";

const base: AcePackage = {
  manifest: { format_version: 1, name: "x", version: "1.0.0", content_hash: "sha256:deadbeef" },
  files: { "a.txt": "a" },
};

describe("packageHash", () => {
  test("sha256:<hex> form", () => {
    expect(packageHash(base)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("deterministic + key-order-independent", () => {
    const reordered: AcePackage = {
      manifest: { version: "1.0.0", content_hash: "sha256:deadbeef", name: "x", format_version: 1 },
      files: { "a.txt": "a" },
    };
    expect(packageHash(reordered)).toBe(packageHash(base));
  });

  test("EXCLUDES signature — adding a signature does not change the hash", () => {
    const signed: AcePackage = {
      manifest: { ...base.manifest, signature: { algo: "ed25519", key_id: "ed25519:abcd", sig: "AAAA" } },
      files: base.files,
    };
    expect(packageHash(signed)).toBe(packageHash(base));
  });

  test("EXCLUDES signature — two different signatures yield the same hash", () => {
    const sigA: AcePackage = { manifest: { ...base.manifest, signature: { algo: "ed25519", key_id: "ed25519:aaaa", sig: "AAAA" } }, files: base.files };
    const sigB: AcePackage = { manifest: { ...base.manifest, signature: { algo: "ed25519", key_id: "ed25519:bbbb", sig: "BBBB" } }, files: base.files };
    expect(packageHash(sigA)).toBe(packageHash(sigB));
  });

  test("content change DOES change the hash", () => {
    const diffVersion: AcePackage = { manifest: { ...base.manifest, version: "2.0.0" }, files: base.files };
    expect(packageHash(diffVersion)).not.toBe(packageHash(base));
    const diffFiles: AcePackage = { manifest: base.manifest, files: { "a.txt": "b" } };
    expect(packageHash(diffFiles)).not.toBe(packageHash(base));
  });

  test("dependencies are part of the identity", () => {
    const withDeps: AcePackage = {
      manifest: { ...base.manifest, dependencies: [{ kind: "registry" as const, name: "dep", version: "^1.0.0" }] },
      files: base.files,
    };
    expect(packageHash(withDeps)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(packageHash(withDeps)).not.toBe(packageHash(base));
  });

  test("throws (via toTagged) on a non-safe-integer or lone-surrogate field", () => {
    const floatPkg = { manifest: { ...base.manifest, bogus: 1.5 }, files: base.files } as unknown as AcePackage;
    expect(() => packageHash(floatPkg)).toThrow();
    const surrPkg = { manifest: { ...base.manifest, bogus: "\uD800" }, files: base.files } as unknown as AcePackage;
    expect(() => packageHash(surrPkg)).toThrow();
  });
});
