import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, closeSync, openSync, statSync, existsSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { generateKeyPairSync, createHash } from "node:crypto";
import { parseArgs, main } from "./ace.ts";
import { listInstalled, contentHash, listTrustedKeys, loadRegistry } from "./store.ts";
import { generateKeypair, signManifest } from "./signing.ts";
import { packageHash } from "./resolve.ts";
import { parseLockfile } from "./lockfile.ts";

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
    pkg.manifest.content_hash = "sha256:TAMPERED"; // but signature was over original
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
    const B = { manifest: { format_version:1, name:"B", version:"1.0.0", content_hash: h({ "b.txt":"b" }) }, files: { "b.txt":"b" } };
    writeFileSync(join(dir,"B.json"), JSON.stringify(B));
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: "sha256:deadbeef", dependencies:[{ kind: "inline" as const, name:"B", version:"1.0.0", url: join(dir,"B.json"), package_hash: packageHash(B as any) }] }, files: { "r.txt":"r" } };
    writeFileSync(join(dir,"root.json"), JSON.stringify(root));
    const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });

  test("store-collision: two distinct packages with identical files install NOTHING", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
    const D = { manifest: { format_version:1, name:"D", version:"1.0.0", content_hash: h({ "d.txt":"d" }) }, files: { "d.txt":"d" } };
    const dPath = join(dir, "D.json"); writeFileSync(dPath, JSON.stringify(D));
    expect(await main(["registry", "add", "D", "1.0.0", dPath])).toBe(0);
    const reg = loadRegistry();
    expect(reg.get("D")?.get("1.0.0")?.package_hash).toBe(packageHash(D as any));
    expect(await main(["registry", "list"])).toBe(0);
  });

  test("registry add normalizes a relative local path to absolute (cwd-independent install)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string, string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string, string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
    const D = { manifest: { format_version: 1, name: "D", version: "1.0.0", content_hash: h({ "d.txt": "d" }) }, files: { "d.txt": "d" } };
    const p = join(dir, "D.json");
    writeFileSync(p, JSON.stringify(D));
    expect(await main(["registry", "add", "WRONGNAME", "1.0.0", p])).toBe(65);
  });
  test("e2e: install a root with a registry dep resolves via the registry", async () => {
    const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
    const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry", name:"MISSING", version:"1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const code = await main(["install", rootPath, "--store", store, "--allow-no-signature"]);
    expect(code).toBe(1);
    expect(listInstalled(store).length).toBe(0);
  });
});

// ---- frozen lockfile replay (slice 5.3) ----

describe("install --frozen (slice 5.3)", () => {
  const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");

  // Builds an inline root->A graph in a temp dir, installs it once with --lockfile to
  // generate the lock (the lock's node url points at the temp A.json — registry never used),
  // then returns paths so a --frozen run can replay it against an EMPTY registry.
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
    // 2. Replay into a fresh store with --frozen. Registry is empty (no registry add); the
    //    replay must install entirely from the lock's pinned url, never consulting the registry.
    expect(loadRegistry().size).toBe(0);
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
    // rather than THROW (np.manifest.content_hash on an undefined manifest). To EXERCISE the guard
    // (not an earlier check), the lock must pin the MALFORMED payload's package_hash so the pin
    // check PASSES and execution reaches the shape guard — the exact line that throws unguarded.
    // Mirrors the untrusted-signature/atomicity tests: build the lock directly to reach a gate.
    const dir = mkdtempSync(join(tmpdir(), "ace-frozen-malformed-"));
    const malformed = {}; // valid JSON, no manifest/files — packageHash() runs, np.manifest.content_hash throws
    const aPath = join(dir, "A.json"); writeFileSync(aPath, JSON.stringify(malformed));
    const aHash = packageHash(malformed as any); // pin == the malformed payload's hash → pin check passes
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
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
    const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
    const A = { manifest: { format_version:1, name:"A", version:"1.2.0", content_hash: h({ "a.txt":"a" }) }, files: { "a.txt":"a" } };
    const ap = join(dir, "A.json"); writeFileSync(ap, JSON.stringify(A)); await main(["registry","add","A","1.2.0",ap]);
    const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry" as const, name:"A", version:"^1.0.0" }] }, files: { "r.txt":"r" } };
    const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    expect(await main(["install", rootPath, "--store", store, "--allow-no-signature", "--print-resolution"])).toBe(0);
  });
});
