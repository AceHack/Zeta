import { describe, expect, test } from "bun:test";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { contentHash, installPackage } from "./store.ts";

describe("contentHash", () => {
  test("sha256 of known bytes matches the sha256:<hex> form", () => {
    // sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const h = contentHash(new TextEncoder().encode("hello"));
    expect(h).toBe("sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  test("empty input has the known empty-sha256", () => {
    const h = contentHash(new Uint8Array(0));
    expect(h).toBe("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("installPackage", () => {
  // A package is a JSON file: { manifest: AceManifest, files: {relpath: contents} }.
  // content_hash is the sha256 of the canonical JSON of `files`.
  function makePkg(files: Record<string, string>, name = "demo") {
    const filesJson = JSON.stringify(files);
    const content_hash =
      "sha256:" + createHash("sha256").update(new TextEncoder().encode(filesJson)).digest("hex");
    return {
      pkg: { manifest: { format_version: 1, name, version: "1.0.0", content_hash }, files },
      content_hash,
    };
  }

  test("installs a package whose content_hash matches, extracting files under <store>/<hash>", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg, content_hash } = makePkg({ "readme.txt": "hi" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const dir = join(store, content_hash.replace(":", "-"));
      expect(existsSync(join(dir, "manifest.json"))).toBe(true);
      expect(readFileSync(join(dir, "readme.txt"), "utf8")).toBe("hi");
    }
  });

  test("rejects a package whose content_hash does NOT match the files (no extraction)", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg } = makePkg({ "a.txt": "x" });
    const tampered = { ...pkg, files: { "a.txt": "TAMPERED" } }; // hash no longer matches
    const result = installPackage(store, tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("content hash mismatch");
  });

  test("rejects a package with a '../' path-traversal file path", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg } = makePkg({ "../escape.txt": "x" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unsafe file path");
  });

  test("rejects a Windows-style '..\\' path-traversal file path", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg } = makePkg({ "..\\escape.txt": "x" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unsafe file path");
  });

  test("rejects an absolute POSIX path", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg } = makePkg({ "/etc/passwd": "x" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unsafe file path");
  });

  test("rejects an absolute Windows/UNC backslash path", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg } = makePkg({ "\\\\server\\share": "x" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unsafe file path");
  });

  test("traversal refusal is ATOMIC — a non-first bad path extracts NOTHING (store stays clean)", () => {
    // The bad path is not first: validate-all-before-extract must reject before the legit
    // file is written, so the hash dir must not exist at all after a refused install.
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg, content_hash } = makePkg({ "legit.txt": "ok", "../escape.txt": "x" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unsafe file path");
    // Nothing extracted: the hash dir was never created (no partial write of legit.txt).
    const dir = join(store, content_hash.replace(":", "-"));
    expect(existsSync(dir)).toBe(false);
  });
});
