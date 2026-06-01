import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync, closeSync, openSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs, main } from "./ace.ts";
import { listInstalled, contentHash } from "./store.ts";
import { generateKeypair, signManifest } from "./signing.ts";

// ---- Trust-path isolation: redirect ~/.ace to a temp dir in every test ----
let savedHome: string | undefined;
let savedUserProfile: string | undefined;
let tempHome: string;

beforeEach(() => {
  savedHome = process.env.HOME;
  savedUserProfile = process.env.USERPROFILE;
  tempHome = mkdtempSync(join(tmpdir(), "ace-test-home-"));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
});

afterEach(() => {
  if (savedHome !== undefined) process.env.HOME = savedHome;
  else delete process.env.HOME;
  if (savedUserProfile !== undefined) process.env.USERPROFILE = savedUserProfile;
  else delete process.env.USERPROFILE;
});

// ---- Helpers ----

/** Builds a real signed package file; returns paths + keypair info. */
function signedPkgFixture(files: Record<string, string> = { "a.txt": "hi" }) {
  const dir = mkdtempSync(join(tmpdir(), "ace-s3-"));
  const kp = generateKeypair();
  const filesJson = JSON.stringify(files);
  const content_hash = contentHash(new TextEncoder().encode(filesJson));
  const manifest = { format_version: 1, name: "demo", version: "1.0.0", content_hash };
  const signature = signManifest(manifest, kp.privatePem);
  const pkg = { manifest: { ...manifest, signature }, files };
  const pkgPath = join(dir, "pkg.json");
  writeFileSync(pkgPath, JSON.stringify(pkg));
  return { dir, kp, pkgPath, content_hash };
}

/** Writes a .pub JSON file for the given keypair. Returns the path. */
function writePubFile(dir: string, kp: ReturnType<typeof generateKeypair>): string {
  const pubPath = join(dir, "key.pub");
  writeFileSync(pubPath, JSON.stringify({ algo: "ed25519", key_id: kp.keyId, public_key: kp.publicSpkiB64 }, null, 2));
  return pubPath;
}

// ---- parseArgs tests ----

describe("parseArgs", () => {
  test("no args returns help", () => {
    const result = parseArgs([]);
    expect(result).toEqual({ command: "help" });
  });

  test("--help returns help", () => {
    expect(parseArgs(["--help"])).toEqual({ command: "help" });
  });

  test("list with defaults", () => {
    const result = parseArgs(["list"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "list") {
      expect(result.json).toBe(false);
    }
  });

  test("list --json", () => {
    const result = parseArgs(["list", "--json"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "list") {
      expect(result.json).toBe(true);
    }
  });

  test("list --store custom-path", () => {
    const result = parseArgs(["list", "--store", "/tmp/ace-store"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "list") {
      expect(result.storePath).toBe("/tmp/ace-store");
    }
  });

  test("--store without path is an error", () => {
    const result = parseArgs(["list", "--store"]);
    expect("error" in result).toBe(true);
  });

  test("install requires a url/path argument", () => {
    const result = parseArgs(["install"]);
    expect("error" in result).toBe(true);
  });

  test("install <url> parses", () => {
    const result = parseArgs(["install", "https://example.com/p.json"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "install") {
      expect(result.source).toBe("https://example.com/p.json");
    }
  });

  test("install --allow-unsigned parses", () => {
    const result = parseArgs(["install", "pkg.json", "--allow-unsigned"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "install") {
      expect((result as { allowUnsigned: boolean }).allowUnsigned).toBe(true);
    }
  });

  test("verify requires a hash argument", () => {
    const result = parseArgs(["verify"]);
    expect("error" in result).toBe(true);
  });

  test("remove + inspect are still unimplemented", () => {
    for (const cmd of ["remove", "inspect"]) {
      expect("error" in parseArgs([cmd])).toBe(true);
    }
  });

  test("unknown command returns error", () => {
    const result = parseArgs(["bogus"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Unknown command");
    }
  });

  test("keygen parses (default out prefix)", () => {
    const result = parseArgs(["keygen"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.command).toBe("keygen");
  });

  test("keygen --out custom-prefix parses", () => {
    const result = parseArgs(["keygen", "--out", "mykey"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "keygen") {
      expect((result as { outPrefix: string }).outPrefix).toBe("mykey");
    }
  });

  test("sign <pkg> --key <keyfile> parses", () => {
    const result = parseArgs(["sign", "pkg.json", "--key", "key.pem"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.command).toBe("sign");
  });

  test("sign missing --key is an error", () => {
    const result = parseArgs(["sign", "pkg.json"]);
    expect("error" in result).toBe(true);
  });

  test("trust add <pubkey> parses", () => {
    const result = parseArgs(["trust", "add", "key.pub"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.command).toBe("trust");
  });

  test("trust list parses", () => {
    const result = parseArgs(["trust", "list"]);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.command).toBe("trust");
  });

  test("trust with no subcommand is an error", () => {
    expect("error" in parseArgs(["trust"])).toBe(true);
  });
});

// ---- listInstalled ----

describe("listInstalled", () => {
  test("returns empty array for nonexistent store", () => {
    const result = listInstalled("/tmp/ace-nonexistent-" + Date.now());
    expect(result).toEqual([]);
  });

  test("returns empty array when store path is a file", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const filePath = join(dir, "not-a-directory");
    closeSync(openSync(filePath, "w"));
    const result = listInstalled(filePath);
    expect(result).toEqual([]);
  });

  test("returns empty array when store directory is unreadable", () => {
    // Skip when running as root (chmod has no effect)
    if (process.getuid && process.getuid() === 0) return;
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    chmodSync(dir, 0o000);
    try {
      const result = listInstalled(dir);
      expect(result).toEqual([]);
    } finally {
      chmodSync(dir, 0o755);
    }
  });

  test("returns empty array for empty store", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("skips directories without manifest.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    mkdirSync(join(dir, "sha256-abc123"));
    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("reads valid manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const hash = "sha256-aabbccdd";
    const pkgDir = join(dir, hash);
    mkdirSync(pkgDir);
    const manifest = {
      format_version: 1,
      name: "test-package",
      version: "1.0.0",
      content_hash: "sha256:aabbccdd",
      description: "A test DLC",
    };
    writeFileSync(join(pkgDir, "manifest.json"), JSON.stringify(manifest));

    const result = listInstalled(dir);
    expect(result.length).toBe(1);
    const first = result[0]!;
    expect(first.hash).toBe(hash);
    expect(first.manifest.name).toBe("test-package");
    expect(first.manifest.description).toBe("A test DLC");
  });

  test("skips malformed manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "bad-pkg");
    mkdirSync(pkgDir);
    writeFileSync(join(pkgDir, "manifest.json"), "not json");

    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("skips manifests missing required fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "incomplete");
    mkdirSync(pkgDir);
    writeFileSync(join(pkgDir, "manifest.json"), JSON.stringify({ name: "x" }));

    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("skips manifests missing version field", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "no-version");
    mkdirSync(pkgDir);
    writeFileSync(
      join(pkgDir, "manifest.json"),
      JSON.stringify({ format_version: 1, name: "x", content_hash: "sha256:abc" }),
    );

    const result = listInstalled(dir);
    expect(result).toEqual([]);
  });

  test("sorts by name", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    for (const pair of [["h2", "zebra"], ["h1", "alpha"]]) {
      const pkgDir = join(dir, pair[0]!);
      mkdirSync(pkgDir);
      writeFileSync(
        join(pkgDir, "manifest.json"),
        JSON.stringify({
          format_version: 1,
          name: pair[1],
          version: "1.0.0",
          content_hash: `sha256:${pair[0]}`,
        }),
      );
    }

    const result = listInstalled(dir);
    expect(result.length).toBe(2);
    expect(result[0]!.manifest.name).toBe("alpha");
    expect(result[1]!.manifest.name).toBe("zebra");
  });
});

// ---- main ----

describe("main", () => {
  test("help returns 0", async () => {
    expect(await main(["help"])).toBe(0);
  });

  test("list on empty store returns 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    expect(await main(["list", "--store", dir])).toBe(0);
  });

  test("list --json on empty store returns 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    expect(await main(["list", "--store", dir, "--json"])).toBe(0);
  });

  test("unknown command returns 64", async () => {
    expect(await main(["bogus"])).toBe(64);
  });

  test("list with populated store returns 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-test-"));
    const pkgDir = join(dir, "sha256-test");
    mkdirSync(pkgDir);
    writeFileSync(
      join(pkgDir, "manifest.json"),
      JSON.stringify({
        format_version: 1,
        name: "demo-dlc",
        version: "0.1.0",
        content_hash: "sha256:test",
        description: "Demo package",
      }),
    );
    expect(await main(["list", "--store", dir])).toBe(0);
  });

  // ---- keygen ----

  test("keygen writes .key and .pub and exits 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-kg-"));
    const prefix = join(dir, "mykey");
    const code = await main(["keygen", "--out", prefix]);
    expect(code).toBe(0);
    expect(existsSync(prefix + ".key")).toBe(true);
    expect(existsSync(prefix + ".pub")).toBe(true);
  });

  test("keygen .key mode is 0o600 on POSIX (advisory on Windows)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-kg-"));
    const prefix = join(dir, "seckey");
    await main(["keygen", "--out", prefix]);
    if (process.platform !== "win32") {
      // POSIX: verify exact 0o600
      expect(statSync(prefix + ".key").mode & 0o777).toBe(0o600);
    } else {
      // Windows: just verify file exists (chmod is advisory)
      expect(existsSync(prefix + ".key")).toBe(true);
    }
  });

  test("keygen refuses to overwrite an existing .key and leaves file content unchanged", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-kg-"));
    const prefix = join(dir, "existkey");
    const keyPath = prefix + ".key";
    // Pre-create the .key with sentinel content at a permissive mode (simulating a stale file)
    writeFileSync(keyPath, "OLD", { mode: 0o644 });
    // Second keygen should refuse with exit 1
    const code = await main(["keygen", "--out", prefix]);
    expect(code).toBe(1);
    // The file must NOT have been overwritten — sentinel content must still be present
    const { readFileSync: rf } = require("node:fs");
    expect(rf(keyPath, "utf8")).toBe("OLD");
  });

  // ---- sign ----

  test("sign of a valid package writes signed output and exits 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-sign-"));
    // Build an unsigned package
    const files = { "hello.txt": "world" };
    const filesJson = JSON.stringify(files);
    const ch = contentHash(new TextEncoder().encode(filesJson));
    const pkg = { manifest: { format_version: 1, name: "t", version: "1.0.0", content_hash: ch }, files };
    const pkgPath = join(dir, "unsigned.json");
    writeFileSync(pkgPath, JSON.stringify(pkg));
    // Generate a key
    const kp = generateKeypair();
    const keyPath = join(dir, "k.key");
    writeFileSync(keyPath, kp.privatePem);
    const outPath = join(dir, "signed.json");
    const code = await main(["sign", pkgPath, "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    expect(existsSync(outPath)).toBe(true);
    const parsed = JSON.parse(require("node:fs").readFileSync(outPath, "utf8"));
    expect(parsed.manifest.signature).toBeDefined();
  });

  test("sign of a package with mismatched content_hash exits 1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-sign-"));
    const pkg = {
      manifest: { format_version: 1, name: "t", version: "1.0.0", content_hash: "sha256:WRONG" },
      files: { "a.txt": "hello" },
    };
    const pkgPath = join(dir, "bad.json");
    writeFileSync(pkgPath, JSON.stringify(pkg));
    const kp = generateKeypair();
    const keyPath = join(dir, "k.key");
    writeFileSync(keyPath, kp.privatePem);
    const code = await main(["sign", pkgPath, "--key", keyPath]);
    expect(code).toBe(1);
  });

  // ---- trust add + list ----

  test("trust add a .pub file then trust list shows it", async () => {
    const { dir, kp } = signedPkgFixture();
    const pubPath = writePubFile(dir, kp);
    const addCode = await main(["trust", "add", pubPath, "--label", "testkey"]);
    expect(addCode).toBe(0);
    const listCode = await main(["trust", "list"]);
    expect(listCode).toBe(0);
  });

  // ---- install authenticity gate ----

  test("install signed + trusted → exit 0 (integrity + authenticity verified)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath, kp, dir } = signedPkgFixture();
    // Trust the key
    const pubPath = writePubFile(dir, kp);
    await main(["trust", "add", pubPath]);
    // Install
    const code = await main(["install", pkgPath, "--store", store]);
    expect(code).toBe(0);
  });

  test("install bad-sig → exit 1", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath, kp, dir } = signedPkgFixture();
    // Write a package with tampered content_hash (after signing)
    const pkg = JSON.parse(require("node:fs").readFileSync(pkgPath, "utf8"));
    pkg.manifest.content_hash = "sha256:TAMPERED"; // but signature was over original
    const tamperedPath = join(dir, "tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(pkg));
    // Trust the key (so we get past untrusted-key, reach bad-signature)
    const pubPath = writePubFile(dir, kp);
    await main(["trust", "add", pubPath]);
    const code = await main(["install", tamperedPath, "--store", store]);
    expect(code).toBe(1);
  });

  test("install untrusted-key → exit 1 EVEN with --allow-unsigned", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath } = signedPkgFixture();
    // Do NOT trust the key
    const code = await main(["install", pkgPath, "--allow-unsigned", "--store", store]);
    expect(code).toBe(1);
  });

  test("install unsigned → exit 1 without --allow-unsigned", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const files = { "a.txt": "hi" };
    const filesJson = JSON.stringify(files);
    const ch = contentHash(new TextEncoder().encode(filesJson));
    const pkg = { manifest: { format_version: 1, name: "u", version: "1.0.0", content_hash: ch }, files };
    const dir = mkdtempSync(join(tmpdir(), "ace-u-"));
    const pkgPath = join(dir, "u.json");
    writeFileSync(pkgPath, JSON.stringify(pkg));
    expect(await main(["install", pkgPath, "--store", store])).toBe(1);
  });

  test("install unsigned → exit 0 with --allow-unsigned", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const files = { "a.txt": "hi" };
    const filesJson = JSON.stringify(files);
    const ch = contentHash(new TextEncoder().encode(filesJson));
    const pkg = { manifest: { format_version: 1, name: "u", version: "1.0.0", content_hash: ch }, files };
    const dir = mkdtempSync(join(tmpdir(), "ace-u-"));
    const pkgPath = join(dir, "u.json");
    writeFileSync(pkgPath, JSON.stringify(pkg));
    expect(await main(["install", pkgPath, "--allow-unsigned", "--store", store])).toBe(0);
  });

  test("install algo-tampered (signed+trusted, algo->none) - exit 1 (unsupported-algo, NOT allow-unsigned-overridable)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath, kp, dir } = signedPkgFixture();
    // Trust the key -- key IS trusted, but we tamper algo before installing
    const pubPath = writePubFile(dir, kp);
    await main(["trust", "add", pubPath]);
    // Read the package and tamper signature.algo
    const pkg = JSON.parse(require("node:fs").readFileSync(pkgPath, "utf8"));
    pkg.manifest.signature.algo = "none";
    const tamperedPath = join(dir, "algo-tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(pkg));
    // Should be refused even though key is trusted
    const code = await main(["install", tamperedPath, "--store", store]);
    expect(code).toBe(1);
  });

  test("install algo-tampered with --allow-unsigned - still exit 1 (unsupported-algo is never overridable)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath, kp, dir } = signedPkgFixture();
    // Trust the key
    const pubPath = writePubFile(dir, kp);
    await main(["trust", "add", pubPath]);
    // Tamper algo
    const pkg = JSON.parse(require("node:fs").readFileSync(pkgPath, "utf8"));
    pkg.manifest.signature.algo = "none";
    const tamperedPath = join(dir, "algo-tampered2.json");
    writeFileSync(tamperedPath, JSON.stringify(pkg));
    // --allow-unsigned must NOT override algorithm-confusion
    const code = await main(["install", tamperedPath, "--allow-unsigned", "--store", store]);
    expect(code).toBe(1);
  });
});
