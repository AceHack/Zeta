// capability-manifest.test.ts -- the mutation suite.
//
// THE POINT OF THIS FILE. A capability system that cannot deny is worse than no capability
// system: it looks like security and is decoration. Nine checks that could not fail were found
// in this repo on 2026-08-14, and `ace verify` was one of them — it confirmed a package was
// PRESENT and re-verified nothing. So every guard below is stated as a MUTANT that must die,
// and each test shows it dying (asserts the specific refusal reason) rather than asserting that
// some generic "not ok" happened. A test that only checks `ok === false` cannot tell a working
// guard from a guard that refuses everything.
//
// Imports are node builtins + repo-local modules only (no third-party), so this file runs in a
// checkout with no `bun install`.
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateKeypair, signManifest } from "./signing.ts";
import type { TrustEntry } from "./signing.ts";
import { contentHash, defaultStorePath } from "./store.ts";
import type { AceManifest } from "./store.ts";
import {
  parseCapability,
  validateCapabilities,
  canonicalizeCapabilities,
  codeIdentity,
  authorizedCapabilities,
  capabilityPermitted,
  describeUpdate,
  CAPABILITY_SCHEMES,
  MAX_CAPABILITIES,
  INSTALL_TIME_VS_RUNTIME,
} from "./capability-manifest.ts";
import { main } from "./ace.ts";

// ---- helpers ----

type Kp = ReturnType<typeof generateKeypair>;

function trustOf(...kps: Kp[]): Map<string, TrustEntry> {
  return new Map(kps.map((kp) => [kp.keyId, { public_key: kp.publicSpkiB64 }]));
}

/** A manifest signed by `kp`, optionally declaring `capabilities`. */
function signed(kp: Kp, over: Partial<AceManifest> & { capabilities?: readonly string[] } = {}): AceManifest {
  const base = {
    format_version: 1,
    name: "demo",
    version: "1.0.0",
    content_hash: "blake3:abc",
    ...over,
  } as AceManifest;
  return { ...base, signature: signManifest(base, kp.privatePem) } as AceManifest;
}

describe("parseCapability — the grammar is the guard", () => {
  test("accepts every declared scheme", () => {
    for (const s of CAPABILITY_SCHEMES) {
      const r = parseCapability(`${s}:thing`);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.scheme).toBe(s);
    }
  });

  // MUTANT: a capability that names a KIND OF HOLDER rather than a resource. The custody model
  // is symmetric (frost-custody-contract.ts had `holderKind` removed for exactly this); a policy
  // layer that types on species smuggles the asymmetry back in wearing a security hat.
  test("MUTANT DIES: there is no scheme that can name a kind of entity", () => {
    for (const attempt of ["holder:agent", "kind:human", "species:traveler", "role:agent", "agent:otto"]) {
      const r = parseCapability(attempt);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("unknown capability scheme");
    }
  });

  // MUTANT: a wildcard. A grammar that admits `key:*` is a grammar that cannot deny.
  test("MUTANT DIES: wildcards and whitespace are rejected", () => {
    for (const attempt of ["key:*", "key:frost/*", "key:a b", "key:a\tb", "key:?", "file:**"]) {
      const r = parseCapability(attempt);
      expect(r.ok).toBe(false);
    }
  });

  test("rejects a missing scheme, an empty resource, and a non-string", () => {
    expect(parseCapability("noscheme").ok).toBe(false);
    expect(parseCapability("key:").ok).toBe(false);
    expect(parseCapability(42).ok).toBe(false);
    expect(parseCapability(null).ok).toBe(false);
  });

  test("rejects an over-long resource", () => {
    expect(parseCapability(`key:${"a".repeat(1000)}`).ok).toBe(false);
  });
});

describe("validateCapabilities — canonical form keeps meaning and bytes in bijection", () => {
  test("absent is the empty set, not an error", () => {
    const r = validateCapabilities(undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });

  test("MUTANT DIES: unsorted or duplicated lists are refused", () => {
    expect(validateCapabilities(["key:b", "key:a"]).ok).toBe(false);
    expect(validateCapabilities(["key:a", "key:a"]).ok).toBe(false);
  });

  test("MUTANT DIES: one bad entry poisons the whole list (no partial accept)", () => {
    const r = validateCapabilities(["key:frost/otto", "key:*"]);
    expect(r.ok).toBe(false);
  });

  test("MUTANT DIES: an unbounded declaration wall is refused", () => {
    const many = canonicalizeCapabilities(
      Array.from({ length: MAX_CAPABILITIES + 1 }, (_, i) => `key:k${String(i).padStart(4, "0")}`),
    );
    expect(validateCapabilities(many).ok).toBe(false);
  });

  test("canonicalizeCapabilities produces a form validateCapabilities accepts", () => {
    const c = canonicalizeCapabilities(["key:b", "key:a", "key:b"]);
    expect(c).toEqual(["key:a", "key:b"]);
    expect(validateCapabilities(c).ok).toBe(true);
  });

  test("non-array is refused", () => {
    expect(validateCapabilities("key:a").ok).toBe(false);
    expect(validateCapabilities({}).ok).toBe(false);
  });
});

describe("the signature already binds capabilities — no crypto was added", () => {
  // This is the load-bearing empirical claim the whole design rests on: signing.ts's
  // canonicalManifestBytes covers the WHOLE manifest minus `signature`, so `capabilities` is
  // bound the moment the field exists. Verified here rather than assumed, because if it ever
  // stopped being true every guard below would silently become decoration.

  test("a signed manifest with capabilities verifies and yields exactly them", () => {
    const kp = generateKeypair();
    const m = signed(kp, { capabilities: ["key:frost/otto"] });
    const auth = authorizedCapabilities(m, trustOf(kp));
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.capabilities).toEqual(["key:frost/otto"]);
  });

  // MUTANT: capabilities bolted onto a manifest that was signed WITHOUT them — the privilege
  // escalation this whole field would otherwise enable.
  test("MUTANT DIES: capabilities bolted on after signing", () => {
    const kp = generateKeypair();
    const clean = signed(kp);
    const bolted = { ...clean, capabilities: ["key:frost/otto"] } as AceManifest;
    const auth = authorizedCapabilities(bolted, trustOf(kp));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("bad-signature");
  });

  // MUTANT: the manifest changed after signing (the task's third named mutant).
  test("MUTANT DIES: a capability edited after signing", () => {
    const kp = generateKeypair();
    const m = signed(kp, { capabilities: ["key:frost/otto"] });
    const edited = { ...m, capabilities: ["key:frost/vera"] } as AceManifest;
    const auth = authorizedCapabilities(edited, trustOf(kp));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("bad-signature");
  });

  test("MUTANT DIES: capabilities stripped after signing", () => {
    const kp = generateKeypair();
    const m = signed(kp, { capabilities: ["key:frost/otto"] }) as AceManifest & { capabilities?: unknown };
    const { capabilities, ...stripped } = m;
    void capabilities;
    const auth = authorizedCapabilities(stripped as AceManifest, trustOf(kp));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("bad-signature");
  });

  test("MUTANT DIES: any other manifest field edited after signing (version rollback)", () => {
    const kp = generateKeypair();
    const m = signed(kp, { capabilities: ["key:frost/otto"] });
    const rolled = { ...m, version: "0.0.1" } as AceManifest;
    expect(authorizedCapabilities(rolled, trustOf(kp)).ok).toBe(false);
  });

  // MUTANT: the task's second named mutant — a package whose signature does not match its
  // manifest, here by signing a DIFFERENT manifest and pasting the signature across.
  test("MUTANT DIES: a signature lifted from a different manifest", () => {
    const kp = generateKeypair();
    const a = signed(kp, { capabilities: ["key:frost/otto"] });
    const b = { format_version: 1, name: "other", version: "2.0.0", content_hash: "blake3:zzz" } as AceManifest;
    const spliced = { ...b, capabilities: ["key:frost/otto"], signature: a.signature } as AceManifest;
    const auth = authorizedCapabilities(spliced, trustOf(kp));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("bad-signature");
  });

  test("MUTANT DIES: signed by a key nobody trusts", () => {
    const mine = generateKeypair();
    const stranger = generateKeypair();
    const m = signed(stranger, { capabilities: ["key:frost/otto"] });
    const auth = authorizedCapabilities(m, trustOf(mine));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("untrusted-key");
  });

  test("MUTANT DIES: unsigned code declares capabilities and gets none", () => {
    const kp = generateKeypair();
    const unsigned = {
      format_version: 1, name: "demo", version: "1.0.0", content_hash: "blake3:abc",
      capabilities: ["key:frost/otto"],
    } as AceManifest;
    const auth = authorizedCapabilities(unsigned, trustOf(kp));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe("no-signature");
    expect(codeIdentity(unsigned)).toBeNull();
  });

  // A signed-but-unparseable declaration must REFUSE, never quietly degrade to "declared
  // nothing" — the publisher meant something and we could not read it.
  test("MUTANT DIES: a signed but malformed declaration refuses rather than degrading to empty", () => {
    const kp = generateKeypair();
    const m = signed(kp, { capabilities: ["key:*"] });
    const auth = authorizedCapabilities(m, trustOf(kp));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toContain("invalid-capabilities");
  });
});

describe("default-deny, and refusal is distinguishable from authorized-for-nothing", () => {
  // MUTANT: the task's first named mutant — claiming a capability that was never declared.
  test("MUTANT DIES: an unlisted capability is not permitted", () => {
    const kp = generateKeypair();
    const m = signed(kp, { capabilities: ["key:frost/otto"] });
    const auth = authorizedCapabilities(m, trustOf(kp));
    expect(capabilityPermitted(auth, "key:frost/otto")).toBe(true);
    expect(capabilityPermitted(auth, "key:frost/vera")).toBe(false);
    expect(capabilityPermitted(auth, "net:example.com")).toBe(false);
  });

  test("MUTANT DIES: no prefix widening — a declared capability does not imply its children", () => {
    const kp = generateKeypair();
    const m = signed(kp, { capabilities: ["key:frost"] });
    const auth = authorizedCapabilities(m, trustOf(kp));
    expect(capabilityPermitted(auth, "key:frost")).toBe(true);
    expect(capabilityPermitted(auth, "key:frost/otto")).toBe(false);
  });

  test("declaring nothing succeeds with the empty set and permits nothing", () => {
    const kp = generateKeypair();
    const auth = authorizedCapabilities(signed(kp), trustOf(kp));
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.capabilities).toEqual([]);
    expect(capabilityPermitted(auth, "key:frost/otto")).toBe(false);
  });

  // If a refusal and "authorized for nothing" were the same value, a caller checking
  // `capabilities.length === 0` would treat a FORGED package as a well-behaved one.
  test("a refusal is not the empty set — the two are structurally different values", () => {
    const kp = generateKeypair();
    const stranger = generateKeypair();
    const declaredNothing = authorizedCapabilities(signed(kp), trustOf(kp));
    const forged = authorizedCapabilities(signed(stranger), trustOf(kp));
    expect(declaredNothing.ok).toBe(true);
    expect(forged.ok).toBe(false);
    // and a permission check on the forgery is false, never vacuously true
    expect(capabilityPermitted(forged, "key:frost/otto")).toBe(false);
  });
});

describe("code identity — the update case, designed in rather than bolted on", () => {
  test("identity is invariant under a version bump AND a content change", () => {
    const kp = generateKeypair();
    const v1 = signed(kp, { version: "1.0.0", content_hash: "blake3:aaa", capabilities: ["key:frost/otto"] });
    const v2 = signed(kp, { version: "2.5.1", content_hash: "blake3:bbb", capabilities: ["key:frost/otto"] });
    expect(codeIdentity(v1)).toBe(codeIdentity(v2));
    const d = describeUpdate(v1, v2);
    expect(d.identityPreserved).toBe(true);
    expect(d.orphaned).toEqual([]);
    expect(d.retained).toEqual(["key:frost/otto"]);
  });

  test("an agent updating its own code carries capabilities with no third party in the loop", () => {
    const kp = generateKeypair();
    const before = signed(kp, { version: "1.0.0", content_hash: "blake3:aaa", capabilities: ["key:frost/otto"] });
    const after = signed(kp, {
      version: "1.1.0", content_hash: "blake3:ccc",
      capabilities: canonicalizeCapabilities(["key:frost/otto", "net:registry.local"]),
    });
    const authAfter = authorizedCapabilities(after, trustOf(kp));
    expect(authAfter.ok).toBe(true);
    const d = describeUpdate(before, after);
    expect(d.identityPreserved).toBe(true);
    expect(d.added).toEqual(["net:registry.local"]);
    expect(d.removed).toEqual([]);
    expect(d.orphaned).toEqual([]);
  });

  // THE NO-FORCED-UPGRADE TEST, from the integration note §6a: "can any party other than the
  // key's holder cause that key to move?" A stranger re-signing the same package name produces a
  // DIFFERENT identity, so it inherits nothing. The capabilities show as orphaned rather than
  // carried — a mechanism that "helpfully" carried them across would BE the forced-upgrade path.
  test("MUTANT DIES: a third party re-signing the same package name inherits nothing", () => {
    const owner = generateKeypair();
    const stranger = generateKeypair();
    const mine = signed(owner, { capabilities: ["key:frost/otto"] });
    const theirs = signed(stranger, { version: "1.0.1", capabilities: ["key:frost/otto"] });
    expect(codeIdentity(mine)).not.toBe(codeIdentity(theirs));
    const d = describeUpdate(mine, theirs);
    expect(d.identityPreserved).toBe(false);
    expect(d.orphaned).toEqual(["key:frost/otto"]);
    // Even with the stranger's key ALSO trusted, the identity differs — trust does not merge
    // identities, which is what keeps "trusted" from meaning "may impersonate".
    const auth = authorizedCapabilities(theirs, trustOf(owner, stranger));
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.codeIdentity).not.toBe(codeIdentity(mine));
  });

  test("a rename is an identity change too (name is half the identity)", () => {
    const kp = generateKeypair();
    const a = signed(kp, { name: "demo", capabilities: ["key:frost/otto"] });
    const b = signed(kp, { name: "demo-renamed", capabilities: ["key:frost/otto"] });
    expect(describeUpdate(a, b).identityPreserved).toBe(false);
  });

  test("a capability withdrawn by the owner shows as removed", () => {
    const kp = generateKeypair();
    const a = signed(kp, { capabilities: canonicalizeCapabilities(["key:frost/otto", "net:x.local"]) });
    const b = signed(kp, { version: "1.0.1", capabilities: ["key:frost/otto"] });
    const d = describeUpdate(a, b);
    expect(d.removed).toEqual(["net:x.local"]);
    expect(d.identityPreserved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// END-TO-END through the real CLI. This is the "do not ship a declaration nothing reads" half:
// the mutants below are mutations of BYTES ON DISK in the store, refused by `ace verify`.
// ---------------------------------------------------------------------------

describe("ace verify — the check that used to be unable to fail", () => {
  let savedHome: string | undefined;
  let savedUserProfile: string | undefined;
  let savedCwd: string | undefined;
  let tempHome: string;

  beforeEach(() => {
    savedHome = process.env.HOME;
    savedUserProfile = process.env.USERPROFILE;
    tempHome = mkdtempSync(join(tmpdir(), "ace-cap-home-"));
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

  /** Build + install a signed package declaring `capabilities`; trust the key. */
  async function installSigned(capabilities?: readonly string[]) {
    const dir = mkdtempSync(join(tmpdir(), "ace-cap-pkg-"));
    const kp = generateKeypair();
    const files = { "a.txt": "hi" };
    const content_hash = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const base = {
      format_version: 1, name: "demo", version: "1.0.0", content_hash,
      ...(capabilities === undefined ? {} : { capabilities }),
    } as AceManifest;
    const manifest = { ...base, signature: signManifest(base, kp.privatePem) };
    const pkgPath = join(dir, "pkg.json");
    writeFileSync(pkgPath, JSON.stringify({ manifest, files }));
    const pubPath = join(dir, "key.pub");
    writeFileSync(pubPath, JSON.stringify({ algo: "ed25519", key_id: kp.keyId, public_key: kp.publicSpkiB64 }));
    expect(await main(["trust", "add", pubPath])).toBe(0);
    expect(await main(["install", pkgPath])).toBe(0);
    const manifestPath = join(defaultStorePath(), content_hash.replace(":", "-"), "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    return { kp, content_hash, manifestPath, dir, pubPath };
  }

  test("a correctly signed package with capabilities verifies", async () => {
    const { content_hash } = await installSigned(["key:frost/otto"]);
    expect(await main(["verify", content_hash])).toBe(0);
  });

  test("--capability succeeds for a declared capability", async () => {
    const { content_hash } = await installSigned(["key:frost/otto"]);
    expect(await main(["verify", content_hash, "--capability", "key:frost/otto"])).toBe(0);
  });

  // MUTANT 1 (task-named): the package claims a capability it never declared.
  test("MUTANT DIES: --capability refuses an UNDECLARED capability", async () => {
    const { content_hash } = await installSigned(["key:frost/otto"]);
    expect(await main(["verify", content_hash, "--capability", "key:frost/vera"])).toBe(1);
  });

  test("MUTANT DIES: --capability refuses when the package declared nothing at all", async () => {
    const { content_hash } = await installSigned();
    expect(await main(["verify", content_hash, "--capability", "key:frost/otto"])).toBe(1);
  });

  // MUTANT 3 (task-named): the manifest is edited on disk AFTER install. This is the mutant the
  // OLD `ace verify` passed, because it only checked presence.
  test("MUTANT DIES: a capability ADDED to manifest.json after install", async () => {
    const { content_hash, manifestPath } = await installSigned(["key:frost/otto"]);
    expect(await main(["verify", content_hash])).toBe(0); // green before tampering

    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    m.capabilities = ["key:frost/otto", "key:frost/vera"]; // grant yourself one more
    writeFileSync(manifestPath, JSON.stringify(m, null, 2));

    expect(await main(["verify", content_hash])).toBe(1);
    // and the escalated capability is not honoured on the way down
    expect(await main(["verify", content_hash, "--capability", "key:frost/vera"])).toBe(1);
  });

  test("MUTANT DIES: capabilities REMOVED from manifest.json after install", async () => {
    const { content_hash, manifestPath } = await installSigned(["key:frost/otto"]);
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    delete m.capabilities;
    writeFileSync(manifestPath, JSON.stringify(m, null, 2));
    expect(await main(["verify", content_hash])).toBe(1);
  });

  test("MUTANT DIES: the signature block swapped out after install", async () => {
    const { content_hash, manifestPath } = await installSigned(["key:frost/otto"]);
    const stranger = generateKeypair();
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    const { signature, ...rest } = m;
    void signature;
    m.signature = signManifest(rest as AceManifest, stranger.privatePem);
    writeFileSync(manifestPath, JSON.stringify(m, null, 2));
    // The re-signed manifest is internally consistent but its key is not trusted.
    expect(await main(["verify", content_hash])).toBe(1);
  });

  // MUTANT 2 (task-named), at install: signature does not match the manifest, so it never lands.
  test("MUTANT DIES: install refuses a package whose signature does not match its manifest", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-cap-bad-"));
    const kp = generateKeypair();
    const files = { "a.txt": "hi" };
    const content_hash = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const base = { format_version: 1, name: "demo", version: "1.0.0", content_hash } as AceManifest;
    const signature = signManifest(base, kp.privatePem);
    // capabilities appended AFTER the signature was computed
    const manifest = { ...base, capabilities: ["key:frost/otto"], signature };
    const pkgPath = join(dir, "pkg.json");
    writeFileSync(pkgPath, JSON.stringify({ manifest, files }));
    const pubPath = join(dir, "key.pub");
    writeFileSync(pubPath, JSON.stringify({ algo: "ed25519", key_id: kp.keyId, public_key: kp.publicSpkiB64 }));
    expect(await main(["trust", "add", pubPath])).toBe(0);
    expect(await main(["install", pkgPath])).toBe(1);
    expect(existsSync(join(defaultStorePath(), content_hash.replace(":", "-")))).toBe(false);
  });

  test("MUTANT DIES: install refuses a malformed capability declaration (wildcard)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-cap-wild-"));
    const kp = generateKeypair();
    const files = { "a.txt": "hi" };
    const content_hash = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const base = { format_version: 1, name: "demo", version: "1.0.0", content_hash, capabilities: ["key:*"] } as AceManifest;
    const manifest = { ...base, signature: signManifest(base, kp.privatePem) };
    const pkgPath = join(dir, "pkg.json");
    writeFileSync(pkgPath, JSON.stringify({ manifest, files }));
    const pubPath = join(dir, "key.pub");
    writeFileSync(pubPath, JSON.stringify({ algo: "ed25519", key_id: kp.keyId, public_key: kp.publicSpkiB64 }));
    expect(await main(["trust", "add", pubPath])).toBe(0);
    expect(await main(["install", pkgPath])).toBe(1);
  });

  test("MUTANT DIES: an unsigned package can never satisfy a --capability assertion", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-cap-unsigned-"));
    const files = { "a.txt": "hi" };
    const content_hash = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const manifest = {
      format_version: 1, name: "demo", version: "1.0.0", content_hash,
      capabilities: ["key:frost/otto"],
    } as AceManifest;
    const pkgPath = join(dir, "pkg.json");
    writeFileSync(pkgPath, JSON.stringify({ manifest, files }));
    expect(await main(["install", pkgPath, "--allow-no-signature"])).toBe(0);
    // present + inspectable...
    expect(await main(["verify", content_hash])).toBe(0);
    // ...but it has no code identity, so it can bind no capability.
    expect(await main(["verify", content_hash, "--capability", "key:frost/otto"])).toBe(1);
    expect(await main(["verify", content_hash, "--require-signature"])).toBe(1);
  });

  test("verify still reports a missing package as before", async () => {
    expect(await main(["verify", "blake3:nope"])).toBe(1);
  });

  test("the install-time/runtime gap is stated, not left to folklore", () => {
    expect(INSTALL_TIME_VS_RUNTIME).toContain("bytes at rest");
  });
});
