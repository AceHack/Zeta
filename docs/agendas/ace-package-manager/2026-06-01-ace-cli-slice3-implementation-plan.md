# Ace CLI slice 3 — authenticity / Ed25519 signature verify — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ed25519 signature **authenticity** to Ace — `keygen`/`sign`/`trust`
verbs plus an install-time signature gate — so the untrusted skills-store
distribution surface is defended, closing the gap slice 2 left loud.

**Architecture:** New pure-crypto module `tools/ace/signing.ts` (Ed25519 via
`node:crypto`, whole-manifest-minus-`signature` recursive-key-sort canonicalization);
trust-store I/O added to `store.ts` (bundled `tools/ace/trusted-keys.json` ∪
`~/.ace/trusted-keys.json`); `ace.ts` wires the verbs + the enforcement policy.
`installPackage` + `contentHash` are UNCHANGED (slice-2 contract intact); the
signer reuses slice-2 `contentHash` so signer/installer always agree.

**Tech Stack:** TypeScript on Bun; `node:crypto` (Ed25519, zero-dep); `bun:test`.

**Design spec:** [`2026-06-01-ace-cli-slice3-authenticity-signature-verify-design.md`](2026-06-01-ace-cli-slice3-authenticity-signature-verify-design.md) — read §3 (canonicalization), §6 (gate), §8 (threat model) before implementing.

**Repo conventions (load-bearing):**

- Bun runtime; tests `bun:test`; run `bun test tools/ace/`. Match existing test style in `tools/ace/ace.test.ts` (`describe`/`test`/`expect`, `mkdtempSync` temp dirs, exit-code asserts).
- **Otto-343 hook:** if `Edit` is blocked, use `Write` (full file) or `sed`/`awk`/`python`.
- Commit per task; each message ends with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Verify `git branch --show-current` == `otto-windows/ace-slice3-build-2026-06-01` before each commit. Do NOT push or open a PR (the controller handles push/PR).
- **Integrity only stays unchanged.** Do NOT modify `contentHash` or `installPackage` semantics.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `tools/ace/signing.ts` | Pure Ed25519 crypto: keygen, key_id, canonical manifest bytes, sign, verify | **create** |
| `tools/ace/signing.test.ts` | Unit tests for signing.ts (pure) | **create** |
| `tools/ace/trusted-keys.json` | Bundled root trust anchor (ships `[]`) | **create** |
| `tools/ace/store.ts` | + `signature?` on `AceManifest`; + trust-store I/O (`trustStorePath`, `bundledTrustPath`, `loadTrustStore`, `addTrustedKey`, `listTrustedKeys`). `contentHash`/`installPackage` unchanged | **modify** |
| `tools/ace/store.test.ts` | + trust-store tests | **modify** |
| `tools/ace/ace.ts` | + `keygen`/`sign`/`trust` verbs + install authenticity gate (`--allow-unsigned`) | **modify** |
| `tools/ace/ace.test.ts` | + verb + gate tests | **modify** |
| `.claude/skills/ace/SKILL.md` | + new verbs; integrity→authenticity note | **modify** |

---

## Task 1: `signing.ts` — pure Ed25519 crypto + the `signature` manifest field

**Files:**

- Modify: `tools/ace/store.ts` (add the optional `signature` field to `AceManifest` only — no logic change)
- Create: `tools/ace/signing.ts`
- Create: `tools/ace/signing.test.ts`

- [ ] **Step 1: Add the optional `signature` field to `AceManifest` in `store.ts`**

In `tools/ace/store.ts`, extend the interface (this is the ONLY store.ts change in Task 1; `contentHash`/`installPackage` untouched):

```ts
export interface AceManifest {
  readonly format_version: number;
  readonly name: string;
  readonly version: string;
  readonly content_hash: string;
  readonly description?: string;
  readonly signature?: { readonly algo: string; readonly key_id: string; readonly sig: string };
}
```

- [ ] **Step 2: Write the failing test `tools/ace/signing.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import {
  generateKeypair, keyId, canonicalManifestBytes, signManifest, verifySignature,
  type TrustEntry,
} from "./signing.ts";
import type { AceManifest } from "./store.ts";

function baseManifest(overrides: Partial<AceManifest> = {}): AceManifest {
  return { format_version: 1, name: "demo", version: "1.0.0", content_hash: "sha256:abc", ...overrides };
}

describe("keyId", () => {
  test("is ed25519:<16 hex> and deterministic for the same SPKI", () => {
    const { publicSpkiB64 } = generateKeypair();
    const a = keyId(publicSpkiB64);
    const b = keyId(publicSpkiB64);
    expect(a).toBe(b);
    expect(a).toMatch(/^ed25519:[0-9a-f]{16}$/);
  });
});

describe("canonicalManifestBytes", () => {
  test("is identical regardless of input key order and excludes signature", () => {
    const m1 = { format_version: 1, name: "x", version: "1", content_hash: "h" } as AceManifest;
    const m2 = { content_hash: "h", version: "1", name: "x", format_version: 1 } as AceManifest;
    expect(Buffer.from(canonicalManifestBytes(m1))).toEqual(Buffer.from(canonicalManifestBytes(m2)));
    const signed = { ...m1, signature: { algo: "ed25519", key_id: "k", sig: "s" } } as AceManifest;
    expect(Buffer.from(canonicalManifestBytes(signed))).toEqual(Buffer.from(canonicalManifestBytes(m1)));
  });
});

describe("sign + verify", () => {
  test("roundtrip: a manifest signed by a trusted key verifies ok", () => {
    const kp = generateKeypair();
    const m = baseManifest();
    const sig = signManifest(m, kp.privatePem);
    const signed = { ...m, signature: sig };
    const trust: Map<string, TrustEntry> = new Map([[kp.keyId, { public_key: kp.publicSpkiB64, label: "me" }]]);
    const r = verifySignature(signed, trust);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.key_id).toBe(kp.keyId); expect(r.label).toBe("me"); }
  });

  test("tampered content_hash -> bad-signature", () => {
    const kp = generateKeypair();
    const m = baseManifest();
    const signed = { ...m, signature: signManifest(m, kp.privatePem), content_hash: "sha256:TAMPERED" } as AceManifest;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = verifySignature(signed, trust);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  test("tampered ARBITRARY field -> bad-signature (whole-manifest coverage, not an allowlist)", () => {
    const kp = generateKeypair();
    const m = baseManifest({ description: "orig" });
    const signed = { ...m, signature: signManifest(m, kp.privatePem), description: "EVIL" } as AceManifest;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = verifySignature(signed, trust);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  test("untrusted key -> untrusted-key", () => {
    const kp = generateKeypair();
    const m = baseManifest();
    const signed = { ...m, signature: signManifest(m, kp.privatePem) };
    const r = verifySignature(signed, new Map()); // empty trust store
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("untrusted-key");
  });

  test("no signature -> no-signature", () => {
    const r = verifySignature(baseManifest(), new Map());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-signature");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun test tools/ace/signing.test.ts`
Expected: FAIL — `Cannot find module './signing.ts'`.

- [ ] **Step 4: Implement `tools/ace/signing.ts`**

```ts
// signing.ts -- Ace slice 3: pure Ed25519 authenticity primitives (zero-dep, node:crypto).
// Pure: no fs, no process. The signature covers the WHOLE manifest minus its own
// `signature` field, via recursive key-sorted canonical JSON (§3 of the design) — so
// every present + future manifest field is bound. content_hash (over `files`) is a
// SEPARATE slice-2 concern handled by store.ts/ace.ts, NOT here.
import {
  createHash, generateKeyPairSync, createPrivateKey, createPublicKey,
  sign as nodeSign, verify as nodeVerify,
} from "node:crypto";
import type { AceManifest } from "./store.ts";

export interface Keypair { privatePem: string; publicSpkiB64: string; keyId: string; }
export interface AceSignature { algo: "ed25519"; key_id: string; sig: string; }
/** Minimal shape verifySignature needs from a trust-store entry (store.ts's LoadedTrustEntry satisfies it structurally). */
export interface TrustEntry { public_key: string; label?: string; }
export type VerifyResult =
  | { ok: true; key_id: string; label?: string }
  | { ok: false; reason: "no-signature" | "untrusted-key" | "bad-signature" };

/** key_id = "ed25519:" + first 16 hex of sha256(SPKI-DER). */
export function keyId(spkiB64: string): string {
  const der = Buffer.from(spkiB64, "base64");
  return "ed25519:" + createHash("sha256").update(der).digest("hex").slice(0, 16);
}

export function generateKeypair(): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicSpkiB64 = (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  return { privatePem, publicSpkiB64, keyId: keyId(publicSpkiB64) };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/** Whole manifest minus `signature`, recursively key-sorted, compact JSON. */
export function canonicalManifestBytes(manifest: AceManifest): Uint8Array {
  const { signature, ...rest } = manifest as AceManifest & { signature?: AceSignature };
  return new TextEncoder().encode(JSON.stringify(canonicalize(rest)));
}

export function signManifest(manifest: AceManifest, privatePem: string): AceSignature {
  const bytes = canonicalManifestBytes(manifest);
  const priv = createPrivateKey(privatePem);
  const sig = (nodeSign(null, bytes, priv) as Buffer).toString("base64");
  const spkiB64 = (createPublicKey(priv).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  return { algo: "ed25519", key_id: keyId(spkiB64), sig };
}

export function verifySignature(
  manifest: AceManifest, trustStore: Map<string, TrustEntry>,
): VerifyResult {
  const signature = (manifest as AceManifest & { signature?: AceSignature }).signature;
  if (!signature) return { ok: false, reason: "no-signature" };
  const entry = trustStore.get(signature.key_id);
  if (!entry) return { ok: false, reason: "untrusted-key" };
  let ok = false;
  try {
    const pub = createPublicKey({ key: Buffer.from(entry.public_key, "base64"), format: "der", type: "spki" });
    ok = nodeVerify(null, canonicalManifestBytes(manifest), pub, Buffer.from(signature.sig, "base64"));
  } catch {
    ok = false; // malformed key/sig bytes -> treat as bad-signature, never throw
  }
  return ok ? { ok: true, key_id: signature.key_id, label: entry.label } : { ok: false, reason: "bad-signature" };
}
```

- [ ] **Step 5: Run to verify pass + tsc**

Run: `bun test tools/ace/signing.test.ts` → all pass.
Run: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tools/ace" || echo "no tsc errors in tools/ace"` → `no tsc errors in tools/ace`.

- [ ] **Step 6: Commit**

```bash
git add tools/ace/signing.ts tools/ace/signing.test.ts tools/ace/store.ts
git commit -m "feat(ace): signing.ts — Ed25519 sign/verify over whole-manifest canonical JSON

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: trust store in `store.ts` + bundled `trusted-keys.json`

**Files:**

- Create: `tools/ace/trusted-keys.json`
- Modify: `tools/ace/store.ts` (add trust-store fns; `contentHash`/`installPackage` untouched)
- Modify: `tools/ace/store.test.ts`

- [ ] **Step 1: Create the bundled anchor `tools/ace/trusted-keys.json`**

```json
[]
```

(Ships empty — the real Zeta root key is a later operator custody ceremony, per design §4. The mechanism reads it; the anchor starts empty.)

- [ ] **Step 2: Write failing tests (append to `tools/ace/store.test.ts`)**

```ts
import { loadTrustStore, addTrustedKey, listTrustedKeys, trustStorePath } from "./store.ts";

describe("trust store", () => {
  test("loadTrustStore unions bundled + user; user overrides on key_id", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-trust-"));
    const bundled = join(dir, "bundled.json");
    const user = join(dir, "user.json");
    require("node:fs").writeFileSync(bundled, JSON.stringify([{ key_id: "ed25519:aaaa", public_key: "B", label: "root" }]));
    require("node:fs").writeFileSync(user, JSON.stringify([
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
    require("node:fs").writeFileSync(bundled, JSON.stringify([{ key_id: "ed25519:aaaa", public_key: "B" }]));
    require("node:fs").writeFileSync(user, JSON.stringify([{ key_id: "ed25519:bbbb", public_key: "U" }]));
    const rows = listTrustedKeys(bundled, user);
    expect(rows.find((r) => r.key_id === "ed25519:aaaa")?.source).toBe("bundled");
    expect(rows.find((r) => r.key_id === "ed25519:bbbb")?.source).toBe("user");
  });

  test("trustStorePath is under ~/.ace", () => {
    expect(trustStorePath().replace(/\\/g, "/")).toMatch(/\.ace\/trusted-keys\.json$/);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun test tools/ace/store.test.ts` → FAIL (`loadTrustStore` not exported).

- [ ] **Step 4: Implement the trust-store fns in `store.ts`**

Add `dirname` to the `node:path` import (`import { join, dirname } from "node:path";`). Append:

```ts
export interface TrustedKey { key_id: string; public_key: string; label?: string; added?: string; }
export interface LoadedTrustEntry { public_key: string; label?: string; source: "bundled" | "user"; }

/** ~/.ace/trusted-keys.json — operator-managed keyring (sibling of the store). */
export function trustStorePath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "trusted-keys.json");
}

/** tools/ace/trusted-keys.json — the in-repo bundled root anchor (ships empty). */
export function bundledTrustPath(): string {
  return join(import.meta.dir, "trusted-keys.json");
}

function readKeysFile(p: string): TrustedKey[] {
  if (!existsSync(p)) return [];
  try {
    const arr = JSON.parse(readFileSync(p, "utf8"));
    if (!Array.isArray(arr)) return [];
    return arr.filter((k) => k && typeof k.key_id === "string" && typeof k.public_key === "string");
  } catch {
    return [];
  }
}

/** bundled ∪ user; user entries override bundled on key_id collision. */
export function loadTrustStore(
  bundledPath: string = bundledTrustPath(), userPath: string = trustStorePath(),
): Map<string, LoadedTrustEntry> {
  const m = new Map<string, LoadedTrustEntry>();
  for (const k of readKeysFile(bundledPath)) m.set(k.key_id, { public_key: k.public_key, label: k.label, source: "bundled" });
  for (const k of readKeysFile(userPath)) m.set(k.key_id, { public_key: k.public_key, label: k.label, source: "user" });
  return m;
}

/** Append to the user store (create if absent); dedup by key_id. */
export function addTrustedKey(entry: TrustedKey, userPath: string = trustStorePath()): { added: boolean } {
  const existing = readKeysFile(userPath);
  if (existing.some((k) => k.key_id === entry.key_id)) return { added: false };
  existing.push({ ...entry, added: entry.added ?? new Date().toISOString() });
  mkdirSync(dirname(userPath), { recursive: true });
  writeFileSync(userPath, JSON.stringify(existing, null, 2));
  return { added: true };
}

export function listTrustedKeys(
  bundledPath: string = bundledTrustPath(), userPath: string = trustStorePath(),
): Array<{ key_id: string; label?: string; source: "bundled" | "user" }> {
  return [...loadTrustStore(bundledPath, userPath).entries()].map(([key_id, v]) => ({ key_id, label: v.label, source: v.source }));
}
```

- [ ] **Step 5: Run pass + tsc**

Run: `bun test tools/ace/store.test.ts` → all pass.
Run: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tools/ace" || echo "no tsc errors in tools/ace"` → clean.

- [ ] **Step 6: Commit**

```bash
git add tools/ace/store.ts tools/ace/store.test.ts tools/ace/trusted-keys.json
git commit -m "feat(ace): trust store — bundled ∪ user keyring (loadTrustStore/addTrustedKey/list)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `ace.ts` — `keygen` / `sign` / `trust` verbs + install authenticity gate

**Files:**

- Modify: `tools/ace/ace.ts`
- Modify: `tools/ace/ace.test.ts`

This is the orchestration task. `ace.ts` imports the pure crypto from `signing.ts`
and the trust-store + `contentHash` from `store.ts`, and applies the enforcement
**policy** (only `no-signature` is `--allow-unsigned`-overridable; `bad-signature`
and `untrusted-key` are always hard-refused — design §6).

- [ ] **Step 1: Write failing tests (append to `tools/ace/ace.test.ts`)**

Use a helper that builds a real signed package with `signing.ts` + `store.contentHash` (so the package is genuinely installable), writes it to a temp file, and points `--store`/trust paths at temp dirs. Key cases:

```ts
import { generateKeypair, signManifest } from "./signing.ts";
import { contentHash } from "./store.ts";
import { writeFileSync, mkdtempSync, chmodSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// builds a signed package file; returns { pkgPath, keyId, pubB64, store, userTrust }
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
```

Cases (each `await main([...])` since `main` is async):

1. **install signed + trusted → 0** — `ace trust add` the fixture pubkey to a temp user store (or pre-write it), then `install <pkgPath> --store <tmp>` → exit 0; store dir created.
2. **install bad-sig → 1** — tamper the signed package's `content_hash` after signing → exit 1.
3. **install untrusted-key → 1 EVEN with `--allow-unsigned`** — don't trust the key; `install <pkgPath> --allow-unsigned` → exit 1 (override does NOT apply to a present signature).
4. **install unsigned → 1 without flag; 0 with `--allow-unsigned`** — a slice-2-style package (no `signature`).
5. **`keygen` writes private key 0600** — `keygen --out <tmp/k>` → exit 0; on POSIX assert `(statSync(tmp/k.key).mode & 0o777) === 0o600`; on Windows print a skip note (per the shield rule) and assert the file exists.
6. **`sign` of a tampered package → 1** — package whose `content_hash` doesn't match `files` → `sign` refuses.
7. **`trust add` + `trust list`** — add a pubkey to a temp user store, list shows it with source `user`.
8. **`parseArgs`** — `keygen`/`sign`/`trust add`/`trust list`/`install --allow-unsigned` parse into the right shapes; bad forms → ArgError.

> Use `--store`, and for trust paths thread a temp user store. If `ace.ts` reads `trustStorePath()`/`bundledTrustPath()` with no override, add a `--trust-store <path>` test hook OR set `process.env.HOME`/`USERPROFILE` to a temp dir in the test so `~/.ace` lands in temp. **Pick the env-temp-HOME approach** (no production flag needed): set `process.env.HOME` + `process.env.USERPROFILE` to a temp dir in a `beforeEach`, restore in `afterEach`.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/ace.test.ts` → FAIL (new verbs not implemented; `install` ignores signatures).

- [ ] **Step 3: Implement in `ace.ts`**

Imports at top:

```ts
import { writeFileSync, readFileSync } from "node:fs";
import { defaultStorePath, listInstalled, installPackage, contentHash,
         loadTrustStore, addTrustedKey, listTrustedKeys, type AcePackage, type AceManifest } from "./store";
import { generateKeypair, signManifest, verifySignature, keyId } from "./signing";
```

Add `ParsedArgs` members + `parseArgs` branches:

```ts
interface KeygenArgs { command: "keygen"; outPrefix: string; }
interface SignArgs { command: "sign"; pkgPath: string; keyPath: string; outPath?: string; }
interface TrustArgs { command: "trust"; sub: "add" | "list"; arg?: string; label?: string; }
// install gains: allowUnsigned: boolean
```

- `keygen`: optional `--out <prefix>` (default `ace-key`).
- `sign <pkg>`: required `--key <priv>`; optional `--out <file>`.
- `trust add <pub>` (optional `--label`), `trust list`.
- `install <src>`: add `--allow-unsigned` boolean.
- Keep the existing `known = ["remove", "inspect"]` stub list.

`main` handlers:

```ts
// keygen — write private key 0600 (secure-create), public key normal
if (parsed.command === "keygen") {
  const kp = generateKeypair();
  // mode on the OPEN so the file is never momentarily world-readable (POSIX; advisory on Windows)
  writeFileSync(`${parsed.outPrefix}.key`, kp.privatePem, { mode: 0o600 });
  writeFileSync(`${parsed.outPrefix}.pub`, JSON.stringify({ algo: "ed25519", key_id: kp.keyId, public_key: kp.publicSpkiB64 }, null, 2));
  console.log(`ace: wrote ${parsed.outPrefix}.key (0600) + ${parsed.outPrefix}.pub  key_id ${kp.keyId}`);
  return 0;
}

// sign — recompute content_hash with the SLICE-2 contentHash (never sort files); refuse on mismatch
if (parsed.command === "sign") {
  let pkg: AcePackage;
  try { pkg = JSON.parse(readFileSync(parsed.pkgPath, "utf8")) as AcePackage; }
  catch { console.error("ace: package is not valid JSON"); return 65; }
  const recomputed = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
  if (recomputed !== pkg.manifest.content_hash) {
    console.error(`ace: sign refused: content_hash mismatch (manifest ${pkg.manifest.content_hash}, computed ${recomputed})`);
    return 1;
  }
  let priv: string;
  try { priv = readFileSync(parsed.keyPath, "utf8"); }
  catch { console.error(`ace: cannot read key ${parsed.keyPath}`); return 1; }
  const signature = signManifest(pkg.manifest, priv);
  const signed = { ...pkg, manifest: { ...pkg.manifest, signature } };
  const out = JSON.stringify(signed, null, 2);
  if (parsed.outPath) { writeFileSync(parsed.outPath, out); console.log(`ace: signed -> ${parsed.outPath} (key_id ${signature.key_id})`); }
  else console.log(out);
  return 0;
}

// trust
if (parsed.command === "trust") {
  if (parsed.sub === "list") {
    const rows = listTrustedKeys();
    if (rows.length === 0) { console.log("No trusted keys."); return 0; }
    for (const r of rows) console.log(`  ${r.key_id}  [${r.source}]${r.label ? "  " + r.label : ""}`);
    return 0;
  }
  // add: arg is a .pub file path OR a raw base64 SPKI
  if (!parsed.arg) { console.error("ace: trust add requires a <pubkey-file-or-b64>"); return 64; }
  let publicB64: string;
  try {
    const raw = readFileSync(parsed.arg, "utf8").trim();
    publicB64 = raw.startsWith("{") ? (JSON.parse(raw).public_key as string) : raw;
  } catch {
    publicB64 = parsed.arg; // not a file -> treat as raw b64
  }
  const kid = keyId(publicB64);
  const res = addTrustedKey({ key_id: kid, public_key: publicB64, label: parsed.label });
  console.log(res.added ? `ace: trusted ${kid}${parsed.label ? " (" + parsed.label + ")" : ""}` : `ace: ${kid} already trusted`);
  return 0;
}
```

Change the `install` handler — insert the authenticity gate AFTER JSON parse and BEFORE `installPackage`:

```ts
if (parsed.command === "install") {
  let raw: string;
  try {
    raw = parsed.source.startsWith("http") ? await (await fetch(parsed.source)).text() : readFileSync(parsed.source, "utf8");
  } catch (e) { console.error(`ace: download/read failed: ${(e as Error).message}`); return 1; }
  let pkg: AcePackage;
  try { pkg = JSON.parse(raw) as AcePackage; }
  catch { console.error("ace: package is not valid JSON"); return 65; }

  // AUTHENTICITY GATE (design §6) — before extraction. Only `no-signature` is --allow-unsigned-overridable.
  const v = verifySignature(pkg.manifest, loadTrustStore());
  let signer: { key_id: string; label?: string } | undefined;
  if (v.ok) {
    signer = { key_id: v.key_id, label: v.label };
  } else if (v.reason === "bad-signature") {
    console.error("ace: install refused: bad signature"); return 1;
  } else if (v.reason === "untrusted-key") {
    const kid = pkg.manifest.signature?.key_id ?? "?";
    console.error(`ace: install refused: signature from untrusted key ${kid} (ace trust add to trust it)`); return 1;
  } else { // no-signature
    if (!parsed.allowUnsigned) { console.error("ace: install refused: unsigned package (use --allow-unsigned to override)"); return 1; }
    console.error("ace: WARNING: installing UNSIGNED package (--allow-unsigned).");
  }

  // INTEGRITY + extract (slice 2, unchanged)
  const result = installPackage(parsed.storePath, pkg);
  if (!result.ok) { console.error(`ace: install refused: ${result.error}`); return 1; }
  if (signer) console.log(`ace: integrity + authenticity verified (signed by ${signer.key_id}${signer.label ? " " + signer.label : ""}) -> ${result.dir}`);
  else console.log("ace: integrity-verified (content hash). NOT authenticity-verified (--allow-unsigned).");
  return 0;
}
```

Update `printUsage()`: move `install` to show `[--allow-unsigned]`; add `keygen`, `sign`, `trust add`, `trust list` to the live block.

- [ ] **Step 4: Run pass + tsc + smokes**

Run: `bun test tools/ace/` → ALL pass (signing + store + ace).
Run: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tools/ace" || echo "no tsc errors in tools/ace"` → clean.
Run: `bun tools/ace/ace.ts help` → exit 0, shows keygen/sign/trust/install --allow-unsigned.
Run: `bun tools/ace/ace.ts list --json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "feat(ace): keygen/sign/trust verbs + install authenticity gate (--allow-unsigned)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: SKILL.md + the slice-2 line + the store.ts CodeQL NOTE

**Files:**

- Modify: `.claude/skills/ace/SKILL.md`
- Modify: `tools/ace/store.ts` (the slice-3 NOTE comment only)

- [ ] **Step 1: Update `.claude/skills/ace/SKILL.md`**

Add `keygen`/`sign`/`trust add`/`trust list` rows to the verb table; update the `install` row to mention `--allow-unsigned`; change the integrity-only note to: "`install` verifies **integrity** (content hash) AND **authenticity** (Ed25519 signature against the trust store). Unsigned packages need `--allow-unsigned`; a present-but-untrusted signature is always refused (`ace trust add` the key)." Keep the `description:` frontmatter ≤120 chars (it already is; only edit if you change it — re-run the audit if so: `bun tools/hygiene/audit-skill-description-length.ts | grep ace`).

- [ ] **Step 2: Update the store.ts slice-3 NOTE**

In `installPackage`'s NOTE comment, the CONTENT/SOURCE (b) bullet currently says authenticity is "explicitly the authenticity/robustness slice (slice 3). The alert stays open until then." Update it to: authenticity now EXISTS — `ace install` runs the Ed25519 signature gate (see `ace.ts` + `signing.ts`); a package installed via the signed+trusted path is authenticity-verified, and `--allow-unsigned` is required to install an unsigned one. (The CodeQL `js/http-to-file-access` alert remains a true intended-flow observation — the http→file write is the package manager's function — but the source-trust defense the note deferred is now implemented.)

- [ ] **Step 3: Validate**

Run: `bunx --bun markdownlint-cli2 .claude/skills/ace/SKILL.md` → exit 0.
Run: `bun test tools/ace/` → still all pass.
Run: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tools/ace" || echo "no tsc errors in tools/ace"` → clean.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/ace/SKILL.md tools/ace/store.ts
git commit -m "docs(ace): skill + store NOTE — install now verifies authenticity (slice 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final gates (whole slice)

- `bun test tools/ace/` — all pass (signing.test + store.test + ace.test).
- `bunx tsc --noEmit -p tsconfig.json` — no `tools/ace` errors.
- `bun tools/ace/ace.ts help` / `list --json` — exit 0; `verify nonexistent` — exit 1.
- `bunx --bun markdownlint-cli2 .claude/skills/ace/SKILL.md` — exit 0.
- `bun tools/hygiene/audit-skill-description-length.ts` — `ace` not in the error list.
- Commit canary `git ls-tree HEAD | wc -l` — root entries unchanged (new files are nested under `tools/ace/`, not new root entries; expect 67).
- End-to-end smoke (manual, optional): `keygen` → `sign` a fixture pkg → `trust add` the pub → `install` the signed pkg → "integrity + authenticity verified".

## Self-review (against the spec)

- **§3 canonicalization (whole-manifest, key-sorted, signature excluded)** → Task 1 `canonicalManifestBytes` + the order-independence + signature-exclusion + arbitrary-field-tamper tests. ✓
- **§3 content_hash distinct + unchanged; signer reuses slice-2 fn** → Task 3 `sign` uses `store.contentHash(JSON.stringify(files))`; `installPackage`/`contentHash` untouched. ✓
- **§4 trust = bundled ∪ user; user overrides; empty default** → Task 2 `loadTrustStore` + tests. ✓
- **§5 verbs** keygen/sign/trust add/list → Task 3. ✓
- **§6 gate** (no-signature overridable; bad-sig + untrusted-key always refuse; before extract) → Task 3 install handler + the untrusted-key-even-with-allow-unsigned test. ✓
- **§8 keygen 0600** → Task 3 `writeFileSync(..., { mode: 0o600 })` + POSIX mode test. ✓
- **§9 testing** → tasks 1–3 tests; whole-manifest + signer/installer-agreement + 0600 cases present. ✓

**Out of scope (NOT this plan):** real Zeta root keypair ceremony; key rotation/revocation; order-independent content_hash; guardian-AI oversight; minisign/sigstore interop; bare-machine bootstrap (design §10).
