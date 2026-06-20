import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, existsSync, readFileSync, statSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ContentHash256 } from "../blake3/blake3.ts";
import { contentHash, installPackage, validatePackagePaths, loadTrustStore, addTrustedKey, listTrustedKeys, trustStorePath, bundledRegistryPath, registryPath, loadRegistry, listRegistry, addRegistryEntry } from "./store.ts";

describe("contentHash", () => {
  test("blake3 of known bytes matches the blake3:<hex> form", () => {
    // blake3("hello") = ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f
    const h = contentHash(new TextEncoder().encode("hello"));
    expect(h).toBe("blake3:ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f");
  });

  test("empty input has the known empty-blake3", () => {
    const h = contentHash(new Uint8Array(0));
    expect(h).toBe("blake3:af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262");
  });
});

describe("installPackage", () => {
  // A package is a JSON file: { manifest: AceManifest, files: {relpath: contents} }.
  // content_hash is the blake3 of the canonical JSON of `files`.
  function makePkg(files: Record<string, string>, name = "demo") {
    const filesJson = JSON.stringify(files);
    const content_hash =
      "blake3:" + ContentHash256.ofBytes(new TextEncoder().encode(filesJson)).toHex();
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

  test("installPackage ignores a manifest's dependencies field (leaf back-compat)", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const files = { "r.txt": "hi" };
    const content_hash = "blake3:" + ContentHash256.ofBytes(new TextEncoder().encode(JSON.stringify(files))).toHex();
    const pkg = {
      manifest: {
        format_version: 1, name: "demo", version: "1.0.0", content_hash,
        dependencies: [{ kind: "inline" as const, name: "x", version: "1.0.0", url: "http://e/x.json", package_hash: "blake3:0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20" }],
      },
      files,
    };
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(true);
  });
});

describe("validatePackagePaths", () => {
  test("returns null for safe paths", () => {
    expect(validatePackagePaths({ manifest: { format_version: 1, name: "a", version: "1", content_hash: "x" }, files: { "ok.txt": "y" } })).toBeNull();
  });
  test("returns the offending path for '..' traversal", () => {
    expect(validatePackagePaths({ manifest: { format_version: 1, name: "a", version: "1", content_hash: "x" }, files: { "../escape": "y" } })).toBe("../escape");
  });
  test("returns the offending path for an absolute path", () => {
    expect(validatePackagePaths({ manifest: { format_version: 1, name: "a", version: "1", content_hash: "x" }, files: { "/etc/passwd": "y" } })).toBe("/etc/passwd");
  });
  test("returns the offending path for a Windows drive-absolute path", () => {
    expect(validatePackagePaths({ manifest: { format_version: 1, name: "a", version: "1", content_hash: "x" }, files: { "C:\\Windows\\system.ini": "y" } })).toBe("C:\\Windows\\system.ini");
  });
  test("returns the offending path for a Windows drive-relative path", () => {
    expect(validatePackagePaths({ manifest: { format_version: 1, name: "a", version: "1", content_hash: "x" }, files: { "C:evil": "y" } })).toBe("C:evil");
  });
});

describe("trust store", () => {
  test("loadTrustStore unions bundled + user; user overrides on key_id", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-"));
    const bundled = join(dir, "bundled.json");
    const user = join(dir, "user.json");
    writeFileSync(bundled, JSON.stringify([{ key_id: "ed25519:aaaa", public_key: "B", label: "root" }]));
    writeFileSync(user, JSON.stringify([
      { key_id: "ed25519:bbbb", public_key: "U", label: "mine" },
      { key_id: "ed25519:aaaa", public_key: "B2", label: "root-override" },
    ]));
    const m = loadTrustStore(bundled, user);
    expect(m.size).toBe(2);
    expect(m.get("ed25519:aaaa")?.source).toBe("user");      // user overrides bundled
    expect(m.get("ed25519:aaaa")?.public_key).toBe("B2");
    expect(m.get("ed25519:bbbb")?.source).toBe("user");
  });

  test("addTrustedKey creates the user file + dedups by key_id", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-"));
    const user = join(dir, "trusted-keys.json");
    expect(addTrustedKey({ key_id: "ed25519:cccc", public_key: "P" }, user).added).toBe(true);
    expect(addTrustedKey({ key_id: "ed25519:cccc", public_key: "P" }, user).added).toBe(false); // dedup
    expect(existsSync(user)).toBe(true);
  });

  test("listTrustedKeys reports source for each", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-"));
    const bundled = join(dir, "bundled.json");
    const user = join(dir, "user.json");
    writeFileSync(bundled, JSON.stringify([{ key_id: "ed25519:aaaa", public_key: "B" }]));
    writeFileSync(user, JSON.stringify([{ key_id: "ed25519:bbbb", public_key: "U" }]));
    const rows = listTrustedKeys(bundled, user);
    expect(rows.find((r) => r.key_id === "ed25519:aaaa")?.source).toBe("bundled");
    expect(rows.find((r) => r.key_id === "ed25519:bbbb")?.source).toBe("user");
  });

  test("trustStorePath is under ~/.ace", () => {
    expect(trustStorePath().replace(/\\/g, "/")).toMatch(/\.ace\/trusted-keys\.json$/);
  });

  test("addTrustedKey writes trust file with owner-only perms (0o600 on POSIX)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-perm-"));
    const user = join(dir, "trusted-keys.json");
    addTrustedKey({ key_id: "ed25519:perm1", public_key: "P" }, user);
    expect(existsSync(user)).toBe(true);
    if (process.platform !== "win32") {
      // POSIX: no group or other bits (owner-only 0o600)
      expect(statSync(user).mode & 0o077).toBe(0);
    } else {
      // Windows: chmod is advisory — just assert file exists
      expect(existsSync(user)).toBe(true);
    }
  });

  test("addTrustedKey corrects a pre-existing permissive trust file to 0o600 on POSIX", () => {
    if (process.platform === "win32") return; // chmod advisory on Windows; skip
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-fixperm-"));
    const user = join(dir, "trusted-keys.json");
    // Pre-create the trust file at a permissive mode simulating a bad umask
    writeFileSync(user, JSON.stringify([]), { mode: 0o644 });
    expect(statSync(user).mode & 0o077).not.toBe(0); // confirm it is permissive
    // addTrustedKey should correct it even on a pre-existing file
    addTrustedKey({ key_id: "ed25519:perm2", public_key: "P" }, user);
    expect(statSync(user).mode & 0o077).toBe(0);
  });

  // ---- Fix 2: dedup path repairs perms ----

  test("addTrustedKey repairs perms on the DEDUP path (pre-existing permissive file, same key → {added:false} AND mode 0o600)", () => {
    if (process.platform === "win32") {
      // chmod is advisory on Windows; just verify {added:false} is returned
      const dir = mkdtempSync(join(tmpdir(), "ace-trust-dedup-win-"));
      const user = join(dir, "trusted-keys.json");
      writeFileSync(user, JSON.stringify([{ key_id: "ed25519:dedup1", public_key: "P" }]));
      const result = addTrustedKey({ key_id: "ed25519:dedup1", public_key: "P" }, user);
      expect(result.added).toBe(false);
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-dedup-"));
    const user = join(dir, "trusted-keys.json");
    // Pre-create with the key already present AND a permissive mode
    writeFileSync(user, JSON.stringify([{ key_id: "ed25519:dedup1", public_key: "P" }]), { mode: 0o644 });
    expect(statSync(user).mode & 0o077).not.toBe(0); // confirm loose bits
    // Re-adding the same key → dedup early-return
    const result = addTrustedKey({ key_id: "ed25519:dedup1", public_key: "P" }, user);
    expect(result.added).toBe(false);
    // Perms must be repaired even on the dedup path
    expect(statSync(user).mode & 0o077).toBe(0);
  });


  test("addTrustedKey tightens a pre-existing permissive ~/.ace dir to 0o700 on POSIX", () => {
    const parent = mkdtempSync(join(tmpdir(), "ace-trustdir-"));
    const aceDir = join(parent, ".ace");
    mkdirSync(aceDir, { recursive: true });
    chmodSync(aceDir, 0o777); // force permissive despite umask
    const userPath = join(aceDir, "trusted-keys.json");
    const res = addTrustedKey({ key_id: "ed25519:dddd", public_key: "P" }, userPath);
    expect(res.added).toBe(true);
    if (process.platform !== "win32") {
      expect(statSync(aceDir).mode & 0o077).toBe(0); // dir tightened to owner-only
      expect(statSync(userPath).mode & 0o077).toBe(0); // file owner-only
    } else {
      console.log("[skip] POSIX dir-mode assertion not applicable on Windows; dir exists:", existsSync(aceDir));
    }
  });
});

describe("registry paths + empty load", () => {
  test("registryPath is under ~/.ace", () => {
    expect(registryPath().replace(/\\/g, "/")).toMatch(/\.ace\/registry\.json$/);
  });
  test("bundledRegistryPath ends in src/Core.TypeScript/ace/registry.json", () => {
    expect(bundledRegistryPath().replace(/\\/g, "/")).toMatch(/src\/Core\.TypeScript\/ace\/registry\.json$/);
  });
  test("loadRegistry on two missing files is an empty Map", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const m = loadRegistry(join(dir, "b.json"), join(dir, "u.json"));
    expect(m.size).toBe(0);
  });
});

describe("registry load + list", () => {
  test("loadRegistry unions bundled+user; user overrides on (name,version)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const b = join(dir, "b.json"); const u = join(dir, "u.json");
    writeFileSync(b, JSON.stringify({ libfoo: { "1.0.0": { url: "B", package_hash: "blake3:b" } } }));
    writeFileSync(u, JSON.stringify({ libfoo: { "1.0.0": { url: "U", package_hash: "blake3:u" }, "2.0.0": { url: "U2", package_hash: "blake3:u2" } } }));
    const m = loadRegistry(b, u);
    expect(m.get("libfoo")?.get("1.0.0")?.url).toBe("U");
    expect(m.get("libfoo")?.get("2.0.0")?.url).toBe("U2");
  });
  test("loadRegistry skips malformed entries (not fatal)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const u = join(dir, "u.json");
    writeFileSync(u, JSON.stringify({ libfoo: { "1.0.0": { url: "U" } }, libbar: "nope" }));
    const m = loadRegistry(join(dir, "missing.json"), u);
    expect(m.get("libfoo")?.has("1.0.0")).toBe(false);
    expect(m.has("libbar")).toBe(false);
  });
  test("listRegistry reports source per entry, user overriding bundled", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const b = join(dir, "b.json"); const u = join(dir, "u.json");
    writeFileSync(b, JSON.stringify({ a: { "1.0.0": { url: "B", package_hash: "blake3:b" } } }));
    writeFileSync(u, JSON.stringify({ a: { "1.0.0": { url: "U", package_hash: "blake3:u" } } }));
    const rows = listRegistry(b, u);
    const row = rows.find((r) => r.name === "a" && r.version === "1.0.0");
    expect(row?.source).toBe("user");
    expect(row?.url).toBe("U");
  });
});

describe("addRegistryEntry", () => {
  test("creates the user file + dedups by (name,version)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const u = join(dir, "registry.json");
    expect(addRegistryEntry("libfoo", "1.0.0", { url: "U", package_hash: "blake3:u" }, u).added).toBe(true);
    expect(addRegistryEntry("libfoo", "1.0.0", { url: "U", package_hash: "blake3:u" }, u).added).toBe(false);
    expect(loadRegistry(join(dir, "missing.json"), u).get("libfoo")?.get("1.0.0")?.url).toBe("U");
  });
  test("a second version of the same name is added (not a dedup)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const u = join(dir, "registry.json");
    addRegistryEntry("libfoo", "1.0.0", { url: "U1", package_hash: "blake3:u1" }, u);
    expect(addRegistryEntry("libfoo", "2.0.0", { url: "U2", package_hash: "blake3:u2" }, u).added).toBe(true);
    const m = loadRegistry(join(dir, "missing.json"), u);
    expect(m.get("libfoo")?.size).toBe(2);
  });
  test("re-add with DIFFERING url/hash overwrites stale pin (updated:true); identical re-add is a no-op (updated:false)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const u = join(dir, "registry.json");
    expect(addRegistryEntry("libfoo", "1.0.0", { url: "OLD", package_hash: "blake3:old" }, u)).toEqual({ added: true, updated: false });
    expect(addRegistryEntry("libfoo", "1.0.0", { url: "OLD", package_hash: "blake3:old" }, u)).toEqual({ added: false, updated: false }); // identical -> idempotent no-op
    expect(addRegistryEntry("libfoo", "1.0.0", { url: "NEW", package_hash: "blake3:new" }, u)).toEqual({ added: false, updated: true }); // corrected -> overwrite stale pin
    const e = loadRegistry(join(dir, "missing.json"), u).get("libfoo")?.get("1.0.0");
    expect(e?.url).toBe("NEW");
    expect(e?.package_hash).toBe("blake3:new");
  });
  test("a __proto__ / constructor package name does not pollute Object.prototype", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const u = join(dir, "registry.json");
    addRegistryEntry("__proto__", "9.9.9", { url: "U", package_hash: "blake3:u" }, u);
    addRegistryEntry("constructor", "9.9.9", { url: "U2", package_hash: "blake3:u2" }, u);
    // pollution would make every object carry a "9.9.9" property
    expect(({} as Record<string, unknown>)["9.9.9"]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call({}, "9.9.9")).toBe(false);
    // and the entries are still retrievable via the Map-based loader
    expect(loadRegistry(join(dir, "missing.json"), u).get("__proto__")?.get("9.9.9")?.url).toBe("U");
  });
  test("writes owner-only perms on POSIX (0600 file, 0700 dir)", () => {
    if (process.platform === "win32") return;
    const parent = mkdtempSync(join(tmpdir(), "ace-regperm-"));
    const aceDir = join(parent, ".ace");
    const u = join(aceDir, "registry.json");
    addRegistryEntry("a", "1.0.0", { url: "U", package_hash: "blake3:u" }, u);
    expect(statSync(u).mode & 0o077).toBe(0);
    expect(statSync(aceDir).mode & 0o077).toBe(0);
  });
});

import { readRegistriesConfig, writeRegistryRemote, removeRegistryRemote, registriesPath, registryCacheDir } from "./store.ts";

describe("remote-registry config", () => {
  let home: string, savedHome: string | undefined, savedUP: string | undefined;
  beforeEach(() => { savedHome = process.env.HOME; savedUP = process.env.USERPROFILE;
    home = mkdtempSync(join(tmpdir(), "ace-cfg-")); process.env.HOME = home; process.env.USERPROFILE = home; });
  afterEach(() => { if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
    if (savedUP !== undefined) process.env.USERPROFILE = savedUP; else delete process.env.USERPROFILE; });

  test("empty/missing → { remotes: [] }", () => { expect(readRegistriesConfig().remotes).toEqual([]); });
  test("add → read round-trips; key_id required", () => {
    writeRegistryRemote({ url: "https://r/index.json", key_id: "ed25519:abc" });
    expect(readRegistriesConfig().remotes).toEqual([{ url: "https://r/index.json", key_id: "ed25519:abc" }]);
  });
  test("add dedups by url (updated)", () => {
    writeRegistryRemote({ url: "https://r/index.json", key_id: "ed25519:abc" });
    const r = writeRegistryRemote({ url: "https://r/index.json", key_id: "ed25519:def", max_staleness_days: 7 });
    expect(r.updated).toBe(true);
    expect(readRegistriesConfig().remotes).toEqual([{ url: "https://r/index.json", key_id: "ed25519:def", max_staleness_days: 7 }]);
  });
  test("malformed entries dropped (no key_id)", () => {
    const p = registriesPath();
    require("node:fs").mkdirSync(require("node:path").dirname(p), { recursive: true });
    require("node:fs").writeFileSync(p, JSON.stringify({ remotes: [{ url: "https://r/x" }, { url: "https://r/y", key_id: "ed25519:k" }] }));
    expect(readRegistriesConfig().remotes).toEqual([{ url: "https://r/y", key_id: "ed25519:k" }]);
  });
  test("remove", () => {
    writeRegistryRemote({ url: "https://r/index.json", key_id: "ed25519:abc" });
    expect(removeRegistryRemote("https://r/index.json").removed).toBe(true);
    expect(readRegistriesConfig().remotes).toEqual([]);
    expect(removeRegistryRemote("https://nope").removed).toBe(false);
  });
  test("cacheDir under ~/.ace", () => { expect(registryCacheDir()).toBe(join(home, ".ace", "registry-cache")); });
  test("malformed key_id dropped (empty or wrong prefix)", () => {
    const p = registriesPath();
    require("node:fs").mkdirSync(require("node:path").dirname(p), { recursive: true });
    require("node:fs").writeFileSync(p, JSON.stringify({ remotes: [
      { url: "https://r/a", key_id: "" },
      { url: "https://r/b", key_id: "notprefixed" },
      { url: "https://r/c", key_id: "ed25519:ok" },
    ] }));
    expect(readRegistriesConfig().remotes).toEqual([{ url: "https://r/c", key_id: "ed25519:ok" }]);
  });
});
