# Ace CLI slice 6 — remote registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve `name@range` against a hosted, signed remote registry index fetched over
HTTP(S) — verified (mandatory-key signature + monotonic-sequence anti-rollback + two-sided
freshness), cached (conditional GET), and merged **under** the local registry — with the
solver/lockfile/install-graph unchanged.

**Architecture:** The remote merge happens once, up front, producing the same
`Registry = Map<name, Map<version, {url, package_hash}>>` the solver already consumes. New
trust + fetch + cache logic lives in `tools/ace/registry-remote.ts`; index sign/verify are
additive siblings in `tools/ace/signing.ts`; config + cache paths are additive in
`tools/ace/store.ts` (sync `loadRegistry` untouched); `ace.ts` gains `registry remote
add/list/rm`, `--offline`, and swaps `loadRegistry()` → `await loadRegistries(...)`.

**Tech Stack:** TypeScript on Bun; `node:crypto` ed25519 (zero-dep); `fetch`; `bun test`;
strict `bun --bun tsc --noEmit`.

**Spec:** `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice6-remote-registry-design.md`
(includes the Codex #6424 fix-forward: mandatory per-registry `--key`; future-skew gate).

**Harness constraints (every task):** Otto-343 hook blocks the Edit tool even after
Read/Write — use **Write** for brand-new files, and **bun patch-scripts** for edits to
existing files (write `tools/ace/_patch_<x>.ts` → `readFileSync` → `split().length-1`
assert-exactly-1-occurrence → `split().join()` → `writeFileSync` → `bun run` → `rm`). Commit
canary: `git ls-tree HEAD | wc -l` must stay **67**. Commit trailer:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Tests: `bun test tools/ace/`.
Strict gate: `bun --bun tsc --noEmit -p tsconfig.json`. markdownlint on SKILL.md (Task 10).

**Existing-code facts to mirror (do not re-derive):**

- `signing.ts` has private `canonicalize(value)`, `canonicalManifestBytes`, `signManifest`,
  `verifySignature`, `keyId`, `generateKeypair`, `AceSignature`, `TrustEntry`,
  `VerifyResult`. Index functions mirror these exactly (only the canonical-bytes builder
  differs — reuse the same private `canonicalize`).
- `store.ts`: `RegistryEntry { url, package_hash }`, `Registry = Map<string, Map<string,
  RegistryEntry>>`, `loadRegistry(bundled, user)` (sync, untouched), `registryPath()` /
  `trustStorePath()` resolve home as `process.env.HOME ?? process.env.USERPROFILE ?? "."`
  then `join(home, ".ace", <file>)`. `loadTrustStore()` returns the trust store Map used by
  `verifySignature`. Imports already present: `chmodSync, existsSync, mkdirSync, readFileSync,
  writeFileSync` from `node:fs`; `join, dirname` from `node:path`.
- `resolve.ts` exports `canonicalJson` + `packageHash`.
- `ace.ts`: `registry` command parse at the `if (command === "registry")` block (sub =
  `argv[1]`; `list` / `add`); handler at `if (parsed.command === "registry")`. Install +
  update handlers each call `loadRegistry()` synchronously inside an `async function main`.
- `ace.test.ts`: per-test temp-HOME via `beforeEach`/`afterEach` (sets `process.env.HOME` +
  `USERPROFILE` to a `mkdtempSync` dir, `process.chdir`). There is **no global fetch mock
  yet** — Task 9 adds a save/restore `globalThis.fetch` stub.

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `tools/ace/signing.ts` | + `IndexSignableContent`, `canonicalIndexBytes`, `signIndex`, `verifyIndexSignature` | 1 |
| `tools/ace/signing.test.ts` (or `*.test` sibling) | index sign/verify unit tests | 1 |
| `tools/ace/store.ts` | + remote-registry config types, paths, read/write, cache dir | 2 |
| `tools/ace/store.test.ts` | config read/write unit tests | 2 |
| `tools/ace/registry-remote.ts` (**new**) | index types, `parseIndex`, `verifyIndex`, cache I/O, `fetchRemoteIndex`, `loadRegistries` | 3–7 |
| `tools/ace/registry-remote.test.ts` (**new**) | unit tests for the above | 3–7 |
| `tools/ace/ace.ts` | `registry remote add/list/rm`, `--offline`, async registry load | 8–9 |
| `tools/ace/ace.test.ts` | remote-registry integration tests | 9 |
| `.claude/skills/ace/SKILL.md` | document remote registries | 10 |

Constants (define in `registry-remote.ts`): `DEFAULT_MAX_STALENESS_DAYS = 30`,
`MAX_FUTURE_SKEW_MS = 5 * 60 * 1000`.

---

## Task 1: signing.ts — index sign/verify siblings

**Files:**

- Modify: `tools/ace/signing.ts` (additive; new file uses Write for the test)
- Test: `tools/ace/signing.test.ts` (create if absent; else append)

- [ ] **Step 1: Write the failing test**

Create/append `tools/ace/signing.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { generateKeypair, signIndex, verifyIndexSignature, type IndexSignableContent } from "./signing.ts";
import type { TrustEntry } from "./signing.ts";

const content: IndexSignableContent = {
  format_version: 1, sequence: 3, issued_at: "2026-06-01T12:00:00Z",
  packages: { leaf: { "1.0.0": { url: "https://x/leaf-1.0.0.json", package_hash: "sha256:aa" } } },
};

describe("index signing", () => {
  test("sign + verify round-trips against a trusted key", () => {
    const kp = generateKeypair();
    const sig = signIndex(content, kp.privatePem);
    const trust = new Map<string, TrustEntry>([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = verifyIndexSignature(content, sig, trust);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key_id).toBe(kp.keyId);
  });
  test("untrusted key → untrusted-key", () => {
    const kp = generateKeypair();
    const sig = signIndex(content, kp.privatePem);
    const r = verifyIndexSignature(content, sig, new Map());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("untrusted-key");
  });
  test("tampered content → bad-signature", () => {
    const kp = generateKeypair();
    const sig = signIndex(content, kp.privatePem);
    const trust = new Map<string, TrustEntry>([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const tampered = { ...content, sequence: 4 };
    const r = verifyIndexSignature(tampered, sig, trust);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });
  test("non-ed25519 algo → unsupported-algo", () => {
    const kp = generateKeypair();
    const sig = { ...signIndex(content, kp.privatePem), algo: "rsa" as "ed25519" };
    const r = verifyIndexSignature(content, sig, new Map());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsupported-algo");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/signing.test.ts`
Expected: FAIL — `signIndex` / `verifyIndexSignature` / `IndexSignableContent` not exported.

- [ ] **Step 3: Implement (patch-script append to `signing.ts`)**

Add `import type { RegistryEntry } from "./store.ts";` (alongside the existing
`import type { AceManifest } from "./store.ts";` — merge into one import) and append:

```ts
export interface IndexSignableContent {
  format_version: number;
  sequence: number;
  issued_at: string;
  packages: Record<string, Record<string, RegistryEntry>>;
}

/** Index content (no `signature`), recursively key-sorted, compact JSON. Sibling of canonicalManifestBytes. */
export function canonicalIndexBytes(content: IndexSignableContent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalize(content)));
}

export function signIndex(content: IndexSignableContent, privatePem: string): AceSignature {
  const bytes = canonicalIndexBytes(content);
  const priv = createPrivateKey(privatePem);
  const sig = (nodeSign(null, bytes, priv) as Buffer).toString("base64");
  const spkiB64 = (createPublicKey(priv).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  return { algo: "ed25519", key_id: keyId(spkiB64), sig };
}

export function verifyIndexSignature(
  content: IndexSignableContent, signature: AceSignature, trustStore: Map<string, TrustEntry>,
): VerifyResult {
  if (signature.algo !== "ed25519") return { ok: false, reason: "unsupported-algo" };
  const entry = trustStore.get(signature.key_id);
  if (!entry) return { ok: false, reason: "untrusted-key" };
  let verified = false;
  try {
    const pub = createPublicKey({ key: Buffer.from(entry.public_key, "base64"), format: "der", type: "spki" });
    verified = nodeVerify(null, canonicalIndexBytes(content), pub, Buffer.from(signature.sig, "base64"));
  } catch { verified = false; }
  if (!verified) return { ok: false, reason: "bad-signature" };
  const result: VerifyResult = { ok: true, key_id: signature.key_id };
  if (entry.label !== undefined) (result as { ok: true; key_id: string; label?: string }).label = entry.label;
  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test tools/ace/signing.test.ts` → PASS.
Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit** (verify canary `git ls-tree HEAD | wc -l` = 67 first)

```bash
git add tools/ace/signing.ts tools/ace/signing.test.ts
git commit -m "feat(ace): index sign/verify (slice 6 task 1)"
```

---

## Task 2: store.ts — remote-registry config + cache paths

**Files:**

- Modify: `tools/ace/store.ts` (additive; sync `loadRegistry` untouched)
- Test: `tools/ace/store.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to `tools/ace/store.test.ts`)

```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
    const c = readRegistriesConfig();
    expect(c.remotes).toEqual([{ url: "https://r/index.json", key_id: "ed25519:abc" }]);
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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/store.test.ts` → FAIL (functions not exported).

- [ ] **Step 3: Implement (patch-script append to `store.ts`)**

Append (mirrors `registryPath` home-resolution + `addRegistryEntry` chmod discipline):

```ts
// ---- Remote registries (slice 6) ----
export interface RemoteRegistryConfig { readonly url: string; readonly key_id: string; readonly max_staleness_days?: number; }
export interface RegistriesConfig { readonly remotes: RemoteRegistryConfig[]; }

/** ~/.ace/registries.json — operator-managed ordered remote list (sibling of registry.json). */
export function registriesPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "registries.json");
}

/** ~/.ace/registry-cache/ — content-addressed cache of fetched indexes + per-registry meta. */
export function registryCacheDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "registry-cache");
}

/** Untrusted-input discipline: malformed → { remotes: [] }; drop entries missing url OR key_id. */
export function readRegistriesConfig(p: string = registriesPath()): RegistriesConfig {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(p, "utf8")); } catch { return { remotes: [] }; }
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { remotes?: unknown }).remotes)) return { remotes: [] };
  const remotes: RemoteRegistryConfig[] = [];
  for (const r of (raw as { remotes: unknown[] }).remotes) {
    if (!r || typeof r !== "object") continue;
    const url = (r as { url?: unknown }).url;
    const key_id = (r as { key_id?: unknown }).key_id;
    if (typeof url !== "string" || typeof key_id !== "string") continue; // key_id REQUIRED (Codex #6424 P1)
    const msd = (r as { max_staleness_days?: unknown }).max_staleness_days;
    remotes.push(typeof msd === "number" ? { url, key_id, max_staleness_days: msd } : { url, key_id });
  }
  return { remotes };
}

export function writeRegistryRemote(entry: RemoteRegistryConfig, p: string = registriesPath()): { added: boolean; updated: boolean } {
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  try { chmodSync(dirname(p), 0o700); } catch { /* best-effort */ }
  const cfg = readRegistriesConfig(p);
  const remotes = cfg.remotes.filter((r) => r.url !== entry.url);
  const updated = remotes.length !== cfg.remotes.length;
  remotes.push(entry);
  writeFileSync(p, JSON.stringify({ remotes }, null, 2));
  try { chmodSync(p, 0o600); } catch { /* best-effort */ }
  return { added: !updated, updated };
}

export function removeRegistryRemote(url: string, p: string = registriesPath()): { removed: boolean } {
  const cfg = readRegistriesConfig(p);
  const remotes = cfg.remotes.filter((r) => r.url !== url);
  if (remotes.length === cfg.remotes.length) return { removed: false };
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  writeFileSync(p, JSON.stringify({ remotes }, null, 2));
  try { chmodSync(p, 0o600); } catch { /* best-effort */ }
  return { removed: true };
}
```

- [ ] **Step 4: Run** → `bun test tools/ace/store.test.ts` PASS; `bun --bun tsc --noEmit -p tsconfig.json` exit 0.
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/store.ts tools/ace/store.test.ts
git commit -m "feat(ace): registries.json config + cache paths (slice 6 task 2)"
```

---

## Task 3: registry-remote.ts — types + `parseIndex`

**Files:** Create `tools/ace/registry-remote.ts`; Create `tools/ace/registry-remote.test.ts`.

- [ ] **Step 1: Write the failing test** (`tools/ace/registry-remote.test.ts`)

```ts
import { describe, expect, test } from "bun:test";
import { parseIndex } from "./registry-remote.ts";

const good = JSON.stringify({
  format_version: 1, sequence: 2, issued_at: "2026-06-01T12:00:00Z",
  packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "sha256:aa" } } },
  signature: { algo: "ed25519", key_id: "ed25519:k", sig: "BASE64" },
});

describe("parseIndex", () => {
  test("parses a well-formed index", () => {
    const r = parseIndex(good);
    expect("error" in r).toBe(false);
    if (!("error" in r)) { expect(r.sequence).toBe(2); expect(r.packages.leaf!["1.0.0"]!.url).toBe("https://x/l.json"); }
  });
  test.each([
    ["not json", "{"],
    ["bad format_version", JSON.stringify({ format_version: 2, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
    ["negative sequence", JSON.stringify({ format_version: 1, sequence: -1, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
    ["unparseable issued_at", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "nope", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
    ["missing signature", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: {} })],
    ["non-string url", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: { a: { "1.0.0": { url: 5, package_hash: "h" } } }, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
  ])("rejects %s (no throw)", (_label, json) => {
    const r = parseIndex(json);
    expect("error" in r).toBe(true);
  });
});
```

- [ ] **Step 2: Run** → FAIL (module not found).

- [ ] **Step 3: Implement** (`tools/ace/registry-remote.ts`)

```ts
// registry-remote.ts -- Ace slice 6: fetch + verify + anti-rollback + cache + merge of a
// signed remote registry index. Untrusted-input discipline throughout (never throw on bad
// input; return { error } / { skipped }). The package bytes the index points at are still
// hash-pinned + signature-gated downstream (unchanged) — index trust is additive.
import { createHash } from "node:crypto";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AceSignature, IndexSignableContent, TrustEntry } from "./signing.ts";
import { verifyIndexSignature } from "./signing.ts";
import type { Registry, RegistryEntry, RemoteRegistryConfig } from "./store.ts";
import { loadRegistry, readRegistriesConfig, registryCacheDir } from "./store.ts";

export const DEFAULT_MAX_STALENESS_DAYS = 30;
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export type IndexDoc = IndexSignableContent & { signature: AceSignature };

function isEntry(e: unknown): e is RegistryEntry {
  return !!e && typeof e === "object"
    && typeof (e as RegistryEntry).url === "string"
    && typeof (e as RegistryEntry).package_hash === "string";
}
function isSig(s: unknown): s is AceSignature {
  return !!s && typeof s === "object"
    && (s as AceSignature).algo === "ed25519"
    && typeof (s as AceSignature).key_id === "string"
    && typeof (s as AceSignature).sig === "string";
}

export function parseIndex(json: string): IndexDoc | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { error: "index is not valid JSON" }; }
  if (!raw || typeof raw !== "object") return { error: "index is not an object" };
  const o = raw as Record<string, unknown>;
  if (o.format_version !== 1) return { error: "unsupported index format_version" };
  if (typeof o.sequence !== "number" || !Number.isInteger(o.sequence) || o.sequence < 0) return { error: "index sequence must be a non-negative integer" };
  if (typeof o.issued_at !== "string" || Number.isNaN(Date.parse(o.issued_at))) return { error: "index issued_at must be RFC3339" };
  if (!o.packages || typeof o.packages !== "object") return { error: "index packages must be an object" };
  const packages: Record<string, Record<string, RegistryEntry>> = {};
  for (const [name, versions] of Object.entries(o.packages as Record<string, unknown>)) {
    if (!versions || typeof versions !== "object") return { error: `index packages.${name} must be an object` };
    const vm: Record<string, RegistryEntry> = {};
    for (const [version, entry] of Object.entries(versions as Record<string, unknown>)) {
      if (!isEntry(entry)) return { error: `index packages.${name}.${version} is malformed` };
      vm[version] = { url: entry.url, package_hash: entry.package_hash };
    }
    packages[name] = vm;
  }
  if (!isSig(o.signature)) return { error: "index signature is malformed" };
  return { format_version: 1, sequence: o.sequence, issued_at: o.issued_at, packages, signature: o.signature };
}
```

- [ ] **Step 4: Run** → `bun test tools/ace/registry-remote.test.ts` PASS; `tsc` exit 0.
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/registry-remote.ts tools/ace/registry-remote.test.ts
git commit -m "feat(ace): registry-remote parseIndex + types (slice 6 task 3)"
```

---

## Task 4: registry-remote.ts — `verifyIndex` (the three gates)

**Files:** Modify `tools/ace/registry-remote.ts`; Modify `tools/ace/registry-remote.test.ts`.

- [ ] **Step 1: Write the failing test** (append)

```ts
import { generateKeypair, signIndex } from "./signing.ts";
import type { TrustEntry } from "./signing.ts";
import { verifyIndex, type CacheMeta } from "./registry-remote.ts";

function mk(seq: number, issuedAtMs: number) {
  const kp = generateKeypair();
  const content = { format_version: 1 as const, sequence: seq, issued_at: new Date(issuedAtMs).toISOString(),
    packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "sha256:aa" } } } };
  const doc = { ...content, signature: signIndex(content, kp.privatePem) };
  const trust = new Map<string, TrustEntry>([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
  return { kp, doc, trust };
}
const remoteOf = (keyId: string) => ({ url: "https://x/index.json", key_id: keyId });
const NOW = Date.parse("2026-06-01T12:00:00Z");
const meta0: CacheMeta = { url: "https://x/index.json", sequence_high_water: 0, index_content_hash: "", fetched_at: "" };

describe("verifyIndex (three gates)", () => {
  test("all gates pass", () => {
    const { kp, doc, trust } = mk(1, NOW);
    expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {}).ok).toBe(true);
  });
  test("untrusted signer refused", () => {
    const { doc, kp } = mk(1, NOW);
    const r = verifyIndex(doc, remoteOf(kp.keyId), new Map(), meta0, NOW, {});
    expect(r.ok).toBe(false);
  });
  test("trusted-but-not-pinned key refused (mandatory pin, Codex #6424 P1)", () => {
    const { doc, trust } = mk(1, NOW);
    const r = verifyIndex(doc, remoteOf("ed25519:someoneelse"), trust, meta0, NOW, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("pinned");
  });
  test("rollback (sequence < high-water) refused", () => {
    const { kp, doc, trust } = mk(2, NOW);
    const meta = { ...meta0, sequence_high_water: 5 };
    const r = verifyIndex(doc, remoteOf(kp.keyId), trust, meta, NOW, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("rollback");
  });
  test("equal sequence accepted", () => {
    const { kp, doc, trust } = mk(5, NOW);
    expect(verifyIndex(doc, remoteOf(kp.keyId), trust, { ...meta0, sequence_high_water: 5 }, NOW, {}).ok).toBe(true);
  });
  test("stale (past) refused", () => {
    const { kp, doc, trust } = mk(1, NOW - 40 * 24 * 3600 * 1000);
    const r = verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("stale");
  });
  test("future beyond skew refused — always, incl. offline (Codex #6424 P2)", () => {
    const { kp, doc, trust } = mk(1, NOW + 10 * 60 * 1000);
    expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {}).ok).toBe(false);
    expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, { offline: true }).ok).toBe(false);
  });
  test("offline skips past-staleness but keeps sig + anti-rollback", () => {
    const { kp, doc, trust } = mk(1, NOW - 40 * 24 * 3600 * 1000);
    expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, { offline: true }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run** → FAIL (`verifyIndex` / `CacheMeta` not exported).

- [ ] **Step 3: Implement** (append to `registry-remote.ts`)

```ts
export interface CacheMeta {
  url: string; etag?: string; last_modified?: string;
  sequence_high_water: number; index_content_hash: string; fetched_at: string;
}
export interface VerifyOpts { offline?: boolean }

/** The three gates, in order: signature (mandatory pin) → anti-rollback → freshness (two-sided). */
export function verifyIndex(
  doc: IndexDoc, remote: RemoteRegistryConfig, trustStore: Map<string, TrustEntry>,
  cacheMeta: CacheMeta, now: number, opts: VerifyOpts,
): { ok: true } | { ok: false; reason: string } {
  const { signature, ...content } = doc;
  // 1. signature — mandatory pin: signer must equal remote.key_id AND be trusted (no fallback).
  if (signature.key_id !== remote.key_id) return { ok: false, reason: `index not signed by the registry's pinned key ${remote.key_id}` };
  const sv = verifyIndexSignature(content, signature, trustStore);
  if (!sv.ok) return { ok: false, reason: `index signature ${sv.reason}` };
  // 2. anti-rollback — monotonic sequence high-water.
  if (doc.sequence < cacheMeta.sequence_high_water) return { ok: false, reason: `index rollback: sequence ${doc.sequence} < seen ${cacheMeta.sequence_high_water}` };
  // 3. freshness — two-sided window. Future-skew ALWAYS enforced; past-staleness skipped offline on cache.
  const issued = Date.parse(doc.issued_at);
  if (issued - now > MAX_FUTURE_SKEW_MS) return { ok: false, reason: `index issued_at is in the future beyond skew` };
  if (!opts.offline) {
    const maxStaleMs = (remote.max_staleness_days ?? DEFAULT_MAX_STALENESS_DAYS) * 24 * 3600 * 1000;
    if (now - issued > maxStaleMs) return { ok: false, reason: `index is stale (issued_at older than max-staleness)` };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run** → tests PASS; `tsc` exit 0.
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/registry-remote.ts tools/ace/registry-remote.test.ts
git commit -m "feat(ace): registry-remote verifyIndex three gates (slice 6 task 4)"
```

---

## Task 5: registry-remote.ts — content-addressed cache I/O

**Files:** Modify `tools/ace/registry-remote.ts`; Modify `tools/ace/registry-remote.test.ts`.

- [ ] **Step 1: Write the failing test** (append; uses temp-HOME)

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";
import { readCache, writeCache } from "./registry-remote.ts";

describe("cache I/O", () => {
  let savedHome: string | undefined, savedUP: string | undefined;
  beforeEach(() => { savedHome = process.env.HOME; savedUP = process.env.USERPROFILE;
    const h = mkdtempSync(pjoin(tmpdir(), "ace-cache-")); process.env.HOME = h; process.env.USERPROFILE = h; });
  afterEach(() => { if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
    if (savedUP !== undefined) process.env.USERPROFILE = savedUP; else delete process.env.USERPROFILE; });

  test("write then read round-trips meta + body", () => {
    const body = '{"hello":"world"}';
    const meta = writeCache("https://x/index.json", body, { etag: '"e1"', last_modified: "lm", sequence_high_water: 3 });
    expect(meta.index_content_hash).toMatch(/^sha256:/);
    const got = readCache("https://x/index.json");
    expect(got).not.toBeNull();
    expect(got!.body).toBe(body);
    expect(got!.meta.etag).toBe('"e1"');
    expect(got!.meta.sequence_high_water).toBe(3);
  });
  test("missing → null", () => { expect(readCache("https://nope")).toBeNull(); });
});
```

(`beforeEach`/`afterEach` are imported at the top of the test file already from Task 3 — if
not, add `beforeEach, afterEach` to the `bun:test` import.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** (append to `registry-remote.ts`)

```ts
function metaPath(url: string): string {
  return join(registryCacheDir(), createHash("sha256").update(url).digest("hex") + ".json");
}
function blobPath(contentHash: string): string {
  return join(registryCacheDir(), "blobs", contentHash.replace("sha256:", "") + ".json");
}
function indexContentHash(body: string): string {
  return "sha256:" + createHash("sha256").update(body).digest("hex");
}

export function readCache(url: string): { meta: CacheMeta; body: string } | null {
  try {
    const meta = JSON.parse(readFileSync(metaPath(url), "utf8")) as CacheMeta;
    if (typeof meta.index_content_hash !== "string") return null;
    const body = readFileSync(blobPath(meta.index_content_hash), "utf8");
    return { meta, body };
  } catch { return null; }
}

export function writeCache(
  url: string, body: string,
  fields: { etag?: string; last_modified?: string; sequence_high_water: number },
): CacheMeta {
  const ch = indexContentHash(body);
  mkdirSync(join(registryCacheDir(), "blobs"), { recursive: true });
  writeFileSync(blobPath(ch), body);
  const meta: CacheMeta = {
    url, sequence_high_water: fields.sequence_high_water, index_content_hash: ch,
    fetched_at: new Date().toISOString(),
    ...(fields.etag !== undefined ? { etag: fields.etag } : {}),
    ...(fields.last_modified !== undefined ? { last_modified: fields.last_modified } : {}),
  };
  writeFileSync(metaPath(url), JSON.stringify(meta, null, 2));
  return meta;
}
```

- [ ] **Step 4: Run** → PASS; `tsc` exit 0.
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/registry-remote.ts tools/ace/registry-remote.test.ts
git commit -m "feat(ace): registry-remote content-addressed cache I/O (slice 6 task 5)"
```

---

## Task 6: registry-remote.ts — `fetchRemoteIndex` (conditional GET + offline + cache-fallback)

**Files:** Modify `tools/ace/registry-remote.ts`; Modify `tools/ace/registry-remote.test.ts`.

- [ ] **Step 1: Write the failing test** (append; save/restore `globalThis.fetch`)

```ts
import { generateKeypair as gkp, signIndex as sidx } from "./signing.ts";
import { fetchRemoteIndex } from "./registry-remote.ts";

function indexJson(kp: { privatePem: string }, seq: number, issuedAtMs: number) {
  const content = { format_version: 1 as const, sequence: seq, issued_at: new Date(issuedAtMs).toISOString(),
    packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "sha256:aa" } } } };
  return JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
}

describe("fetchRemoteIndex", () => {
  let savedFetch: typeof globalThis.fetch, savedHome: string | undefined, savedUP: string | undefined;
  beforeEach(() => { savedFetch = globalThis.fetch; savedHome = process.env.HOME; savedUP = process.env.USERPROFILE;
    const h = mkdtempSync(pjoin(tmpdir(), "ace-fetch-")); process.env.HOME = h; process.env.USERPROFILE = h; });
  afterEach(() => { globalThis.fetch = savedFetch;
    if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
    if (savedUP !== undefined) process.env.USERPROFILE = savedUP; else delete process.env.USERPROFILE; });

  test("200 verifies + returns entries + caches", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    globalThis.fetch = (async () => new Response(indexJson(kp, 1, now), { status: 200, headers: { ETag: '"e1"' } })) as typeof fetch;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, trust, { now });
    expect("entries" in r).toBe(true);
    if ("entries" in r) expect(r.entries.get("leaf")!.get("1.0.0")!.url).toBe("https://x/l.json");
  });
  test("304 uses cached body", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    globalThis.fetch = (async () => new Response(indexJson(kp, 2, now), { status: 200, headers: { ETag: '"e2"' } })) as typeof fetch;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const remote = { url: "https://x/index.json", key_id: kp.keyId };
    await fetchRemoteIndex(remote, trust, { now });
    globalThis.fetch = (async () => new Response(null, { status: 304 })) as typeof fetch;
    const r = await fetchRemoteIndex(remote, trust, { now });
    expect("entries" in r).toBe(true);
  });
  test("network error → cache-fallback", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    globalThis.fetch = (async () => new Response(indexJson(kp, 1, now), { status: 200 })) as typeof fetch;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const remote = { url: "https://x/index.json", key_id: kp.keyId };
    await fetchRemoteIndex(remote, trust, { now });
    globalThis.fetch = (async () => { throw new Error("net"); }) as typeof fetch;
    const r = await fetchRemoteIndex(remote, trust, { now });
    expect("entries" in r).toBe(true);
  });
  test("network error + no cache → skipped", async () => {
    const kp = gkp();
    globalThis.fetch = (async () => { throw new Error("net"); }) as typeof fetch;
    const r = await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, new Map(), { now: Date.now() });
    expect("skipped" in r).toBe(true);
  });
  test("rollback on 200 → error (hard refusal)", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const remote = { url: "https://x/index.json", key_id: kp.keyId };
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    globalThis.fetch = (async () => new Response(indexJson(kp, 5, now), { status: 200 })) as typeof fetch;
    await fetchRemoteIndex(remote, trust, { now });           // high-water = 5
    globalThis.fetch = (async () => new Response(indexJson(kp, 2, now), { status: 200 })) as typeof fetch;
    const r = await fetchRemoteIndex(remote, trust, { now });  // seq 2 < 5
    expect("error" in r).toBe(true);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** (append to `registry-remote.ts`)

```ts
export interface FetchOpts { offline?: boolean; now?: number }

function toRegistryFragment(doc: IndexDoc): Registry {
  const m: Registry = new Map();
  for (const [name, versions] of Object.entries(doc.packages)) {
    const vm = new Map<string, RegistryEntry>();
    for (const [version, entry] of Object.entries(versions)) vm.set(version, entry);
    m.set(name, vm);
  }
  return m;
}

export async function fetchRemoteIndex(
  remote: RemoteRegistryConfig, trustStore: Map<string, TrustEntry>, opts: FetchOpts = {},
): Promise<{ entries: Registry } | { error: string } | { skipped: string }> {
  const now = opts.now ?? Date.now();
  const cached = readCache(remote.url);
  const cacheMeta: CacheMeta = cached?.meta ?? { url: remote.url, sequence_high_water: 0, index_content_hash: "", fetched_at: "" };

  // Validate a CACHED body through the three gates; on pass, return entries (never writes —
  // the fresh-200 path below does its own cache write with the captured ETag/Last-Modified).
  const useCachedBody = (body: string): { entries: Registry } | { error: string } => {
    const parsed = parseIndex(body);
    if ("error" in parsed) return { error: `${remote.url}: ${parsed.error}` };
    const v = verifyIndex(parsed, remote, trustStore, cacheMeta, now, { offline: opts.offline === true });
    if (!v.ok) return { error: `${remote.url}: ${v.reason}` };
    return { entries: toRegistryFragment(parsed) };
  };

  if (opts.offline) {
    if (!cached) return { skipped: `${remote.url}: offline + no cache` };
    return useCachedBody(cached.body);
  }

  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (cacheMeta.etag) headers["If-None-Match"] = cacheMeta.etag;
    if (cacheMeta.last_modified) headers["If-Modified-Since"] = cacheMeta.last_modified;
    res = await fetch(remote.url, { headers });
  } catch {
    if (cached) return useCachedBody(cached.body);
    return { skipped: `${remote.url}: unreachable + no cache` };
  }

  if (res.status === 304) {
    if (cached) return useCachedBody(cached.body);
    return { skipped: `${remote.url}: 304 but no cache` };
  }
  if (res.status !== 200) {
    if (cached) return useCachedBody(cached.body);
    return { skipped: `${remote.url}: HTTP ${res.status} + no cache` };
  }
  const body = await res.text();
  const parsed = parseIndex(body);
  if ("error" in parsed) return { error: `${remote.url}: ${parsed.error}` };
  const v = verifyIndex(parsed, remote, trustStore, cacheMeta, now, { offline: false });
  if (!v.ok) return { error: `${remote.url}: ${v.reason}` };
  const etag = res.headers.get("ETag") ?? undefined;
  const last_modified = res.headers.get("Last-Modified") ?? undefined;
  writeCache(remote.url, body, {
    sequence_high_water: Math.max(parsed.sequence, cacheMeta.sequence_high_water),
    ...(etag !== undefined ? { etag } : {}),
    ...(last_modified !== undefined ? { last_modified } : {}),
  });
  return { entries: toRegistryFragment(parsed) };
}
```

> **Implementer note:** `useCachedBody` is validation-only (no cache write); only the
> fresh-200 path writes the cache, capturing the response ETag/Last-Modified. Pass
> `offline: opts.offline === true` (a definite boolean) to `verifyIndex` — the repo uses
> `exactOptionalPropertyTypes`, so `{ offline: opts.offline }` (possibly `undefined`) would
> fail `tsc`.

- [ ] **Step 4: Run** → tests PASS; `tsc` exit 0.
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/registry-remote.ts tools/ace/registry-remote.test.ts
git commit -m "feat(ace): registry-remote fetchRemoteIndex conditional-GET + offline + cache-fallback (slice 6 task 6)"
```

---

## Task 7: registry-remote.ts — `loadRegistries` (merge precedence)

**Files:** Modify `tools/ace/registry-remote.ts`; Modify `tools/ace/registry-remote.test.ts`.

- [ ] **Step 1: Write the failing test** (append)

```ts
import { loadRegistries } from "./registry-remote.ts";

describe("loadRegistries merge precedence", () => {
  let savedFetch: typeof globalThis.fetch, savedHome: string | undefined, savedUP: string | undefined;
  beforeEach(() => { savedFetch = globalThis.fetch; savedHome = process.env.HOME; savedUP = process.env.USERPROFILE;
    const h = mkdtempSync(pjoin(tmpdir(), "ace-load-")); process.env.HOME = h; process.env.USERPROFILE = h; });
  afterEach(() => { globalThis.fetch = savedFetch;
    if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
    if (savedUP !== undefined) process.env.USERPROFILE = savedUP; else delete process.env.USERPROFILE; });

  test("remote entries appear; user overrides remote on conflict", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const content = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(),
      packages: { leaf: { "1.0.0": { url: "https://REMOTE/l.json", package_hash: "sha256:rr" } } } };
    const body = JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
    globalThis.fetch = (async () => new Response(body, { status: 200 })) as typeof fetch;
    // configure remote + a user-local override of the SAME name@version
    const { writeRegistryRemote, addRegistryEntry } = await import("./store.ts");
    writeRegistryRemote({ url: "https://x/index.json", key_id: kp.keyId });
    addRegistryEntry("leaf", "1.0.0", { url: "https://LOCAL/l.json", package_hash: "sha256:ll" });
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = await loadRegistries({ trustStore: trust, now });
    expect(r.errors).toEqual([]);
    expect(r.registry.get("leaf")!.get("1.0.0")!.url).toBe("https://LOCAL/l.json"); // user wins
  });
  test("a verify failure on a remote → errors (hard)", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const content = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(), packages: {} };
    const body = JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
    globalThis.fetch = (async () => new Response(body, { status: 200 })) as typeof fetch;
    const { writeRegistryRemote } = await import("./store.ts");
    writeRegistryRemote({ url: "https://x/index.json", key_id: "ed25519:WRONGPIN" });
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = await loadRegistries({ trustStore: trust, now });
    expect(r.errors.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** (append to `registry-remote.ts`)

```ts
export interface LoadRegistriesOpts { trustStore: Map<string, TrustEntry>; offline?: boolean; now?: number }

/** Merge: remotes (reverse listed order) ∪ bundled ∪ user → user > bundled > remote[0] > … */
export async function loadRegistries(
  opts: LoadRegistriesOpts,
): Promise<{ registry: Registry; warnings: string[]; errors: string[] }> {
  const warnings: string[] = []; const errors: string[] = [];
  const remotes = readRegistriesConfig().remotes;
  const fragments: Registry[] = [];
  for (const remote of remotes) {
    const r = await fetchRemoteIndex(remote, opts.trustStore, { offline: opts.offline === true, ...(opts.now !== undefined ? { now: opts.now } : {}) });
    if ("error" in r) errors.push(r.error);
    else if ("skipped" in r) warnings.push(r.skipped);
    else fragments.push(r.entries);
  }
  const registry: Registry = new Map();
  const merge = (frag: Registry): void => {
    for (const [name, versions] of frag) {
      const vm = registry.get(name) ?? new Map<string, RegistryEntry>();
      for (const [v, e] of versions) vm.set(v, e);
      registry.set(name, vm);
    }
  };
  // lowest precedence first: remotes reverse, then local (bundled∪user) on top
  for (let i = fragments.length - 1; i >= 0; i--) merge(fragments[i]!);
  merge(loadRegistry()); // bundled∪user (user already overrides bundled inside loadRegistry)
  return { registry, warnings, errors };
}
```

- [ ] **Step 4: Run** → PASS; `tsc` exit 0.
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/registry-remote.ts tools/ace/registry-remote.test.ts
git commit -m "feat(ace): registry-remote loadRegistries merge precedence (slice 6 task 7)"
```

---

## Task 8: ace.ts — `registry remote add/list/rm` CLI

**Files:** Modify `tools/ace/ace.ts`; Modify `tools/ace/ace.test.ts`.

- [ ] **Step 1: Write the failing test** (append to `ace.test.ts`)

```ts
import { readRegistriesConfig } from "./store.ts";

describe("ace registry remote (slice 6)", () => {
  test("add (with --key) → list → rm round-trips", async () => {
    expect(await main(["registry", "remote", "add", "https://r/index.json", "--key", "ed25519:abc"])).toBe(0);
    expect(readRegistriesConfig().remotes).toEqual([{ url: "https://r/index.json", key_id: "ed25519:abc" }]);
    expect(await main(["registry", "remote", "list"])).toBe(0);
    expect(await main(["registry", "remote", "rm", "https://r/index.json"])).toBe(0);
    expect(readRegistriesConfig().remotes).toEqual([]);
  });
  test("add WITHOUT --key is a parse error", () => {
    const a = parseArgs(["registry", "remote", "add", "https://r/index.json"]);
    expect("error" in a).toBe(true);
  });
  test("add with --max-staleness-days", async () => {
    expect(await main(["registry", "remote", "add", "https://r/i.json", "--key", "ed25519:k", "--max-staleness-days", "7"])).toBe(0);
    expect(readRegistriesConfig().remotes[0]!.max_staleness_days).toBe(7);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** (patch-scripts on `ace.ts`)

(a) Extend `RegistryArgs` (the `interface RegistryArgs` block) — add the `remote` sub +
fields:

```ts
interface RegistryArgs {
  readonly command: "registry";
  readonly sub: "list" | "add" | "remote-add" | "remote-list" | "remote-rm";
  readonly regName?: string;
  readonly regVersion?: string;
  readonly regUrl?: string;
  readonly regHash?: string;
  readonly remoteUrl?: string;
  readonly remoteKey?: string;
  readonly remoteMaxStaleness?: number;
}
```

(b) In the `if (command === "registry")` parse block, BEFORE
`return { error: "registry requires 'add' or 'list'" };`, add the `remote` sub-verb:

```ts
    if (sub === "remote") {
      const action = argv[2];
      if (action === "list") return { command: "registry", sub: "remote-list" };
      if (action === "rm") {
        const url = argv[3];
        if (!url || url.startsWith("-")) return { error: "registry remote rm requires <url>" };
        return { command: "registry", sub: "remote-rm", remoteUrl: url };
      }
      if (action === "add") {
        const url = argv[3];
        if (!url || url.startsWith("-")) return { error: "registry remote add requires <url> --key <keyid>" };
        let key: string | undefined; let msd: number | undefined;
        for (let i = 4; i < argv.length; i++) {
          if (argv[i] === "--key") { key = argv[++i]; if (!key || key.startsWith("-")) return { error: "--key requires a value" }; }
          else if (argv[i] === "--max-staleness-days") { const v = argv[++i]; if (!v || v.startsWith("-")) return { error: "--max-staleness-days requires a value" }; msd = Number(v); if (!Number.isInteger(msd) || msd <= 0) return { error: "--max-staleness-days must be a positive integer" }; }
          else return { error: `Unknown option for registry remote add: ${argv[i]}` };
        }
        if (!key) return { error: "registry remote add requires --key <keyid>" }; // Codex #6424 P1: pin mandatory
        const r: RegistryArgs = { command: "registry", sub: "remote-add", remoteUrl: url, remoteKey: key };
        return msd !== undefined ? { ...r, remoteMaxStaleness: msd } : r;
      }
      return { error: "registry remote requires 'add', 'list', or 'rm'" };
    }
```

(c) Add the import: extend the `from "./store.ts"` import to include
`writeRegistryRemote, removeRegistryRemote, readRegistriesConfig`.

(d) In the `if (parsed.command === "registry")` handler, BEFORE the existing `sub === "add"`
local handling, add:

```ts
    if (parsed.sub === "remote-list") {
      const remotes = readRegistriesConfig().remotes;
      if (remotes.length === 0) { console.log("No remote registries. (add: ace registry remote add <url> --key <keyid>)"); return 0; }
      for (const r of remotes) console.log(`  ${r.url}  key=${r.key_id}${r.max_staleness_days ? `  max-staleness=${r.max_staleness_days}d` : ""}`);
      return 0;
    }
    if (parsed.sub === "remote-rm") {
      const { removed } = removeRegistryRemote(parsed.remoteUrl!);
      console.log(removed ? `ace: removed remote ${parsed.remoteUrl}` : `ace: no such remote ${parsed.remoteUrl}`);
      return 0;
    }
    if (parsed.sub === "remote-add") {
      const entry = parsed.remoteMaxStaleness !== undefined
        ? { url: parsed.remoteUrl!, key_id: parsed.remoteKey!, max_staleness_days: parsed.remoteMaxStaleness }
        : { url: parsed.remoteUrl!, key_id: parsed.remoteKey! };
      const { added, updated } = writeRegistryRemote(entry);
      console.log(`ace: ${updated ? "updated" : added ? "added" : "noop"} remote ${parsed.remoteUrl}`);
      return 0;
    }
```

(e) Update the usage text block: add the lines `ace registry remote add <url> --key
<keyid> [--max-staleness-days <n>]`, `ace registry remote list`, and `ace registry remote
rm <url>` (indent them to match the existing usage lines).

- [ ] **Step 4: Run** → `bun test tools/ace/ace.test.ts` PASS; `tsc` exit 0.
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "feat(ace): registry remote add/list/rm CLI (slice 6 task 8)"
```

---

## Task 9: ace.ts — `--offline` + async registry load in install/update + integration

**Files:** Modify `tools/ace/ace.ts`; Modify `tools/ace/ace.test.ts`.

- [ ] **Step 1: Write the failing test** (append; remote-resolved install via fetch mock)

```ts
import { generateKeypair as gkpA, signIndex as sidxA } from "./signing.ts";

describe("ace install via remote registry (slice 6)", () => {
  let savedFetch: typeof globalThis.fetch;
  beforeEach(() => { savedFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = savedFetch; });

  test("resolves + installs a package from a signed remote index", async () => {
    const kp = gkpA(); const now = Date.now();
    // a signed leaf PACKAGE the index points at (reuse the existing signed-package helper shape)
    const files = { "leaf.txt": "hi" };
    const filesJson = JSON.stringify(files);
    const ch = contentHash(new TextEncoder().encode(filesJson));
    const pkgKp = generateKeypair();
    const manifest = { format_version: 1, name: "leaf", version: "1.0.0", content_hash: ch };
    const pkg = { manifest: { ...manifest, signature: signManifest(manifest, pkgKp.privatePem) }, files };
    const pkgJson = JSON.stringify(pkg);
    const pkgHash = packageHash(pkg as any);
    const pkgUrl = "https://pkgs/leaf-1.0.0.json";
    // signed index pointing at it
    const idxContent = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(),
      packages: { leaf: { "1.0.0": { url: pkgUrl, package_hash: pkgHash } } } };
    const idxJson = JSON.stringify({ ...idxContent, signature: sidxA(idxContent, kp.privatePem) });
    globalThis.fetch = (async (u: string) => new Response(u === pkgUrl ? pkgJson : idxJson, { status: 200 })) as typeof fetch;
    // trust BOTH the index signer and the package signer; configure the remote (pinned)
    await main(["trust", "add", kp.publicSpkiB64]);        // index signer
    await main(["trust", "add", pkgKp.publicSpkiB64]);     // package signer
    await main(["registry", "remote", "add", "https://x/index.json", "--key", kp.keyId]);
    // a root that depends on leaf via range
    const root = { manifest: { format_version: 1, name: "root", version: "1.0.0",
      content_hash: contentHash(new TextEncoder().encode(JSON.stringify({ "r.txt": "r" }))),
      dependencies: [{ kind: "registry", name: "leaf", version: "^1.0.0" }] }, files: { "r.txt": "r" } };
    const rootPath = join(tempHome, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
    const code = await main(["install", rootPath, "--allow-no-signature"]);
    expect(code).toBe(0);
    expect(listInstalled(join(tempHome, ".ace", "store")).some((p) => p.manifest.name === "leaf")).toBe(true);
  });

  test("--offline + --frozen parse OK together", () => {
    const a = parseArgs(["install", "x.json", "--offline", "--frozen"]);
    expect("error" in a).toBe(false);
  });
});
```

> **Implementer note:** mirror the exact `trust add` / store-path conventions the existing
> `ace.test.ts` install tests use (the store path is `~/.ace/store`; `--allow-no-signature`
> waives the *root*'s missing signature; the leaf package IS signed by `pkgKp`). Adapt the
> assertion helpers to whatever the file already imports.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** (patch-scripts on `ace.ts`)

(a) Add `offline` to `InstallArgs` + `UpdateArgs` interfaces, parse `--offline` in both
parse branches (mirror the existing `--frozen` / `--allow-no-signature` boolean parse;
`--offline` + `--frozen` is allowed — do NOT add a mutual-exclusion error).

(b) Add import: extend `from "./registry-remote.ts"` (new) → `import { loadRegistries } from "./registry-remote.ts";`.

(c) In the **install** handler graph path, replace the synchronous
`const registry = loadRegistry();` with:

```ts
    const { registry, warnings, errors } = await loadRegistries({
      trustStore: loadTrustStore(), offline: parsed.offline ?? false,
    });
    for (const w of warnings) console.error(`ace: ${w}`);
    if (errors.length > 0) { for (const e of errors) console.error(`ace: install refused: ${e}`); return 1; }
```

(Do the identical swap in the **update** handler. Leave `--frozen` untouched — the frozen
path never calls `loadRegistry`/`loadRegistries`.)

> `loadTrustStore` is already imported in `ace.ts`. If the install/update handlers reference
> `registry` after this block, the variable name is preserved, so downstream solve/resolve is
> unchanged.

(d) Update usage text: add `--offline` to the install + update lines.

- [ ] **Step 4: Run** → `bun test tools/ace/` (whole suite) PASS; `bun --bun tsc --noEmit -p tsconfig.json` exit 0; markdownlint (none here).
- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "feat(ace): --offline + async loadRegistries in install/update (slice 6 task 9)"
```

---

## Task 10: SKILL.md — document remote registries

**Files:** Modify `.claude/skills/ace/SKILL.md`.

- [ ] **Step 1: Implement** (patch-script append a "Remote registries (slice 6)" section)

Document: `ace registry remote add <url> --key <keyid> [--max-staleness-days <n>]` / `list` /
`rm`; that `--key` is **required** (every remote pins its ed25519 signer; the key must be in
the trust store); the **three index gates** (signature pin, monotonic-sequence anti-rollback,
and two-sided freshness with a 30-day default max-staleness plus a 5-minute future-skew bound);
`--offline` (uses cache, skips only the past-staleness gate); precedence (user > bundled >
remote[0] > …); and that the per-package hash-pin + signature gate are unchanged.

- [ ] **Step 2: Verify** → `bunx markdownlint-cli2 ".claude/skills/ace/SKILL.md"` exit 0.
- [ ] **Step 3: Commit** (canary 67)

```bash
git add .claude/skills/ace/SKILL.md
git commit -m "docs(ace): document remote registries (slice 6 task 10)"
```

---

## After all tasks

- [ ] Whole suite: `bun test tools/ace/` → all pass (≈230+ tests).
- [ ] Strict: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] Canary: `git ls-tree HEAD | wc -l` → 67.
- [ ] Final holistic code-review subagent over `git diff origin/main..HEAD -- tools/ace/ .claude/skills/ace/SKILL.md`.
- [ ] Open the impl PR; arm auto-merge; run the PR-gate loop.
- [ ] File deferred sub-rows: mirror/failover, incremental index, full TUF roles,
  `ace registry publish` tooling, per-registry key rotation.
