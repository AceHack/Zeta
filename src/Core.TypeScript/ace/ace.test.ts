import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, closeSync, openSync, statSync, existsSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { generateKeyPairSync, createHash } from "node:crypto";
import { parseArgs, main } from "./ace.ts";
import { listInstalled, contentHash, listTrustedKeys, loadRegistry } from "./store.ts";
import { readRegistriesConfig } from "./store.ts";
import { generateKeypair, signManifest } from "./signing.ts";
import { generateKeypair as gkpA } from "./signing.ts";
import { signIndex as sidxA } from "./index-signature.ts";
import { packageHash } from "./package-hash.ts";
import { parseLockfile } from "./lockfile.ts";
import { parseIndex } from "./registry-remote.ts";

/** Read an index file + parseIndex it, throwing on a parse error (test ergonomics). */
function readIndexFile(path: string) {
  const doc = parseIndex(readFileSync(path, "utf8"));
  if ("error" in doc) throw new Error(`readIndexFile: ${doc.error}`);
  return doc;
}

// ---- Trust-path isolation: redirect ~/.ace to a temp dir in every test ----
let savedHome: string | undefined;
let savedUserProfile: string | undefined;
let savedCwd: string | undefined;
let tempHome: string;

beforeEach(() => {
  savedHome = process.env.HOME;
  savedUserProfile = process.env.USERPROFILE;
  tempHome = mkdtempSync(join(tmpdir(), "ace-test-home-"));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  savedCwd = process.cwd();
  process.chdir(tempHome);
});

afterEach(() => {
  if (savedCwd !== undefined) process.chdir(savedCwd);
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

  test("install --allow-no-signature parses", () => {
    const result = parseArgs(["install", "pkg.json", "--allow-no-signature"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "install") {
      expect((result as { allowNoSignature: boolean }).allowNoSignature).toBe(true);
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

describe("parseArgs — install lockfile flags", () => {
  test("--frozen defaults off; sets frozen + default lockfile path", () => {
    const a = parseArgs(["install", "pkg.json"]);
    expect("command" in a && a.command === "install").toBe(true);
    if ("command" in a && a.command === "install") {
      expect(a.frozen).toBe(false);
      expect(a.lockfile).toBe("ace.lock");
    }
  });
  test("--frozen sets frozen true", () => {
    const a = parseArgs(["install", "pkg.json", "--frozen"]);
    if ("command" in a && a.command === "install") expect(a.frozen).toBe(true);
  });
  test("--lockfile <path> overrides", () => {
    const a = parseArgs(["install", "pkg.json", "--lockfile", "custom.lock"]);
    if ("command" in a && a.command === "install") expect(a.lockfile).toBe("custom.lock");
  });
  test("--lockfile without a path is an error", () => {
    const a = parseArgs(["install", "pkg.json", "--lockfile"]);
    expect("error" in a).toBe(true);
  });
});

describe("parseArgs — install --locked", () => {
  test("--locked defaults off", () => {
    const a = parseArgs(["install", "pkg.json"]);
    if ("command" in a && a.command === "install") expect(a.locked).toBe(false);
  });
  test("--locked sets locked true", () => {
    const a = parseArgs(["install", "pkg.json", "--locked"]);
    if ("command" in a && a.command === "install") expect(a.locked).toBe(true);
  });
  test("--locked + --frozen is an error (mutually exclusive)", () => {
    const a = parseArgs(["install", "pkg.json", "--locked", "--frozen"]);
    expect("error" in a).toBe(true);
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
      content_hash: "blake3:aabbccdd",
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
      JSON.stringify({ format_version: 1, name: "x", content_hash: "blake3:abc" }),
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
          content_hash: `blake3:${pair[0]}`,
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
        content_hash: "blake3:test",
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
    expect(readFileSync(keyPath, "utf8")).toBe("OLD");
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
    const parsed = JSON.parse(readFileSync(outPath, "utf8"));
    expect(parsed.manifest.signature).toBeDefined();
  });

  test("sign of a package with mismatched content_hash exits 1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-sign-"));
    const pkg = {
      manifest: { format_version: 1, name: "t", version: "1.0.0", content_hash: "blake3:WRONG" },
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


  // ---- trust add: invalid key validation ----

  test("trust add with .pub JSON missing public_key field exits 64 or 65 (NOT a fatal throw)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-bad-"));
    const badPub = join(dir, "bad.pub");
    // A valid JSON .pub but with public_key missing
    writeFileSync(badPub, JSON.stringify({ algo: "ed25519", key_id: "ed25519:missing" }));
    const code = await main(["trust", "add", badPub]);
    expect(code === 64 || code === 65).toBe(true);
  });

  test("trust add with a garbage non-base64 string exits 64 or 65 (NOT a fatal throw)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-garbage-"));
    const badPub = join(dir, "garbage.pub");
    // Write a file whose content is clearly not a valid Ed25519 SPKI
    writeFileSync(badPub, "this-is-not-a-valid-key!!!!!!!!!!!!!!");
    const code = await main(["trust", "add", badPub]);
    expect(code === 64 || code === 65).toBe(true);
  });

  // ---- trust add: non-Ed25519 SPKI rejection (Fix 1) ----

  test("trust add a non-Ed25519 SPKI (EC P-256) exits 65", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-nonec-"));
    // Generate an EC P-256 keypair — valid SPKI DER, but NOT Ed25519
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const spkiB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const pubPath = join(dir, "ec.pub");
    writeFileSync(pubPath, JSON.stringify({ algo: "ec", key_id: "ec:test", public_key: spkiB64 }));
    const code = await main(["trust", "add", pubPath]);
    expect(code).toBe(65);
  });

  test("trust add normalizes a padded SPKI to the canonical key_id (not the padded bytes)", async () => {
    // createPublicKey accepts an Ed25519 SPKI with trailing bytes but re-exports the
    // canonical 44-byte form. trust add must store the CANONICAL key_id so it matches
    // what signManifest/verify derive — else that publisher's packages never authenticate.
    const { publicKey } = generateKeyPairSync("ed25519");
    const canon = publicKey.export({ type: "spki", format: "der" }) as Buffer;
    const padded = Buffer.concat([canon, Buffer.from([0, 0])]);
    const canonKeyId = "ed25519:" + createHash("sha256").update(canon).digest("hex").slice(0, 16);
    const paddedKeyId = "ed25519:" + createHash("sha256").update(padded).digest("hex").slice(0, 16);
    expect(canonKeyId).not.toBe(paddedKeyId); // sanity: padded vs canonical differ
    const code = await main(["trust", "add", padded.toString("base64")]);
    expect(code).toBe(0);
    const ids = listTrustedKeys().map((r) => r.key_id);
    expect(ids).toContain(canonKeyId);      // stored under the canonical key_id
    expect(ids).not.toContain(paddedKeyId); // NOT the raw padded bytes' id
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
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.manifest.content_hash = "blake3:TAMPERED"; // but signature was over original
    const tamperedPath = join(dir, "tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(pkg));
    // Trust the key (so we get past untrusted-key, reach bad-signature)
    const pubPath = writePubFile(dir, kp);
    await main(["trust", "add", pubPath]);
    const code = await main(["install", tamperedPath, "--store", store]);
    expect(code).toBe(1);
  });

  test("install untrusted-key → exit 1 EVEN with --allow-no-signature", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath } = signedPkgFixture();
    // Do NOT trust the key
    const code = await main(["install", pkgPath, "--allow-no-signature", "--store", store]);
    expect(code).toBe(1);
  });

  test("install unsigned → exit 1 without --allow-no-signature", async () => {
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

  test("install unsigned → exit 0 with --allow-no-signature", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const files = { "a.txt": "hi" };
    const filesJson = JSON.stringify(files);
    const ch = contentHash(new TextEncoder().encode(filesJson));
    const pkg = { manifest: { format_version: 1, name: "u", version: "1.0.0", content_hash: ch }, files };
    const dir = mkdtempSync(join(tmpdir(), "ace-u-"));
    const pkgPath = join(dir, "u.json");
    writeFileSync(pkgPath, JSON.stringify(pkg));
    expect(await main(["install", pkgPath, "--allow-no-signature", "--store", store])).toBe(0);
  });
  test("install leaf (no-deps) malformed root (float) -> exit 1 invalid-package (not ace: fatal:)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const files = { "a.txt": "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    // Well-formed SHAPE + correct content_hash, but a float manifest field makes packageHash throw
    // in buildLeafLockfile; the early root guard must refuse with exit 1, not the ace: fatal: catch-all.
    const pkg = { manifest: { format_version: 1, name: "u", version: "1.0.0", content_hash: ch, bogus: 1.5 }, files };
    const dir = mkdtempSync(join(tmpdir(), "ace-umal-"));
    const pkgPath = join(dir, "umal.json");
    writeFileSync(pkgPath, JSON.stringify(pkg));
    expect(await main(["install", pkgPath, "--allow-no-signature", "--store", store])).toBe(1);
  });

  test("install algo-tampered (signed+trusted, algo->none) - exit 1 (unsupported-algo, NOT allow-no-signature-overridable)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath, kp, dir } = signedPkgFixture();
    // Trust the key -- key IS trusted, but we tamper algo before installing
    const pubPath = writePubFile(dir, kp);
    await main(["trust", "add", pubPath]);
    // Read the package and tamper signature.algo
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.manifest.signature.algo = "none";
    const tamperedPath = join(dir, "algo-tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(pkg));
    // Should be refused even though key is trusted
    const code = await main(["install", tamperedPath, "--store", store]);
    expect(code).toBe(1);
  });

  test("install algo-tampered with --allow-no-signature - still exit 1 (unsupported-algo is never overridable)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkgPath, kp, dir } = signedPkgFixture();
    // Trust the key
    const pubPath = writePubFile(dir, kp);
    await main(["trust", "add", pubPath]);
    // Tamper algo
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.manifest.signature.algo = "none";
    const tamperedPath = join(dir, "algo-tampered2.json");
    writeFileSync(tamperedPath, JSON.stringify(pkg));
    // --allow-no-signature must NOT override algorithm-confusion
    const code = await main(["install", tamperedPath, "--allow-no-signature", "--store", store]);
    expect(code).toBe(1);
  });

  // ---- slice 4: graph install ----

  test("e2e: install a small graph (root->A->B) installs all three", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const B = { manifest: { format_version:1, name:"B", version:"1.0.0", content_hash: h({ "b.txt":"b" }) }, files: { "b.txt":"b" } };
    writeFileSync(join(dir,"B.json"), JSON.stringify(B));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }), dependencies:[{ kind: "inline" as const, name:"B", version:"1.0.0", url: join(dir,"B.json"), package_hash: packageHash(B as any) }] }, files: { "a.txt":"a" } };
    writeFileSync(join(dir,"A.json"), JSON.stringify(A));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind: "inline" as const, name:"A", version:"1.0.0", url: join(dir,"A.json"), package_hash: packageHash(A as any) }] }, files: { "r.txt":"r" } };
    writeFileSync(join(dir,"root.json"), JSON.stringify(root));
    const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
    expect(code).toBe(0);
    expect(listInstalled(store).map((p)=>p.manifest.name).sort()).toEqual(["A","B","root"]);
  });

  test("atomic: a graph with an unsafe-path node installs NOTHING (preflight)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const bad = { manifest: { format_version:1, name:"BAD", version:"1.0.0", content_hash: h({ "../escape":"x" }) }, files: { "../escape":"x" } };
    writeFileSync(join(dir,"BAD.json"), JSON.stringify(bad));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind: "inline" as const, name:"BAD", version:"1.0.0", url: join(dir,"BAD.json"), package_hash: packageHash(bad as any) }] }, files: { "r.txt":"r" } };
    writeFileSync(join(dir,"root.json"), JSON.stringify(root));
    const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });

  test("atomic: a graph whose ROOT has a bad content_hash installs NOTHING", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const B = { manifest: { format_version:1, name:"B", version:"1.0.0", content_hash: h({ "b.txt":"b" }) }, files: { "b.txt":"b" } };
    writeFileSync(join(dir,"B.json"), JSON.stringify(B));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: "blake3:deadbeef", dependencies:[{ kind: "inline" as const, name:"B", version:"1.0.0", url: join(dir,"B.json"), package_hash: packageHash(B as any) }] }, files: { "r.txt":"r" } };
    writeFileSync(join(dir,"root.json"), JSON.stringify(root));
    const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });

  test("store-collision: two distinct packages with identical files install NOTHING", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const sharedFiles = { "same.txt": "identical" };
    const X = { manifest: { format_version:1, name:"X", version:"1.0.0", content_hash: h(sharedFiles) }, files: sharedFiles };
    const Y = { manifest: { format_version:1, name:"Y", version:"1.0.0", content_hash: h(sharedFiles) }, files: sharedFiles };
    writeFileSync(join(dir,"X.json"), JSON.stringify(X));
    writeFileSync(join(dir,"Y.json"), JSON.stringify(Y));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[
      { kind: "inline" as const, name:"X", version:"1.0.0", url: join(dir,"X.json"), package_hash: packageHash(X as any) },
      { kind: "inline" as const, name:"Y", version:"1.0.0", url: join(dir,"Y.json"), package_hash: packageHash(Y as any) },
    ] }, files: { "r.txt":"r" } };
    writeFileSync(join(dir,"root.json"), JSON.stringify(root));
    const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });
});

// ---- registry commands (slice 5.1) ----

describe("registry commands", () => {
  test("ace registry add fetches + computes hash + stores; registry list shows it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const D = { manifest: { format_version:1, name:"D", version:"1.0.0", content_hash: h({ "d.txt":"d" }) }, files: { "d.txt":"d" } };
    const dPath = join(dir, "D.json"); writeFileSync(dPath, JSON.stringify(D));
    expect(await main(["registry", "add", "D", "1.0.0", dPath])).toBe(0);
    const reg = loadRegistry();
    expect(reg.get("D")?.get("1.0.0")?.package_hash).toBe(packageHash(D as any));
    expect(await main(["registry", "list"])).toBe(0);
  });

  test("registry add normalizes a relative local path to absolute (cwd-independent install)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string, string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const D = { manifest: { format_version: 1, name: "Drel", version: "1.0.0", content_hash: h({ "d.txt": "d" }) }, files: { "d.txt": "d" } };
    const absPath = join(dir, "Drel.json");
    writeFileSync(absPath, JSON.stringify(D));
    const relPath = relative(process.cwd(), absPath);
    expect(await main(["registry", "add", "Drel", "1.0.0", relPath])).toBe(0);
    const stored = loadRegistry().get("Drel")?.get("1.0.0")?.url;
    expect(isAbsolute(stored!)).toBe(true);
    expect(stored).toBe(absPath);
  });
  test("registry add refuses a parseable-but-malformed package (no manifest/files) with exit 65", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const p = join(dir, "bad.json");
    writeFileSync(p, JSON.stringify({ foo: "bar" }));
    expect(await main(["registry", "add", "X", "1.0.0", p])).toBe(65);
  });
  test("registry add refuses a package whose identity != the CLI name/version with exit 65", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string, string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const D = { manifest: { format_version: 1, name: "D", version: "1.0.0", content_hash: h({ "d.txt": "d" }) }, files: { "d.txt": "d" } };
    const p = join(dir, "D.json");
    writeFileSync(p, JSON.stringify(D));
    expect(await main(["registry", "add", "WRONGNAME", "1.0.0", p])).toBe(65);
  });
  test("registry add refuses a malformed field value (float) with exit 65 (not ace: fatal:)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const p = join(dir, "mal.json");
    // Well-formed SHAPE + matching identity, but a float manifest field makes packageHash throw;
    // safePackageHash must turn that into a clean exit 65, not the generic ace: fatal: catch-all.
    writeFileSync(p, JSON.stringify({ manifest: { format_version: 1, name: "M", version: "1.0.0", content_hash: "blake3:deadbeef", bogus: 1.5 }, files: { "a.txt": "x" } }));
    expect(await main(["registry", "add", "M", "1.0.0", p])).toBe(65);
  });
  test("e2e: install a root with a registry dep resolves via the registry", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const D = { manifest: { format_version:1, name:"D", version:"1.0.0", content_hash: h({ "d.txt":"d" }) }, files: { "d.txt":"d" } };
    const dPath = join(dir, "D.json"); writeFileSync(dPath, JSON.stringify(D));
    await main(["registry", "add", "D", "1.0.0", dPath]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry", name:"D", version:"1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const code = await main(["install", rootPath, "--store", store, "--allow-no-signature"]);
    expect(code).toBe(0);
    expect(listInstalled(store).map((p)=>p.manifest.name).sort()).toEqual(["D","root"]);
  });

  test("e2e: graph install writes ./ace.lock pinning the installed deps", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(A));
    await main(["registry", "add", "A", "1.0.0", aPath]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lockPath = join(dir, "ace.lock");
    const code = await main(["install", rootPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath]);
    expect(code).toBe(0);
    expect(existsSync(lockPath)).toBe(true);
    const lf = parseLockfile(readFileSync(lockPath, "utf8"));
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.root.name).toBe("root");
      expect(lf.nodes.map((n) => `${n.name}@${n.version}`).sort()).toEqual(["A@1.0.0"]);
      expect(lf.nodes[0]!.package_hash).toBe(packageHash(A as any));
    }
  });

  test("e2e: install with a registry dep missing from the registry -> exit 1, store empty", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry", name:"MISSING", version:"1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const code = await main(["install", rootPath, "--store", store, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });
});

// ---- frozen lockfile replay (slice 5.3) ----

describe("install --frozen (slice 5.3)", () => {
  const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));

  // Builds an inline root->A graph in a temp dir, installs it once with --lockfile to
  // generate the lock (the lock's node url points at the temp A.json — registry never used),
  // then returns paths so a --frozen run can replay it without consulting the user registry.
  function buildInlineGraph() {
    const dir = mkdtempSync(join(tmpdir(), "ace-frozen-pkgs-"));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(A));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"inline" as const, name:"A", version:"1.0.0", url: aPath, package_hash: packageHash(A as any) }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lockPath = join(dir, "ace.lock");
    return { dir, A, aPath, root, rootPath, lockPath };
  }

  test("--frozen installs from the lock with an EMPTY registry (registry-independence)", async () => {
    const g = buildInlineGraph();
    const genStore = mkdtempSync(join(tmpdir(), "ace-frozen-gen-"));
    // 1. Generate the lock via a normal install (inline graph; no registry add ever happens).
    expect(await main(["install", g.rootPath, "--store", genStore, "--allow-no-signature", "--lockfile", g.lockPath])).toBe(0);
    expect(existsSync(g.lockPath)).toBe(true);
    // 2. Replay into a fresh store with --frozen. The user registry is empty (no registry add);
    //    the bundled registry may carry unrelated packages. Frozen replay must install entirely
    //    from the lock's pinned url, never consulting registry entries for the inline graph.
    expect(loadRegistry(join(g.dir, "missing-bundled-registry.json")).size).toBe(0);
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-replay-"));
    const code = await main(["install", g.rootPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", g.lockPath, "--frozen"]);
    expect(code).toBe(0);
    expect(listInstalled(frozenStore).map((p)=>p.manifest.name).sort()).toEqual(["A","root"]);
  });

  test("--frozen with a drifted root (deps changed vs the lock) is refused", async () => {
    const g = buildInlineGraph();
    const genStore = mkdtempSync(join(tmpdir(), "ace-frozen-gen-"));
    expect(await main(["install", g.rootPath, "--store", genStore, "--allow-no-signature", "--lockfile", g.lockPath])).toBe(0);
    // Mutate the root's dep set after the lock was written -> root packageHash drifts.
    const drifted = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"inline" as const, name:"A", version:"2.0.0", url: g.aPath, package_hash: packageHash(g.A as any) }] }, files: { "r.txt":"r" } };
    const driftedPath = join(g.dir, "root-drifted.json"); writeFileSync(driftedPath, JSON.stringify(drifted));
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-drift-"));
    const code = await main(["install", driftedPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", g.lockPath, "--frozen"]);
    expect(code).toBe(1);
    expect(listInstalled(frozenStore).length).toBe(0);
  });

  test("--frozen with NO lockfile at the path is refused", async () => {
    const g = buildInlineGraph();
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-nolock-"));
    const missingLock = join(g.dir, "does-not-exist.lock");
    const code = await main(["install", g.rootPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", missingLock, "--frozen"]);
    expect(code).toBe(1);
    expect(listInstalled(frozenStore).length).toBe(0);
  });

  test("--frozen with a tampered locked node (bytes at url != lock pin) is refused", async () => {
    const g = buildInlineGraph();
    const genStore = mkdtempSync(join(tmpdir(), "ace-frozen-gen-"));
    expect(await main(["install", g.rootPath, "--store", genStore, "--allow-no-signature", "--lockfile", g.lockPath])).toBe(0);
    // Tamper the bytes at A's url AFTER the lock pinned A's package_hash.
    const tamperedA = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"TAMPERED" }) }, files: { "a.txt":"TAMPERED" } };
    writeFileSync(g.aPath, JSON.stringify(tamperedA));
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-tamper-"));
    const code = await main(["install", g.rootPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", g.lockPath, "--frozen"]);
    expect(code).toBe(1);
    expect(listInstalled(frozenStore).length).toBe(0);
  });

  test("--frozen refuses an untrusted-signature locked node even WITH --allow-no-signature", async () => {
    // Security surface: the frozen replay's signature gate hard-refuses any present-but-invalid
    // signature (nv.reason !== "no-signature"); --allow-no-signature ONLY waives no-signature.
    // Construct a locked node A signed with a key NEVER added to the trust store -> verifySignature
    // returns "untrusted-key" -> must refuse despite --allow-no-signature. The lock is built directly
    // so its pin = packageHash(signedA): replay fetches the SAME signed bytes (pin passes, content_hash
    // passes, path-safety passes) and reaches the signature gate -- proving the gate, not an earlier check.
    const dir = mkdtempSync(join(tmpdir(), "ace-frozen-untrusted-"));
    const untrustedKp = generateKeypair(); // never added to the trust store
    const aFiles = { "a.txt": "a" };
    const aManifestBase = { format_version: 1, name: "A", version: "1.0.0", content_hash: h(aFiles) };
    const signature = signManifest(aManifestBase, untrustedKp.privatePem);
    const signedA = { manifest: { ...aManifestBase, signature }, files: aFiles };
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(signedA));
    const aHash = packageHash(signedA as any);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"inline" as const, name:"A", version:"1.0.0", url: aPath, package_hash: aHash }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    // Build the lock directly (pin A's SIGNED package_hash) so replay reaches the signature gate.
    const lock = {
      format_version: 1 as const,
      root: { name: "root", version: "1.0.0", package_hash: packageHash(root as any) },
      nodes: [{ name: "A", version: "1.0.0", url: aPath, package_hash: aHash }],
    };
    const lockPath = join(dir, "ace.lock"); writeFileSync(lockPath, JSON.stringify(lock));
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-untrusted-store-"));
    const code = await main(["install", rootPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", lockPath, "--frozen"]);
    expect(code).toBe(1);
    expect(listInstalled(frozenStore).length).toBe(0);
  });

  test("--frozen atomicity: a 2-node lock whose 2nd node fails verification installs NEITHER (verify-all-before-install-any)", async () => {
    // Two inline nodes A,B. The lock pins A's real package_hash but B's bytes are TAMPERED after the
    // lock is written, so B's package_hash no longer matches the pin. With sequential fetch+verify+install
    // the first verified node (A) would already be on disk by the time B's pin check fails; the two-pass
    // restructure verifies the WHOLE graph before any extract, so a B failure leaves A NOT installed.
    const dir = mkdtempSync(join(tmpdir(), "ace-frozen-atomic-"));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const B = { manifest: { format_version:1, name:"B", version:"1.0.0", content_hash: h({ "b.txt":"b" }) }, files: { "b.txt":"b" } };
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(A));
    const bPath = join(dir, "B.json"); writeFileSync(bPath, JSON.stringify(B));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[
      { kind:"inline" as const, name:"A", version:"1.0.0", url: aPath, package_hash: packageHash(A as any) },
      { kind:"inline" as const, name:"B", version:"1.0.0", url: bPath, package_hash: packageHash(B as any) },
    ] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    // Build the lock directly so A is node[0] (verifies clean) and B is node[1] (will fail after tamper).
    const lock = {
      format_version: 1 as const,
      root: { name: "root", version: "1.0.0", package_hash: packageHash(root as any) },
      nodes: [
        { name: "A", version: "1.0.0", url: aPath, package_hash: packageHash(A as any) },
        { name: "B", version: "1.0.0", url: bPath, package_hash: packageHash(B as any) },
      ],
    };
    const lockPath = join(dir, "ace.lock"); writeFileSync(lockPath, JSON.stringify(lock));
    // Tamper B's bytes AFTER the lock pinned B's package_hash -> B fails the pin check in pass 1.
    const tamperedB = { manifest: { format_version:1, name:"B", version:"1.0.0", content_hash: h({ "b.txt":"TAMPERED" }) }, files: { "b.txt":"TAMPERED" } };
    writeFileSync(bPath, JSON.stringify(tamperedB));
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-atomic-store-"));
    const code = await main(["install", rootPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", lockPath, "--frozen"]);
    expect(code).toBe(1);
    // The load-bearing assertion: A (the first, fully-verifiable node) is NOT on disk -> verify-all-then-install.
    expect(listInstalled(frozenStore).length).toBe(0);
  });

  test("--frozen store-collision: two nodes sharing a content_hash store key with different package_hash install NOTHING", async () => {
    // Two distinct packages X,Y with IDENTICAL files -> identical content_hash (sha256 of files) but
    // distinct manifests (name X vs Y) -> distinct package_hash. They collide on the content_hash store
    // key. The frozen pass-1 byStoreKey guard (mirrored from the default-path preflight) must refuse
    // before installing either, exactly like the default-path store-collision test.
    const dir = mkdtempSync(join(tmpdir(), "ace-frozen-collision-"));
    const sharedFiles = { "same.txt": "identical" };
    const X = { manifest: { format_version:1, name:"X", version:"1.0.0", content_hash: h(sharedFiles) }, files: sharedFiles };
    const Y = { manifest: { format_version:1, name:"Y", version:"1.0.0", content_hash: h(sharedFiles) }, files: sharedFiles };
    const xPath = join(dir, "X.json"); writeFileSync(xPath, JSON.stringify(X));
    const yPath = join(dir, "Y.json"); writeFileSync(yPath, JSON.stringify(Y));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[
      { kind:"inline" as const, name:"X", version:"1.0.0", url: xPath, package_hash: packageHash(X as any) },
      { kind:"inline" as const, name:"Y", version:"1.0.0", url: yPath, package_hash: packageHash(Y as any) },
    ] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lock = {
      format_version: 1 as const,
      root: { name: "root", version: "1.0.0", package_hash: packageHash(root as any) },
      nodes: [
        { name: "X", version: "1.0.0", url: xPath, package_hash: packageHash(X as any) },
        { name: "Y", version: "1.0.0", url: yPath, package_hash: packageHash(Y as any) },
      ],
    };
    const lockPath = join(dir, "ace.lock"); writeFileSync(lockPath, JSON.stringify(lock));
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-collision-store-"));
    const code = await main(["install", rootPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", lockPath, "--frozen"]);
    expect(code).toBe(1);
    expect(listInstalled(frozenStore).length).toBe(0);
  });

  test("--frozen with a malformed (JSON-valid but not a well-formed package) locked node refuses cleanly (no throw)", async () => {
    // The fetched node bytes + lockfile are untrusted. A payload that parses as JSON but is not a
    // well-formed package (no manifest/files) must hit the PASS-1 shape guard and refuse (exit 1)
    // rather than THROW. The shape guard runs BEFORE the pin check, so the malformed node is
    // refused at the guard regardless of the lock's pin value (a placeholder pin is used below).
    // Mirrors the untrusted-signature/atomicity tests: build the lock directly to reach the gate.
    const dir = mkdtempSync(join(tmpdir(), "ace-frozen-malformed-"));
    const malformed = {}; // valid JSON, no manifest/files — hits PASS-1 shape guard before packageHash runs
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(malformed));
    // Any pin value works: the PASS-1 shape guard refuses the malformed node BEFORE the pin check,
    // so the value is never compared. (packageHash now excludes the signature and throws on a
    // manifest-less payload, so it can no longer be called on `malformed` to derive the pin —
    // a placeholder hash exercises the same guard.) slice 8.2.
    const aHash = "blake3:" + "0".repeat(64);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"inline" as const, name:"A", version:"1.0.0", url: aPath, package_hash: aHash }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lock = {
      format_version: 1 as const,
      root: { name: "root", version: "1.0.0", package_hash: packageHash(root as any) },
      nodes: [{ name: "A", version: "1.0.0", url: aPath, package_hash: aHash }],
    };
    const lockPath = join(dir, "ace.lock"); writeFileSync(lockPath, JSON.stringify(lock));
    const frozenStore = mkdtempSync(join(tmpdir(), "ace-frozen-malformed-store-"));
    // The load-bearing assertion: this MUST NOT throw (the unguarded bug is a TypeError on
    // np.manifest.content_hash). await directly so any throw fails the test loudly; exit 1 = refused.
    const code = await main(["install", rootPath, "--store", frozenStore, "--allow-no-signature", "--lockfile", lockPath, "--frozen"]);
    expect(code).toBe(1);
    expect(listInstalled(frozenStore).length).toBe(0);
  });
});

// ---- semver ranges + solver (slice 5.2) ----

describe("install — semver ranges (slice 5.2)", () => {
  test("e2e: ranged registry dep resolves to newest satisfying version", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const mkA = (v: string) => ({ manifest: { format_version:1, name:"A", version:v, content_hash: h({ "a.txt":v }) }, files: { "a.txt":v } });
    for (const v of ["1.0.0","1.5.0","1.9.0"]) { const p = join(dir, `A-${v}.json`); writeFileSync(p, JSON.stringify(mkA(v))); await main(["registry","add","A",v,p]); }
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    expect(await main(["install", rootPath, "--store", store, "--allow-no-signature"])).toBe(0);
    const names = listInstalled(store).map((p)=>`${p.manifest.name}@${p.manifest.version}`).sort();
    expect(names).toEqual(["A@1.9.0", "root@1.0.0"]);
  });

  test("e2e: unsatisfiable range → exit 1, store empty", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const ap = join(dir, "A.json"); writeFileSync(ap, JSON.stringify(A)); await main(["registry","add","A","1.0.0",ap]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:">=2.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    expect(await main(["install", rootPath, "--store", store, "--allow-no-signature"])).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });

  test("e2e: inline-only graph still installs (empty registry, no registry-miss)", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const ap = join(dir, "A.json"); writeFileSync(ap, JSON.stringify(A));
    const aHash = packageHash(A as any);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"inline" as const, name:"A", version:"1.0.0", url: ap, package_hash: aHash }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    expect(await main(["install", rootPath, "--store", store, "--allow-no-signature"])).toBe(0);
    expect(listInstalled(store).map((p)=>p.manifest.name).sort()).toEqual(["A","root"]);
  });

  test("e2e: --print-resolution prints the solved graph", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const A = { manifest: { format_version:1, name:"A", version:"1.2.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const ap = join(dir, "A.json"); writeFileSync(ap, JSON.stringify(A)); await main(["registry","add","A","1.2.0",ap]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    expect(await main(["install", rootPath, "--store", store, "--allow-no-signature", "--print-resolution"])).toBe(0);
  });
});

describe("install --locked graph (slice 5.4)", () => {
  const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));

  test("--locked installs when the on-disk lock matches a fresh solve", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-locked-pkgs-"));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(A)); await main(["registry","add","A","1.0.0",aPath]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lockPath = join(dir, "ace.lock");
    // 1. Normal install writes the lock.
    expect(await main(["install", rootPath, "--store", mkdtempSync(join(tmpdir(),"ace-locked-gen-")), "--allow-no-signature", "--lockfile", lockPath])).toBe(0);
    expect(existsSync(lockPath)).toBe(true);
    // 2. --locked with the SAME registry + matching lock → installs.
    const store = mkdtempSync(join(tmpdir(), "ace-locked-ok-"));
    const code = await main(["install", rootPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath, "--locked"]);
    expect(code).toBe(0);
    expect(listInstalled(store).map((p)=>p.manifest.name).sort()).toEqual(["A","root"]);
  });

  test("--locked refuses + installs nothing when the lock is stale", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-locked-stale-"));
    const A1 = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a1" }) }, files: { "a.txt":"a1" } };
    const a1Path = join(dir, "A-1.0.0.json"); writeFileSync(a1Path, JSON.stringify(A1)); await main(["registry","add","A","1.0.0",a1Path]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lockPath = join(dir, "ace.lock");
    // 1. Normal install locks A@1.0.0.
    expect(await main(["install", rootPath, "--store", mkdtempSync(join(tmpdir(),"ace-locked-stale-gen-")), "--allow-no-signature", "--lockfile", lockPath])).toBe(0);
    // 2. Add A@1.1.0 (in-range) — the fresh solve now picks A@1.1.0, so the lock is stale.
    const A11 = { manifest: { format_version:1, name:"A", version:"1.1.0", content_hash: h({ "a.txt":"a11" }) }, files: { "a.txt":"a11" } };
    const a11Path = join(dir, "A-1.1.0.json"); writeFileSync(a11Path, JSON.stringify(A11)); await main(["registry","add","A","1.1.0",a11Path]);
    // 3. --locked → refuse, store unchanged.
    const store = mkdtempSync(join(tmpdir(), "ace-locked-stale-store-"));
    const code = await main(["install", rootPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath, "--locked"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });

  test("--locked with NO lockfile → refused", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-locked-nolock-"));
    const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(A)); await main(["registry","add","A","1.0.0",aPath]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const store = mkdtempSync(join(tmpdir(), "ace-locked-nolock-store-"));
    const code = await main(["install", rootPath, "--store", store, "--allow-no-signature", "--lockfile", join(dir, "missing.lock"), "--locked"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });
});

describe("leaf-install lockfiles (slice 5.4)", () => {
  const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));

  // Builds a no-dependency (leaf) package file in a temp dir; returns { dir, pkg, pkgPath }.
  function leafFixture(files: Record<string,string> = { "leaf.txt": "v1" }) {
    const dir = mkdtempSync(join(tmpdir(), "ace-leaf-pkgs-"));
    const pkg = { manifest: { format_version:1, name:"leaf", version:"1.0.0", content_hash: h(files) }, files };
    const pkgPath = join(dir, "leaf.json"); writeFileSync(pkgPath, JSON.stringify(pkg));
    return { dir, pkg, pkgPath };
  }

  test("leaf install writes an empty-nodes lock", async () => {
    const { dir, pkg, pkgPath } = leafFixture();
    const store = mkdtempSync(join(tmpdir(), "ace-leaf-store-"));
    const lockPath = join(dir, "ace.lock");
    const code = await main(["install", pkgPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath]);
    expect(code).toBe(0);
    expect(listInstalled(store).map((p)=>p.manifest.name)).toEqual(["leaf"]);
    expect(existsSync(lockPath)).toBe(true);
    const lf = parseLockfile(readFileSync(lockPath, "utf8"));
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.root.name).toBe("leaf");
      expect(lf.root.package_hash).toBe(packageHash(pkg as any));
      expect(lf.nodes).toEqual([]);
    }
  });

  test("--frozen on a leaf installs the root when the lock matches", async () => {
    const { dir, pkgPath } = leafFixture();
    const lockPath = join(dir, "ace.lock");
    // 1. Normal leaf install writes the lock.
    expect(await main(["install", pkgPath, "--store", mkdtempSync(join(tmpdir(),"ace-leaf-gen-")), "--allow-no-signature", "--lockfile", lockPath])).toBe(0);
    // 2. --frozen leaf with the matching lock → installs.
    const store = mkdtempSync(join(tmpdir(), "ace-leaf-frozen-"));
    const code = await main(["install", pkgPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath, "--frozen"]);
    expect(code).toBe(0);
    expect(listInstalled(store).map((p)=>p.manifest.name)).toEqual(["leaf"]);
  });

  test("--frozen leaf with a drifted root → refused, installs nothing", async () => {
    const { dir, pkgPath } = leafFixture({ "leaf.txt": "v1" });
    const lockPath = join(dir, "ace.lock");
    // 1. Lock leaf@1.0.0 with the original files.
    expect(await main(["install", pkgPath, "--store", mkdtempSync(join(tmpdir(),"ace-leaf-drift-gen-")), "--allow-no-signature", "--lockfile", lockPath])).toBe(0);
    // 2. A DIFFERENT root (same name/version, changed files → different packageHash) under --frozen → refused.
    const drifted = { manifest: { format_version:1, name:"leaf", version:"1.0.0", content_hash: h({ "leaf.txt": "v2-CHANGED" }) }, files: { "leaf.txt": "v2-CHANGED" } };
    const driftedPath = join(dir, "leaf-drift.json"); writeFileSync(driftedPath, JSON.stringify(drifted));
    const store = mkdtempSync(join(tmpdir(), "ace-leaf-drift-store-"));
    const code = await main(["install", driftedPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath, "--frozen"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });

  test("--locked leaf passes when the lock matches", async () => {
    const { dir, pkgPath } = leafFixture();
    const lockPath = join(dir, "ace.lock");
    expect(await main(["install", pkgPath, "--store", mkdtempSync(join(tmpdir(),"ace-leaf-locked-gen-")), "--allow-no-signature", "--lockfile", lockPath])).toBe(0);
    const store = mkdtempSync(join(tmpdir(), "ace-leaf-locked-ok-"));
    const code = await main(["install", pkgPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath, "--locked"]);
    expect(code).toBe(0);
    expect(listInstalled(store).map((p)=>p.manifest.name)).toEqual(["leaf"]);
  });

  test("--locked leaf with NO lockfile → refused", async () => {
    const { dir, pkgPath } = leafFixture();
    const store = mkdtempSync(join(tmpdir(), "ace-leaf-locked-nolock-"));
    const code = await main(["install", pkgPath, "--store", store, "--allow-no-signature", "--lockfile", join(dir, "missing.lock"), "--locked"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });
});

describe("parseArgs — update", () => {
  test("update requires a source", () => {
    expect("error" in parseArgs(["update"])).toBe(true);
  });
  test("update parses source + default lockfile", () => {
    const a = parseArgs(["update", "pkg.json"]);
    if ("command" in a && a.command === "update") { expect(a.source).toBe("pkg.json"); expect(a.lockfile).toBe("ace.lock"); }
  });
  test("update --lockfile override", () => {
    const a = parseArgs(["update", "pkg.json", "--lockfile", "x.lock"]);
    if ("command" in a && a.command === "update") expect(a.lockfile).toBe("x.lock");
  });
});

describe("ace update (slice 5.4)", () => {
  const h = (files: Record<string,string>) => contentHash(new TextEncoder().encode(JSON.stringify(files)));

  test("update rewrites ./ace.lock to the freshly-solved graph + installs NOTHING", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-update-pkgs-"));
    const A1 = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: h({ "a.txt":"a1" }) }, files: { "a.txt":"a1" } };
    const a1Path = join(dir, "A-1.0.0.json"); writeFileSync(a1Path, JSON.stringify(A1)); await main(["registry","add","A","1.0.0",a1Path]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lockPath = join(dir, "ace.lock");
    const genStore = mkdtempSync(join(tmpdir(), "ace-update-gen-"));
    // 1. Normal install locks A@1.0.0.
    expect(await main(["install", rootPath, "--store", genStore, "--allow-no-signature", "--lockfile", lockPath])).toBe(0);
    const before = parseLockfile(readFileSync(lockPath, "utf8"));
    expect("error" in before).toBe(false);
    if (!("error" in before)) expect(before.nodes.map((n)=>`${n.name}@${n.version}`)).toEqual(["A@1.0.0"]);
    const installedBefore = listInstalled(genStore).map((p)=>p.manifest.name).sort();
    // 2. Add A@1.1.0 (in-range) → a fresh solve now picks A@1.1.0.
    const A11 = { manifest: { format_version:1, name:"A", version:"1.1.0", content_hash: h({ "a.txt":"a11" }) }, files: { "a.txt":"a11" } };
    const a11Path = join(dir, "A-1.1.0.json"); writeFileSync(a11Path, JSON.stringify(A11)); await main(["registry","add","A","1.1.0",a11Path]);
    // 3. ace update → rewrites the lock to A@1.1.0, extracts NOTHING (no --store; gen-store unchanged).
    const code = await main(["update", rootPath, "--lockfile", lockPath, "--allow-no-signature"]);
    expect(code).toBe(0);
    const after = parseLockfile(readFileSync(lockPath, "utf8"));
    expect("error" in after).toBe(false);
    if (!("error" in after)) {
      expect(after.nodes.map((n)=>`${n.name}@${n.version}`)).toEqual(["A@1.1.0"]);
      expect(after.nodes[0]!.package_hash).toBe(packageHash(A11 as any));
    }
    // The gen-store is unchanged — update never extracted A@1.1.0.
    expect(listInstalled(genStore).map((p)=>p.manifest.name).sort()).toEqual(installedBefore);
  });

  test("update on a leaf writes an empty-nodes lock", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-update-leaf-"));
    const pkg = { manifest: { format_version:1, name:"leaf", version:"1.0.0", content_hash: h({ "leaf.txt":"v1" }) }, files: { "leaf.txt":"v1" } };
    const pkgPath = join(dir, "leaf.json"); writeFileSync(pkgPath, JSON.stringify(pkg));
    const lockPath = join(dir, "ace.lock");
    const code = await main(["update", pkgPath, "--lockfile", lockPath, "--allow-no-signature"]);
    expect(code).toBe(0);
    const lf = parseLockfile(readFileSync(lockPath, "utf8"));
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.root.name).toBe("leaf");
      expect(lf.root.package_hash).toBe(packageHash(pkg as any));
      expect(lf.nodes).toEqual([]);
    }
  });

  test("update refuses (no lock written) when a freshly-solved node fails preflight", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-update-bad-"));
    // A dep with an unsafe file path → preflightGraph fails → no lock written (preflight-before-write).
    const bad = { manifest: { format_version:1, name:"BAD", version:"1.0.0", content_hash: h({ "../escape":"x" }) }, files: { "../escape":"x" } };
    const badPath = join(dir, "BAD.json"); writeFileSync(badPath, JSON.stringify(bad)); await main(["registry","add","BAD","1.0.0",badPath]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"BAD", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lockPath = join(dir, "ace.lock");
    const code = await main(["update", rootPath, "--lockfile", lockPath, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(existsSync(lockPath)).toBe(false);
  });

  test("update refuses (no lock written) when a LEAF package fails preflight (unsafe path)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-update-leaf-bad-"));
    // A leaf (no deps) with an unsafe file path → validatePackagePaths fails → no lock written.
    // Parity with the graph path; otherwise update could commit an unreplayable leaf lock that
    // installPackage/--frozen would reject (Codex #6416).
    const bad = { manifest: { format_version:1, name:"BADLEAF", version:"1.0.0", content_hash: h({ "../escape":"x" }) }, files: { "../escape":"x" } };
    const badPath = join(dir, "BADLEAF.json"); writeFileSync(badPath, JSON.stringify(bad));
    const lockPath = join(dir, "ace.lock");
    const code = await main(["update", badPath, "--lockfile", lockPath, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(existsSync(lockPath)).toBe(false);
  });

  test("update treats non-array dependencies as a leaf (untrusted-JSON Array.isArray guard)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-update-nonarr-"));
    // dependencies as a string must NOT route through solve (would iterate chars / crash);
    // the Array.isArray guard routes it to the leaf path instead.
    const pkg = { manifest: { format_version:1, name:"weird", version:"1.0.0", content_hash: h({ "f.txt":"v" }), dependencies: "notanarray" }, files: { "f.txt":"v" } };
    const pkgPath = join(dir, "weird.json"); writeFileSync(pkgPath, JSON.stringify(pkg));
    const lockPath = join(dir, "ace.lock");
    const code = await main(["update", pkgPath, "--lockfile", lockPath, "--allow-no-signature"]);
    expect(code).toBe(0);
    const lf = parseLockfile(readFileSync(lockPath, "utf8"));
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) expect(lf.nodes).toEqual([]);
  });
});

describe("ace registry remote (slice 6)", () => {
  test("add (with --key) → list → rm round-trips", async () => {
    expect(await main(["registry", "remote", "add", "https://r/index.json", "--key", "ed25519:abc"])).toBe(0);
    expect(readRegistriesConfig().remotes).toEqual([{ url: "https://r/index.json", key_id: "ed25519:abc" }]);
    expect(await main(["registry", "remote", "list"])).toBe(0);
    expect(await main(["registry", "remote", "rm", "https://r/index.json"])).toBe(0);
    expect(readRegistriesConfig().remotes).toEqual([]);
  });
  test("add WITHOUT --key is a parse error", () => {
    expect("error" in parseArgs(["registry", "remote", "add", "https://r/index.json"])).toBe(true);
  });
  test("add with --max-staleness-days", async () => {
    expect(await main(["registry", "remote", "add", "https://r/i.json", "--key", "ed25519:k", "--max-staleness-days", "7"])).toBe(0);
    expect(readRegistriesConfig().remotes[0]!.max_staleness_days).toBe(7);
  });
});

describe("ace install via remote registry (slice 6)", () => {
  let savedFetch: typeof globalThis.fetch;
  beforeEach(() => { savedFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = savedFetch; });

  test("resolves + installs a package from a signed remote index", async () => {
    const idxKp = gkpA(); const now = Date.now();
    const files = { "leaf.txt": "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const pkgKp = generateKeypair();
    const m = { format_version: 1, name: "leaf", version: "1.0.0", content_hash: ch };
    const pkg = { manifest: { ...m, signature: signManifest(m, pkgKp.privatePem) }, files };
    const pkgJson = JSON.stringify(pkg);
    const pkgHash = packageHash(pkg as unknown as Parameters<typeof packageHash>[0]);
    const pkgUrl = "https://pkgs/leaf-1.0.0.json";
    const idxContent = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(),
      packages: { leaf: { "1.0.0": { url: pkgUrl, package_hash: pkgHash } } } };
    const idxJson = JSON.stringify({ ...idxContent, signature: sidxA(idxContent, idxKp.privatePem) });
    globalThis.fetch = (async (u: string) => new Response(u === pkgUrl ? pkgJson : idxJson, { status: 200 })) as unknown as typeof fetch;
    await main(["trust", "add", idxKp.publicSpkiB64]);
    await main(["trust", "add", pkgKp.publicSpkiB64]);
    await main(["registry", "remote", "add", "https://x/index.json", "--key", idxKp.keyId]);
    const root = { manifest: { format_version: 1, name: "root", version: "1.0.0",
      content_hash: contentHash(new TextEncoder().encode(JSON.stringify({ "r.txt": "r" }))),
      dependencies: [{ kind: "registry", name: "leaf", version: "^1.0.0" }] }, files: { "r.txt": "r" } };
    const rootPath = join(tempHome, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const code = await main(["install", rootPath, "--allow-no-signature"]);
    expect(code).toBe(0);
    expect(listInstalled(join(tempHome, ".ace", "store")).some((p) => p.manifest.name === "leaf")).toBe(true);
  });

  test("--offline + --frozen parse OK together", () => {
    expect("error" in parseArgs(["install", "x.json", "--offline", "--frozen"])).toBe(false);
  });

  // ---- update --offline: uses cached registry-index, still fetches package artifacts ----

  test("update --offline uses cached registry-index (no index fetch) + writes lockfile", async () => {
    // Setup: a signed remote index + signed package, mirroring the install test above.
    const idxKp = gkpA(); const now = Date.now();
    const files = { "leaf.txt": "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const pkgKp = generateKeypair();
    const m = { format_version: 1, name: "leaf", version: "1.0.0", content_hash: ch };
    const pkg = { manifest: { ...m, signature: signManifest(m, pkgKp.privatePem) }, files };
    const pkgJson = JSON.stringify(pkg);
    const pkgHash = packageHash(pkg as unknown as Parameters<typeof packageHash>[0]);
    const pkgUrl = "https://pkgs/leaf-1.0.0.json";
    const idxUrl = "https://x/index.json";
    const idxContent = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(),
      packages: { leaf: { "1.0.0": { url: pkgUrl, package_hash: pkgHash } } } };
    const idxJson = JSON.stringify({ ...idxContent, signature: sidxA(idxContent, idxKp.privatePem) });

    // Trust both keys and register the remote.
    await main(["trust", "add", idxKp.publicSpkiB64]);
    await main(["trust", "add", pkgKp.publicSpkiB64]);
    await main(["registry", "remote", "add", idxUrl, "--key", idxKp.keyId]);

    // Build a root with a registry dep on "leaf".
    const root = { manifest: { format_version: 1, name: "root", version: "1.0.0",
      content_hash: contentHash(new TextEncoder().encode(JSON.stringify({ "r.txt": "r" }))),
      dependencies: [{ kind: "registry", name: "leaf", version: "^1.0.0" }] }, files: { "r.txt": "r" } };
    const rootPath = join(tempHome, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const lockPath = join(tempHome, "ace.lock");

    // === PASS 1 (ONLINE): prime the registry-index cache ===
    // fetch serves both the index URL and the package URL.
    globalThis.fetch = (async (u: string) =>
      new Response(u === pkgUrl ? pkgJson : idxJson, { status: 200 })) as unknown as typeof fetch;
    const onlineCode = await main(["update", rootPath, "--lockfile", lockPath, "--allow-no-signature"]);
    expect(onlineCode).toBe(0);
    expect(existsSync(lockPath)).toBe(true);

    // === FALSE-GREEN CHECK: wipe the registry-cache + confirm offline update then fails ===
    // Without a cached index, --offline cannot resolve registry deps.
    const { rmSync } = await import("node:fs");
    const { registryCacheDir } = await import("./store.ts");
    rmSync(registryCacheDir(), { recursive: true, force: true });
    rmSync(lockPath, { force: true });
    // Fetch throws for everything — no index cache, offline update cannot resolve.
    globalThis.fetch = (() => { throw new Error("network disabled"); }) as unknown as typeof fetch;
    const failCode = await main(["update", rootPath, "--lockfile", lockPath, "--allow-no-signature", "--offline"]);
    expect(failCode).not.toBe(0); // no cache -> must fail (false-green check)

    // === PASS 2 (OFFLINE): restore cache via online pass, then confirm offline succeeds ===
    // Re-prime the cache with a fresh online pass.
    globalThis.fetch = (async (u: string) =>
      new Response(u === pkgUrl ? pkgJson : idxJson, { status: 200 })) as unknown as typeof fetch;
    expect(await main(["update", rootPath, "--lockfile", lockPath, "--allow-no-signature"])).toBe(0);
    // Block only the INDEX url; package URL still served (--offline skips registry network).
    globalThis.fetch = (async (u: string) => {
      if (u === idxUrl) throw new Error("registry unreachable");
      return new Response(pkgJson, { status: 200 });
    }) as unknown as typeof fetch;
    const offlineCode = await main(["update", rootPath, "--lockfile", lockPath, "--allow-no-signature", "--offline"]);
    expect(offlineCode).toBe(0); // cached index used; update writes lock
    // Lockfile must pin leaf@1.0.0 from the cached registry resolution.
    const lf = parseLockfile(readFileSync(lockPath, "utf8"));
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.nodes.map((n) => `${n.name}@${n.version}`)).toEqual(["leaf@1.0.0"]);
    }
  });
});

describe("ace registry publish (slice 6.1)", () => {
  function writeSignedPkg(dir: string, name: string, version: string) {
    const files = { [`${name}.txt`]: "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const kp = generateKeypair();
    const m = { format_version: 1, name, version, content_hash: ch };
    const pkg = { manifest: { ...m, signature: signManifest(m, kp.privatePem) }, files };
    writeFileSync(join(dir, `${name}-${version}.json`), JSON.stringify(pkg));
    return { kp, pkg };
  }

  test("publish a dir → signed index; sequence auto-bumps; non-package skipped", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    writeFileSync(join(pkgDir, "not-a-package.json"), JSON.stringify({ hello: "world" }));
    const keyPath = join(tempHome, "registry.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    expect("error" in doc).toBe(false);
    if (!("error" in doc)) {
      expect(doc.sequence).toBe(1);
      expect(doc.packages.leaf!["1.0.0"]!.url).toBe("https://pkgs/leaf-1.0.0.json");
    }
    const code2 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code2).toBe(0);
    const doc2 = parseIndex(readFileSync(outPath, "utf8"));
    if (!("error" in doc2)) expect(doc2.sequence).toBe(2);
  });

  test("package with a non-string file value is skipped", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-fv-"));
    writeSignedPkg(pkgDir, "good", "1.0.0");
    // files value is a number, not a string: content_hash matches its JSON, so it clears the
    // content gate, but installPackage would throw at writeFileSync. Must be skipped at publish.
    const badFiles = { "a.txt": 123 };
    const bch = contentHash(new TextEncoder().encode(JSON.stringify(badFiles)));
    const bm = { format_version: 1, name: "bad", version: "1.0.0", content_hash: bch };
    const bkp = generateKeypair();
    const badPkg = { manifest: { ...bm, signature: signManifest(bm, bkp.privatePem) }, files: badFiles };
    writeFileSync(join(pkgDir, "bad-1.0.0.json"), JSON.stringify(badPkg));
    const keyPath = join(tempHome, "registry-fv.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "index-fv.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    expect("error" in doc).toBe(false);
    if (!("error" in doc)) {
      expect(doc.packages.good).toBeDefined();
      expect(doc.packages.bad).toBeUndefined();
    }
  });

  test("publish without --key is a parse error", () => {
    expect("error" in parseArgs(["registry", "publish", "--packages", "d", "--base-url", "https://x"])).toBe(true);
  });

  test("second SAME-identity file with a mismatched basename is skipped (basename filter precedes dup check); dup-detection itself covered at buildIndexDoc unit level", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-dup-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    // a second file, SAME name@version, but its basename != leaf-1.0.0.json so Fix 2 skips it
    // BEFORE it can reach buildIndexDoc's duplicate check. (Two files cannot share the canonical
    // basename leaf-1.0.0.json in one dir, so the CLI scan can no longer surface a duplicate.)
    const dupFiles = { "leaf.txt": "other" };
    const dupCh = contentHash(new TextEncoder().encode(JSON.stringify(dupFiles)));
    const dupKp = generateKeypair();
    const dupM = { format_version: 1, name: "leaf", version: "1.0.0", content_hash: dupCh };
    const dupPkg = { manifest: { ...dupM, signature: signManifest(dupM, dupKp.privatePem) }, files: dupFiles };
    writeFileSync(join(pkgDir, "leaf-dup.json"), JSON.stringify(dupPkg));
    const keyPath = join(tempHome, "dup.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "dup-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if (!("error" in doc)) {
      // only the canonically-named leaf-1.0.0.json was indexed; the mismatched dup was skipped
      expect(doc.packages.leaf!["1.0.0"]!.url).toBe("https://pkgs/leaf-1.0.0.json");
    }
  });

  test("malformed (non-PEM) key → publish refused (exit 1, no index written)", async () => {
    const { existsSync: existsSyncLocal } = await import("node:fs");
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-badkey-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "bad.pem"); writeFileSync(keyPath, "not a pem at all");
    const outPath = join(tempHome, "badkey-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
    expect(existsSyncLocal(outPath)).toBe(false);
  });

  test("non-ed25519 key → publish refused (exit 1, no index)", async () => {
    const { existsSync: existsLocal } = await import("node:fs");
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-rsa-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const keyPath = join(tempHome, "rsa.pem"); writeFileSync(keyPath, rsa);
    const outPath = join(tempHome, "rsa-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
    expect(existsLocal(outPath)).toBe(false);
  });

  test("existing unparseable --out → publish refused (no rollback reset)", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-corrupt-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "ck.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "corrupt-index.json"); writeFileSync(outPath, "{ truncated");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
  });

  test("package with mismatched content_hash is skipped (not indexed)", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-badhash-"));
    writeSignedPkg(pkgDir, "good", "1.0.0");
    // a package whose content_hash does NOT match files
    const kp = generateKeypair();
    const m = { format_version: 1, name: "bad", version: "1.0.0", content_hash: "blake3:deadbeef" };
    const bad = { manifest: { ...m, signature: signManifest(m, kp.privatePem) }, files: { "bad.txt": "x" } };
    writeFileSync(join(pkgDir, "bad-1.0.0.json"), JSON.stringify(bad));
    const keyPath = join(tempHome, "bh.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "badhash-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if (!("error" in doc)) { expect(doc.packages.good).toBeDefined(); expect(doc.packages.bad).toBeUndefined(); }
  });

  test("tampered existing --out (signature flipped) → publish refused; index unchanged", async () => {
    const { existsSync: existsSyncLocal } = await import("node:fs");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-tamper-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "tk.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "tamper-index.json");
    // publish a valid index once
    const code1 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code1).toBe(0);
    // tamper: lower sequence (still parseable, but sequence is signed so signature no longer verifies)
    const tampered = JSON.parse(readFileSync(outPath, "utf8")) as { sequence: number };
    tampered.sequence = 0;
    const tamperedBytes = JSON.stringify(tampered, null, 2);
    writeFileSync(outPath, tamperedBytes);
    // republish with same key + packages → refused (signature does not verify under --key)
    const code2 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code2).toBe(1);
    // on-disk index unchanged (publish must not overwrite on refusal)
    expect(existsSyncLocal(outPath)).toBe(true);
    expect(readFileSync(outPath, "utf8")).toBe(tamperedBytes);
  });

  test("package file whose basename != name-version.json is skipped", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-mismatch-"));
    // correctly-named package
    writeSignedPkg(pkgDir, "good", "1.0.0");
    // mismatched filename: manifest other@2.0.0 written as mypkg.json (valid content_hash)
    const oFiles = { "other.txt": "x" };
    const oCh = contentHash(new TextEncoder().encode(JSON.stringify(oFiles)));
    const oKp = generateKeypair();
    const oM = { format_version: 1, name: "other", version: "2.0.0", content_hash: oCh };
    const oPkg = { manifest: { ...oM, signature: signManifest(oM, oKp.privatePem) }, files: oFiles };
    writeFileSync(join(pkgDir, "mypkg.json"), JSON.stringify(oPkg));
    const keyPath = join(tempHome, "mm.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "mismatch-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if (!("error" in doc)) {
      expect(doc.packages.good!["1.0.0"]).toBeDefined();
      expect(doc.packages.other).toBeUndefined();
    }
  });

  test("all package files have mismatched basenames → no valid packages (exit 1)", async () => {
    const { existsSync: existsSyncLocal } = await import("node:fs");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-allmismatch-"));
    // only one file, manifest foo@1.0.0 but named mypkg.json
    const fFiles = { "foo.txt": "x" };
    const fCh = contentHash(new TextEncoder().encode(JSON.stringify(fFiles)));
    const fKp = generateKeypair();
    const fM = { format_version: 1, name: "foo", version: "1.0.0", content_hash: fCh };
    const fPkg = { manifest: { ...fM, signature: signManifest(fM, fKp.privatePem) }, files: fFiles };
    writeFileSync(join(pkgDir, "mypkg.json"), JSON.stringify(fPkg));
    const keyPath = join(tempHome, "am.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "allmismatch-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
    expect(existsSyncLocal(outPath)).toBe(false);
  });

  test("package with non-array dependencies is skipped; well-formed sibling is indexed", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-baddeps-"));
    // Good package
    writeSignedPkg(pkgDir, "good", "1.0.0");
    // Bad package: dependencies is a string, not an array
    const badFiles = { "bad.txt": "x" };
    const badCh = contentHash(new TextEncoder().encode(JSON.stringify(badFiles)));
    const badKp = generateKeypair();
    const badM = { format_version: 1 as const, name: "bad", version: "1.0.0", content_hash: badCh };
    const badSig = signManifest(badM, badKp.privatePem);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badPkg = { manifest: { ...badM, dependencies: "not-an-array" as any, signature: badSig }, files: badFiles };
    writeFileSync(join(pkgDir, "bad-1.0.0.json"), JSON.stringify(badPkg));
    const keyPath = join(tempHome, "bd.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "baddeps-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    expect("error" in doc).toBe(false);
    if (!("error" in doc)) {
      expect(doc.packages.good).toBeDefined();
      expect(doc.packages.bad).toBeUndefined();
    }
  });

  test("URL-unsafe name is skipped; well-formed sibling is indexed", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-urlbad-"));
    writeSignedPkg(pkgDir, "good", "1.0.0");
    // bad: name contains '#', which is URL-unsafe
    const badName = "bad#x";
    const badFiles = { "bad.txt": "x" };
    const badCh = contentHash(new TextEncoder().encode(JSON.stringify(badFiles)));
    const badKp = generateKeypair();
    const badM = { format_version: 1, name: badName, version: "1.0.0", content_hash: badCh };
    const badPkg = { manifest: { ...badM, signature: signManifest(badM, badKp.privatePem) }, files: badFiles };
    // filename matches <name>-<version>.json so it clears the basename guard, but name is URL-unsafe
    writeFileSync(join(pkgDir, `${badName}-1.0.0.json`), JSON.stringify(badPkg));
    const keyPath = join(tempHome, "urlbad.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "urlbad-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    expect("error" in doc).toBe(false);
    if (!("error" in doc)) {
      expect(doc.packages.good).toBeDefined();
      expect(doc.packages[badName]).toBeUndefined();
    }
  });

  test("malformed dep edge (missing version) is skipped; well-formed sibling is indexed", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-baddep-"));
    writeSignedPkg(pkgDir, "good", "1.0.0");
    // bad: dep edge missing version field
    const badFiles = { "bad.txt": "x" };
    const badCh = contentHash(new TextEncoder().encode(JSON.stringify(badFiles)));
    const badKp = generateKeypair();
    const badM = { format_version: 1, name: "bad", version: "1.0.0", content_hash: badCh };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badPkg = { manifest: { ...badM, dependencies: [{ kind: "registry", name: "dep" }] as any, signature: signManifest(badM, badKp.privatePem) }, files: badFiles };
    writeFileSync(join(pkgDir, "bad-1.0.0.json"), JSON.stringify(badPkg));
    const keyPath = join(tempHome, "baddep.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "baddep-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    expect("error" in doc).toBe(false);
    if (!("error" in doc)) {
      expect(doc.packages.good).toBeDefined();
      expect(doc.packages.bad).toBeUndefined();
    }
  });

  test("unsafe file path is skipped; well-formed sibling is indexed", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-unsafe-"));
    writeSignedPkg(pkgDir, "good", "1.0.0");
    // bad: files key is a path-traversal path
    const badFiles = { "../escape.txt": "x" };
    const badCh = contentHash(new TextEncoder().encode(JSON.stringify(badFiles)));
    const badKp = generateKeypair();
    const badM = { format_version: 1, name: "bad", version: "1.0.0", content_hash: badCh };
    const badPkg = { manifest: { ...badM, signature: signManifest(badM, badKp.privatePem) }, files: badFiles };
    writeFileSync(join(pkgDir, "bad-1.0.0.json"), JSON.stringify(badPkg));
    const keyPath = join(tempHome, "unsafe.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "unsafe-index.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    expect("error" in doc).toBe(false);
    if (!("error" in doc)) {
      expect(doc.packages.good).toBeDefined();
      expect(doc.packages.bad).toBeUndefined();
    }
  });

  function writeUrlPkg(dir: string, file: string, name: string, version: string, url: unknown) {
    const files = { [`${name}.txt`]: "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const kp = generateKeypair();
    const m = { format_version: 1, name, version, content_hash: ch };
    const pkg = { manifest: { ...m, signature: signManifest(m, kp.privatePem) }, files, url };
    writeFileSync(join(dir, file), JSON.stringify(pkg));
  }

  test("per-package url override is honored; absent derives from base-url", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-url-"));
    writeUrlPkg(pkgDir, "leaf.json", "leaf", "1.0.0", "https://cdn/leaf-v1.json"); // NOT canonical basename
    writeSignedPkg(pkgDir, "other", "2.0.0");                                       // canonical, no url
    const keyPath = join(tempHome, "r-url.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-url.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.packages.leaf!["1.0.0"]!.url).toBe("https://cdn/leaf-v1.json");
    expect(doc.packages.other!["2.0.0"]!.url).toBe("https://pkgs/other-2.0.0.json");
  });

  test("non-canonical filename WITHOUT url is skipped; WITH url is indexed", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-fn-"));
    // bad: leaf.json, no url → filename guard skips it
    const files = { "leaf.txt": "hi" }; const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const kp = generateKeypair(); const m = { format_version: 1, name: "leaf", version: "1.0.0", content_hash: ch };
    writeFileSync(join(pkgDir, "leaf.json"), JSON.stringify({ manifest: { ...m, signature: signManifest(m, kp.privatePem) }, files }));
    const keyPath = join(tempHome, "r-fn.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const out1 = join(tempHome, "i-fn1.json");
    const c1 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", out1]);
    expect(c1).toBe(1); // no valid packages (leaf.json skipped by filename guard)
    // now add url → indexed
    writeUrlPkg(pkgDir, "leaf.json", "leaf", "1.0.0", "https://cdn/leaf.json");
    const out2 = join(tempHome, "i-fn2.json");
    const c2 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", out2]);
    expect(c2).toBe(0);
    const doc = parseIndex(readFileSync(out2, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.packages.leaf!["1.0.0"]!.url).toBe("https://cdn/leaf.json");
  });

  test("invalid url (not an absolute URL) is skipped", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-badurl-"));
    writeUrlPkg(pkgDir, "leaf-1.0.0.json", "leaf", "1.0.0", "leaf#x"); // not absolute
    const keyPath = join(tempHome, "r-bu.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-bu.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1); // only package skipped → no valid packages
  });

  test("comma-separated --packages indexes both dirs; cross-dir duplicate errors", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const dirA = mkdtempSync(join(tmpdir(), "ace-pub-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "ace-pub-b-"));
    writeSignedPkg(dirA, "aa", "1.0.0");
    writeSignedPkg(dirB, "bb", "1.0.0");
    const keyPath = join(tempHome, "r-md.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-md.json");
    const code = await main(["registry", "publish", "--packages", `${dirA},${dirB}`, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.packages.aa).toBeDefined();
    expect(doc.packages.bb).toBeDefined();
    // cross-dir duplicate
    writeSignedPkg(dirB, "aa", "1.0.0");
    const out2 = join(tempHome, "i-md2.json");
    const dup = await main(["registry", "publish", "--packages", `${dirA},${dirB}`, "--base-url", "https://pkgs", "--key", keyPath, "--out", out2]);
    expect(dup).toBe(1);
  });

  test("unreadable listed dir is a hard error", async () => {
    const idxKp = generateKeypair();
    const dirA = mkdtempSync(join(tmpdir(), "ace-pub-ok-"));
    writeSignedPkg(dirA, "aa", "1.0.0");
    const keyPath = join(tempHome, "r-ud.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-ud.json");
    const code = await main(["registry", "publish", "--packages", `${dirA},/no/such/dir/xyz`, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
  });

  test("--sequence sets the sequence; rollback is refused; bad value is a parse error", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-seq-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-seq.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-seq.json");
    const c1 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath, "--sequence", "5"]);
    expect(c1).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.sequence).toBe(5);
    // rollback against prev (5)
    const c2 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath, "--sequence", "3"]);
    expect(c2).toBe(1);
    // bad values → parse error
    expect("error" in parseArgs(["registry", "publish", "--packages", "d", "--base-url", "https://x", "--key", "k", "--sequence", "0"])).toBe(true);
    expect("error" in parseArgs(["registry", "publish", "--packages", "d", "--base-url", "https://x", "--key", "k", "--sequence", "abc"])).toBe(true);
  });
});

describe("ace registry revoke/quarantine/unquarantine (slice 7)", () => {
  let savedFetch: typeof globalThis.fetch;
  beforeEach(() => { savedFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = savedFetch; });

  // Producer helper: write a signed package file named <name>-<version>.json in dir.
  function writeSignedPkg(dir: string, name: string, version: string) {
    const files = { [`${name}.txt`]: "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const kp = generateKeypair();
    const m = { format_version: 1, name, version, content_hash: ch };
    const pkg = { manifest: { ...m, signature: signManifest(m, kp.privatePem) }, files };
    writeFileSync(join(dir, `${name}-${version}.json`), JSON.stringify(pkg));
    return { kp, pkg };
  }

  // ---- Producer-side: marks land in a v2 signed index, sequence bumps ----

  test("revoke makes the index format_version 2, adds revoked mark, bumps sequence, self-verifies", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-rev-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-rev.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "rev-index.json");
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath])).toBe(0);
    const before = readIndexFile(outPath); expect(before.sequence).toBe(1); expect(before.format_version).toBe(1);
    const code = await main(["registry", "revoke", "leaf@1.0.0", "--reason", "key compromise", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const after = readIndexFile(outPath);
    expect(after.format_version).toBe(2);
    expect(after.sequence).toBe(2);
    expect(after.revoked?.leaf?.["1.0.0"]).toBeDefined();
    expect(after.revoked!.leaf!["1.0.0"]!.reason).toBe("key compromise");
  });

  test("revoke against an index signed by a DIFFERENT key is refused (sig verify fails)", async () => {
    const idxKp = generateKeypair();
    const otherKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-rev-otherkey-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-own.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "rev-otherkey-index.json");
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath])).toBe(0);
    const otherPath = join(tempHome, "r-other.pem"); writeFileSync(otherPath, otherKp.privatePem);
    const code = await main(["registry", "revoke", "leaf@1.0.0", "--key", otherPath, "--out", outPath]);
    expect(code).toBe(1);
    const after = readIndexFile(outPath);
    expect(after.sequence).toBe(1);
    expect(after.format_version).toBe(1);
  });

  test("revoke with a missing --out (no existing index) is refused", async () => {
    const idxKp = generateKeypair();
    const keyPath = join(tempHome, "r-noidx.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const code = await main(["registry", "revoke", "leaf@1.0.0", "--key", keyPath, "--out", join(tempHome, "does-not-exist.json")]);
    expect(code).toBe(1);
  });

  test("quarantine an already-revoked version is an error (exit 1)", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-q-on-rev-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-qrev.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "qrev-index.json");
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath])).toBe(0);
    expect(await main(["registry", "revoke", "leaf@1.0.0", "--key", keyPath, "--out", outPath])).toBe(0);
    const code = await main(["registry", "quarantine", "leaf@1.0.0", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
  });

  test("unquarantine a non-quarantined version is an error (exit 1)", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-unq-non-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-unqnon.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "unqnon-index.json");
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath])).toBe(0);
    const code = await main(["registry", "unquarantine", "leaf@1.0.0", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
  });

  test("revoke on a quarantined version moves it (out of quarantined, into revoked)", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-q-then-rev-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-qmove.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "qmove-index.json");
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath])).toBe(0);
    expect(await main(["registry", "quarantine", "leaf@1.0.0", "--reason", "review", "--key", keyPath, "--out", outPath])).toBe(0);
    let doc = readIndexFile(outPath);
    expect(doc.quarantined?.leaf?.["1.0.0"]).toBeDefined();
    expect(doc.revoked?.leaf?.["1.0.0"]).toBeUndefined();
    expect(await main(["registry", "revoke", "leaf@1.0.0", "--key", keyPath, "--out", outPath])).toBe(0);
    doc = readIndexFile(outPath);
    expect(doc.revoked?.leaf?.["1.0.0"]).toBeDefined();
    expect(doc.quarantined?.leaf?.["1.0.0"]).toBeUndefined();
  });

  test("publish after a revoke preserves the mark (carry-forward)", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-after-rev-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-cf.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "cf-index.json");
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath])).toBe(0);
    expect(await main(["registry", "revoke", "leaf@0.9.0", "--reason", "old", "--key", keyPath, "--out", outPath])).toBe(0);
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath])).toBe(0);
    const doc = readIndexFile(outPath);
    expect(doc.format_version).toBe(2);
    expect(doc.revoked?.leaf?.["0.9.0"]).toBeDefined();
  });

  // ---- Consumer-side: resolve/install refuses revoked + quarantined; --allow-quarantined opts in ----
  // Mirrors the slice-6 install-via-remote harness (fetch mock serving index + package by URL).

  const PKG_URL = "https://pkgs/leaf-1.0.0.json";
  const IDX_URL = "https://x/index.json";

  /** Build a signed package + a published+optionally-marked index; serve both via a fetch mock;
   *  register the remote + trust both keys; write a root that depends on leaf@^1.0.0. */
  async function setupConsumer(opts: { mark?: "revoke" | "quarantine"; reason?: string }) {
    const idxKp = generateKeypair();
    const pkgKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-cons-pkgs-"));
    const files = { "leaf.txt": "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const m = { format_version: 1, name: "leaf", version: "1.0.0", content_hash: ch };
    const pkg = { manifest: { ...m, signature: signManifest(m, pkgKp.privatePem) }, files };
    const pkgJson = JSON.stringify(pkg);
    writeFileSync(join(pkgDir, "leaf-1.0.0.json"), pkgJson);
    const keyPath = join(tempHome, "r-cons.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const idxPath = join(tempHome, "cons-index.json");
    expect(await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", idxPath])).toBe(0);
    if (opts.mark === "revoke") {
      expect(await main(["registry", "revoke", "leaf@1.0.0", ...(opts.reason ? ["--reason", opts.reason] : []), "--key", keyPath, "--out", idxPath])).toBe(0);
    } else if (opts.mark === "quarantine") {
      expect(await main(["registry", "quarantine", "leaf@1.0.0", ...(opts.reason ? ["--reason", opts.reason] : []), "--key", keyPath, "--out", idxPath])).toBe(0);
    }
    const serve = (u: string) => new Response(u === PKG_URL ? pkgJson : readFileSync(idxPath, "utf8"), { status: 200 });
    globalThis.fetch = (async (u: string) => serve(u)) as unknown as typeof fetch;
    await main(["trust", "add", idxKp.publicSpkiB64]);
    await main(["trust", "add", pkgKp.publicSpkiB64]);
    await main(["registry", "remote", "add", IDX_URL, "--key", idxKp.keyId]);
    const root = { manifest: { format_version: 1, name: "root", version: "1.0.0",
      content_hash: contentHash(new TextEncoder().encode(JSON.stringify({ "r.txt": "r" }))),
      dependencies: [{ kind: "registry", name: "leaf", version: "^1.0.0" }] }, files: { "r.txt": "r" } };
    const rootPath = join(tempHome, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    return { rootPath, idxPath, keyPath, pkgJson, serve, store: () => join(tempHome, ".ace", "store") };
  }

  async function freshFetchAfterCacheWipe(serve: (u: string) => Response) {
    const { rmSync } = await import("node:fs");
    const { registryCacheDir } = await import("./store.ts");
    rmSync(registryCacheDir(), { recursive: true, force: true });
    globalThis.fetch = (async (u: string) => serve(u)) as unknown as typeof fetch;
  }

  test("install of a revoked registry version refuses (resolve)", async () => {
    const c = await setupConsumer({ mark: "revoke", reason: "compromise" });
    const code = await main(["install", c.rootPath, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(listInstalled(c.store()).some((p) => p.manifest.name === "leaf")).toBe(false);
  });

  test("install of a quarantined version refuses without --allow-quarantined, installs with it", async () => {
    const c = await setupConsumer({ mark: "quarantine", reason: "review" });
    const refused = await main(["install", c.rootPath, "--allow-no-signature"]);
    expect(refused).toBe(1);
    expect(listInstalled(c.store()).some((p) => p.manifest.name === "leaf")).toBe(false);
    const allowed = await main(["install", c.rootPath, "--allow-no-signature", "--allow-quarantined"]);
    expect(allowed).toBe(0);
    expect(listInstalled(c.store()).some((p) => p.manifest.name === "leaf")).toBe(true);
  });

  test("unquarantine restores normal install", async () => {
    const c = await setupConsumer({ mark: "quarantine", reason: "review" });
    expect(await main(["install", c.rootPath, "--allow-no-signature"])).toBe(1);
    expect(await main(["registry", "unquarantine", "leaf@1.0.0", "--key", c.keyPath, "--out", c.idxPath])).toBe(0);
    await freshFetchAfterCacheWipe(c.serve);
    const code = await main(["install", c.rootPath, "--allow-no-signature"]);
    expect(code).toBe(0);
    expect(listInstalled(c.store()).some((p) => p.manifest.name === "leaf")).toBe(true);
  });

  test("lockfile pins leaf@1.0.0; then revoke; ace install --frozen refuses (revocation overrides lockfile)", async () => {
    const c = await setupConsumer({});
    const lockPath = join(tempHome, "ace.lock");
    expect(await main(["install", c.rootPath, "--allow-no-signature", "--lockfile", lockPath])).toBe(0);
    expect(existsSync(lockPath)).toBe(true);
    expect(await main(["registry", "revoke", "leaf@1.0.0", "--reason", "compromise", "--key", c.keyPath, "--out", c.idxPath])).toBe(0);
    await freshFetchAfterCacheWipe(c.serve);
    const store = mkdtempSync(join(tmpdir(), "ace-lock-rev-store-"));
    const code = await main(["install", c.rootPath, "--store", store, "--allow-no-signature", "--lockfile", lockPath, "--frozen"]);
    expect(code).toBe(1);
  });
});

describe("ace deps subcommand (B-0821)", () => {
  test("validate with valid graph exits 0", async () => {
    const graphYaml = `
apiVersion: zeta.lucent-financial-group.com/v1
kind: AppDependencyGraph
metadata:
  name: my-app
spec:
  dependsOn:
    - chart: postgres
    - chart: redis
`;
    const graphPath = join(tempHome, "deps-valid.yaml");
    writeFileSync(graphPath, graphYaml);
    const code = await main(["deps", "validate", "--graph", graphPath]);
    expect(code).toBe(0);
  });

  test("validate with cyclic graph exits 1", async () => {
    const graphYaml = `
apiVersion: zeta.lucent-financial-group.com/v1
kind: AppDependencyGraph
metadata:
  name: my-app
spec:
  dependsOn:
    - chart: chart-a
      dependsOn: [chart-b]
    - chart: chart-b
      dependsOn: [chart-a]
`;
    const graphPath = join(tempHome, "deps-cyclic.yaml");
    writeFileSync(graphPath, graphYaml);
    const code = await main(["deps", "validate", "--graph", graphPath]);
    expect(code).toBe(1);
  });

  test("resolve generates Flux and ArgoCD manifests in outDir", async () => {
    const graphYaml = `
apiVersion: zeta.lucent-financial-group.com/v1
kind: AppDependencyGraph
metadata:
  name: my-app
spec:
  dependsOn:
    - chart: postgres
      version: 15.2.0
`;
    const graphPath = join(tempHome, "deps-resolve.yaml");
    writeFileSync(graphPath, graphYaml);
    const outDir = join(tempHome, "manifests-out");

    const code = await main([
      "deps",
      "resolve",
      "--graph",
      graphPath,
      "--out-dir",
      outDir,
    ]);
    expect(code).toBe(0);

    expect(existsSync(join(outDir, "postgres-helmrelease.yaml"))).toBe(true);
    expect(existsSync(join(outDir, "postgres-application.yaml"))).toBe(true);
  });

  test("resolve generates only Flux when outputEngine is flux", async () => {
    const graphYaml = `
apiVersion: zeta.lucent-financial-group.com/v1
kind: AppDependencyGraph
metadata:
  name: my-app
spec:
  dependsOn:
    - chart: postgres
`;
    const graphPath = join(tempHome, "deps-resolve-flux.yaml");
    writeFileSync(graphPath, graphYaml);
    const outDir = join(tempHome, "manifests-flux-out");

    const code = await main([
      "deps",
      "resolve",
      "--graph",
      graphPath,
      "--out-dir",
      outDir,
      "--output-engine",
      "flux",
    ]);
    expect(code).toBe(0);

    expect(existsSync(join(outDir, "postgres-helmrelease.yaml"))).toBe(true);
    expect(existsSync(join(outDir, "postgres-application.yaml"))).toBe(false);
  });
});
