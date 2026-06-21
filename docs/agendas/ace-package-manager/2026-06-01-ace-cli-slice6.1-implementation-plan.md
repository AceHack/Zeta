# Ace CLI slice 6.1 — `ace registry publish` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ace registry publish --packages <dir> --base-url <url> --key <pem> [--out index.json]`
— scan a dir of package files, derive each consumer `url` + `package_hash`, assemble + sign
the registry index, auto-bump `sequence` from `--out`, and round-trip self-verify the
produced index through the consumer's `parseIndex` + `verifyIndexSignature` before writing.

**Architecture:** A pure helper module `tools/ace/registry-publish.ts` (assemble/sign/bump/
url-join) + a tiny additive `publicKeyInfoFromPrivatePem` in `signing.ts` (for the
self-verify trust store) + a `registry publish` sub-verb in `ace.ts` (dir scan, file I/O,
self-verify). Reuses `packageHash` (resolve.ts), `signIndex`/`IndexSignableContent`
(signing.ts), `IndexDoc`/`parseIndex`/`verifyIndexSignature` (registry-remote.ts + signing.ts).

**Tech Stack:** TypeScript on Bun; `node:crypto` ed25519; `bun test`; strict `tsc`.

**Spec:** `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice6.1-registry-publish-design.md`.

**Harness constraints (every task):** Otto-343 hook blocks the Edit tool even after
Read/Write — use **Write** for brand-new files, **bun patch-scripts** for edits to existing
files (write `tools/ace/_patch_<x>.ts` → `readFileSync` → `split().length-1`
assert-exactly-1 → `split().join()` → `writeFileSync` → `bun run` → `rm` — and **`rm` it
before committing; never commit a `_patch_*.ts`**). Commit canary `git ls-tree HEAD | wc -l`
must stay **67**. Commit trailer last line: the project's standard `Co-Authored-By:` agent trailer (see `CLAUDE.md`). Tests: `bun test tools/ace/`. Strict gate:
`bun --bun tsc --noEmit -p tsconfig.json` (exit 0; repo uses `exactOptionalPropertyTypes` +
`noUnusedLocals` — never assign `undefined` to an optional prop; import only what you use).
markdownlint on SKILL.md (Task 4): blank lines around headings/lists/fences; no spaces
inside `code spans`; don't start a wrapped line with `#` or `+`.

**Existing-code facts to reuse (do not re-derive):**

- `signing.ts`: `keyId(spkiB64)`, `generateKeypair()`, `signIndex(content, privatePem)`,
  `IndexSignableContent`, `AceSignature`, `TrustEntry`, `VerifyResult`. Top imports already
  include `createPrivateKey, createPublicKey` from `node:crypto`.
- `store.ts`: `AcePackage { manifest: { name, version, content_hash, ... }, files }`,
  `RegistryEntry { url, package_hash }`.
- `resolve.ts`: `packageHash(pkg: AcePackage): string`.
- `registry-remote.ts`: `IndexDoc = IndexSignableContent & { signature: AceSignature }`
  (exported), `parseIndex(json): IndexDoc | { error }`.
- `ace.ts`: `interface RegistryArgs { command: "registry"; sub: "list"|"add"|"remote-add"|
  "remote-list"|"remote-rm"; ... }` + the `if (command === "registry")` parse block (handles
  `remote` sub-verb) + the `if (parsed.command === "registry")` handler. `verifyIndexSignature`
  imported from `./signing.ts`; `parseIndex` from `./registry-remote.ts` (already imported
  for the install/update paths). `node:fs` `readFileSync`/`writeFileSync`/`readdirSync`/
  `existsSync` available.
- `ace.test.ts`: per-test temp-HOME (`tempHome`, `beforeEach`/`afterEach`); `generateKeypair`,
  `signManifest`, `contentHash`, `packageHash`, `listInstalled`, `parseLockfile` imported;
  `signIndex`/`generateKeypair` available; global-`fetch` save/restore pattern from slice 6.

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `tools/ace/signing.ts` | + `publicKeyInfoFromPrivatePem` (pubkey + keyId from a private PEM) | 1 |
| `tools/ace/signing.test.ts` | test for the above | 1 |
| `tools/ace/registry-publish.ts` (**new**) | `joinUrl`, `nextSequence`, `buildIndexDoc` (pure) | 2 |
| `tools/ace/registry-publish.test.ts` (**new**) | unit tests | 2 |
| `tools/ace/ace.ts` | `registry publish` parse + handler + usage | 3 |
| `tools/ace/ace.test.ts` | end-to-end producer→consumer test | 3 |
| `.claude/skills/ace/SKILL.md` | document `ace registry publish` | 4 |

---

## Task 1: signing.ts — `publicKeyInfoFromPrivatePem`

**Files:** Modify `tools/ace/signing.ts`; Modify `tools/ace/signing.test.ts`.

- [ ] **Step 1: Write the failing test** (append to `tools/ace/signing.test.ts` via patch-script)

```ts
import { publicKeyInfoFromPrivatePem } from "./signing.ts";

describe("publicKeyInfoFromPrivatePem", () => {
  test("derives the same keyId + public_key as generateKeypair for the same key", () => {
    const kp = generateKeypair();
    const info = publicKeyInfoFromPrivatePem(kp.privatePem);
    expect(info.keyId).toBe(kp.keyId);
    expect(info.public_key).toBe(kp.publicSpkiB64);
  });
  test("the derived public_key verifies an index this key signed", () => {
    const kp = generateKeypair();
    const content = { format_version: 1 as const, sequence: 1, issued_at: "2026-06-01T12:00:00Z",
      packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "sha256:aa" } } } };
    const sig = signIndex(content, kp.privatePem);
    const info = publicKeyInfoFromPrivatePem(kp.privatePem);
    const trust = new Map([[info.keyId, { public_key: info.public_key }]]);
    expect(verifyIndexSignature(content, sig, trust).ok).toBe(true);
  });
});
```
(`generateKeypair`, `signIndex`, `verifyIndexSignature` are already imported at the top of
signing.test.ts from Task-1-of-slice-6; if not, add them to the `./signing.ts` import.)

- [ ] **Step 2: Run → confirm RED** (`publicKeyInfoFromPrivatePem` not exported).
  Run: `bun test tools/ace/signing.test.ts`

- [ ] **Step 3: Implement** (patch-script append to `signing.ts`)

```ts
/** Derive the SPKI-DER base64 public key + its keyId from a private PEM (for a self-verify
 *  trust store). Sibling of signIndex's internal signer-id derivation. */
export function publicKeyInfoFromPrivatePem(privatePem: string): { keyId: string; public_key: string } {
  const priv = createPrivateKey(privatePem);
  const public_key = (createPublicKey(priv).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  return { keyId: keyId(public_key), public_key };
}
```
(`createPrivateKey`, `createPublicKey`, `keyId` are already in scope in signing.ts.)

- [ ] **Step 4: Run → GREEN; `bun --bun tsc --noEmit -p tsconfig.json` exit 0.** False-green
  check: break the `public_key` derivation (e.g. wrong export type) → the verify test goes
  red → restore.

- [ ] **Step 5: Commit** (canary 67 first)

```bash
git add tools/ace/signing.ts tools/ace/signing.test.ts
git commit -m "feat(ace): publicKeyInfoFromPrivatePem for publish self-verify (slice 6.1 task 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: registry-publish.ts — `joinUrl` / `nextSequence` / `buildIndexDoc` (pure)

**Files:** Create `tools/ace/registry-publish.ts`; Create `tools/ace/registry-publish.test.ts`.

- [ ] **Step 1: Write the failing test** (`tools/ace/registry-publish.test.ts`)

```ts
import { describe, expect, test } from "bun:test";
import { joinUrl, nextSequence, buildIndexDoc } from "./registry-publish.ts";
import { generateKeypair, verifyIndexSignature, publicKeyInfoFromPrivatePem } from "./signing.ts";
import { parseIndex } from "./registry-remote.ts";
import { packageHash } from "./resolve.ts";
import { contentHash } from "./store.ts";

// helper: a minimal well-formed AcePackage with a correct content_hash
function pkg(name: string, version: string, files: Record<string, string> = { "a.txt": "x" }) {
  const content_hash = contentHash(new TextEncoder().encode(JSON.stringify(files)));
  return { manifest: { format_version: 1, name, version, content_hash }, files };
}

describe("joinUrl", () => {
  test("single separator regardless of trailing slash", () => {
    expect(joinUrl("https://pkgs", "leaf-1.0.0.json")).toBe("https://pkgs/leaf-1.0.0.json");
    expect(joinUrl("https://pkgs/", "leaf-1.0.0.json")).toBe("https://pkgs/leaf-1.0.0.json");
    expect(joinUrl("https://pkgs///", "leaf-1.0.0.json")).toBe("https://pkgs/leaf-1.0.0.json");
  });
});

describe("nextSequence", () => {
  test("null → 1", () => { expect(nextSequence(null)).toBe(1); });
  test("prev → prev+1", () => {
    const prev = { format_version: 1 as const, sequence: 6, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519" as const, key_id: "k", sig: "s" } };
    expect(nextSequence(prev)).toBe(7);
  });
});

describe("buildIndexDoc", () => {
  const kp = generateKeypair();
  const issuedAt = "2026-06-01T12:00:00Z";
  test("assembles url + package_hash per package, signs, self-verifies", () => {
    const p = pkg("leaf", "1.0.0");
    const doc = buildIndexDoc({ packages: [p as never], baseUrl: "https://pkgs", sequence: 3, issuedAt, privatePem: kp.privatePem });
    expect("error" in doc).toBe(false);
    if ("error" in doc) return;
    expect(doc.sequence).toBe(3);
    expect(doc.issued_at).toBe(issuedAt);
    expect(doc.packages.leaf!["1.0.0"]!.url).toBe("https://pkgs/leaf-1.0.0.json");
    expect(doc.packages.leaf!["1.0.0"]!.package_hash).toBe(packageHash(p as never));
    // round-trip through the consumer gates
    const reparsed = parseIndex(JSON.stringify(doc));
    expect("error" in reparsed).toBe(false);
    const info = publicKeyInfoFromPrivatePem(kp.privatePem);
    const { signature, ...content } = doc;
    expect(verifyIndexSignature(content, signature, new Map([[info.keyId, { public_key: info.public_key }]])).ok).toBe(true);
  });
  test("duplicate name@version → error", () => {
    const doc = buildIndexDoc({ packages: [pkg("leaf", "1.0.0") as never, pkg("leaf", "1.0.0") as never], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
    expect("error" in doc).toBe(true);
  });
});
```

- [ ] **Step 2: Run → RED** (module not found).

- [ ] **Step 3: Implement** (`tools/ace/registry-publish.ts`)

```ts
// registry-publish.ts -- Ace slice 6.1: pure producer-side index assembly + signing.
// Inverts the consumer: build the signed IndexSignableContent a slice-6 consumer accepts.
// No I/O — the caller (ace.ts) reads the package files + sequence + pem and writes the output.
import type { AcePackage, RegistryEntry } from "./store.ts";
import { packageHash } from "./resolve.ts";
import type { IndexSignableContent } from "./signing.ts";
import { signIndex } from "./signing.ts";
import type { IndexDoc } from "./registry-remote.ts";

/** Join a base url + filename with exactly one separator (trailing slashes normalized). */
export function joinUrl(base: string, file: string): string {
  return base.replace(/\/+$/, "") + "/" + file;
}

/** Monotonic next sequence: bump the prior index's sequence, or start at 1. */
export function nextSequence(prev: IndexDoc | null): number {
  return prev ? prev.sequence + 1 : 1;
}

/** Assemble + sign an index doc from already-read packages. Duplicate name@version → error. */
export function buildIndexDoc(args: {
  packages: AcePackage[]; baseUrl: string; sequence: number; issuedAt: string; privatePem: string;
}): IndexDoc | { error: string } {
  // Null-prototype map: a package name like "__proto__" cannot pollute via bracket-assign.
  const packages: Record<string, Record<string, RegistryEntry>> = Object.create(null);
  for (const pkg of args.packages) {
    const name = pkg.manifest.name;
    const version = pkg.manifest.version;
    const versions = packages[name] ?? (Object.create(null) as Record<string, RegistryEntry>);
    if (versions[version] !== undefined) return { error: `duplicate package ${name}@${version}` };
    versions[version] = { url: joinUrl(args.baseUrl, `${name}-${version}.json`), package_hash: packageHash(pkg) };
    packages[name] = versions;
  }
  const content: IndexSignableContent = { format_version: 1, sequence: args.sequence, issued_at: args.issuedAt, packages };
  const signature = signIndex(content, args.privatePem);
  return { ...content, signature };
}
```

- [ ] **Step 4: Run → GREEN; `tsc` exit 0.** False-green: break `joinUrl` (drop the
  separator) → the url test goes red → restore.

- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/registry-publish.ts tools/ace/registry-publish.test.ts
git commit -m "feat(ace): registry-publish buildIndexDoc/nextSequence/joinUrl (slice 6.1 task 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: ace.ts — `registry publish` CLI + handler + end-to-end test

**Files:** Modify `tools/ace/ace.ts`; Modify `tools/ace/ace.test.ts`.

- [ ] **Step 1: Write the failing test** (append to `tools/ace/ace.test.ts` via patch-script)

```ts
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
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-"));   // mkdtempSync creates the dir
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    writeFileSync(join(pkgDir, "not-a-package.json"), JSON.stringify({ hello: "world" })); // skipped
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
    // re-publish bumps sequence 1 → 2
    const code2 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code2).toBe(0);
    const doc2 = parseIndex(readFileSync(outPath, "utf8"));
    if (!("error" in doc2)) expect(doc2.sequence).toBe(2);
  });

  test("publish without --key is a parse error", () => {
    expect("error" in parseArgs(["registry", "publish", "--packages", "d", "--base-url", "https://x"])).toBe(true);
  });
});
```
> **Implementer note:** adapt to the real `ace.test.ts` imports — `mkdtempSync`, `join`,
> `tmpdir`, `readFileSync`, `writeFileSync`, `contentHash`, `generateKeypair`, `signManifest`,
> `parseArgs`, `main`, `tempHome` are already imported/available there; do not duplicate
> imports. The test's intent: publish a dir → exit 0 → `parseIndex(out)` shows the expected
> node + sequence 1; re-publish bumps the sequence to 2; a non-package json is skipped;
> missing `--key` is a parse error.

- [ ] **Step 2: Run → RED.**

- [ ] **Step 3: Implement** (patch-scripts on `ace.ts`)

(a) Extend `RegistryArgs`:

```ts
interface RegistryArgs {
  readonly command: "registry";
  readonly sub: "list" | "add" | "remote-add" | "remote-list" | "remote-rm" | "publish";
  readonly regName?: string;
  readonly regVersion?: string;
  readonly regUrl?: string;
  readonly regHash?: string;
  readonly remoteUrl?: string;
  readonly remoteKey?: string;
  readonly remoteMaxStaleness?: number;
  readonly pubPackagesDir?: string;
  readonly pubBaseUrl?: string;
  readonly pubKeyPath?: string;
  readonly pubOut?: string;
}
```

(b) In the `if (command === "registry")` parse block, add a `publish` branch (sibling of the
`remote` branch, BEFORE the final `return { error: "registry requires ..." }`):

```ts
    if (sub === "publish") {
      let dir: string | undefined, base: string | undefined, key: string | undefined, out: string | undefined;
      for (let i = 2; i < argv.length; i++) {
        if (argv[i] === "--packages") { dir = argv[++i]; if (!dir || dir.startsWith("-")) return { error: "--packages requires a value" }; }
        else if (argv[i] === "--base-url") { base = argv[++i]; if (!base || base.startsWith("-")) return { error: "--base-url requires a value" }; }
        else if (argv[i] === "--key") { key = argv[++i]; if (!key || key.startsWith("-")) return { error: "--key requires a value" }; }
        else if (argv[i] === "--out") { out = argv[++i]; if (!out || out.startsWith("-")) return { error: "--out requires a value" }; }
        else return { error: `Unknown option for registry publish: ${argv[i]}` };
      }
      if (!dir) return { error: "registry publish requires --packages <dir>" };
      if (!base) return { error: "registry publish requires --base-url <url>" };
      if (!key) return { error: "registry publish requires --key <pem-path>" };
      const r: RegistryArgs = { command: "registry", sub: "publish", pubPackagesDir: dir, pubBaseUrl: base, pubKeyPath: key };
      return out !== undefined ? { ...r, pubOut: out } : r;
    }
```

(c) Add imports: `import { buildIndexDoc, nextSequence } from "./registry-publish.ts";` and
extend the `./signing.ts` import to include `publicKeyInfoFromPrivatePem`. (`parseIndex` +
`verifyIndexSignature` are already imported; `readdirSync` may need adding to the `node:fs`
import.)

(d) In the `if (parsed.command === "registry")` handler, add a `publish` branch (before the
local-`add` logic):

```ts
    if (parsed.sub === "publish") {
      let pem: string;
      try { pem = readFileSync(parsed.pubKeyPath!, "utf8"); }
      catch (e) { console.error(`ace: publish: cannot read key ${parsed.pubKeyPath}: ${(e as Error).message}`); return 1; }
      let entries: string[];
      try { entries = readdirSync(parsed.pubPackagesDir!).filter((f) => f.endsWith(".json")); }
      catch (e) { console.error(`ace: publish: cannot read dir ${parsed.pubPackagesDir}: ${(e as Error).message}`); return 1; }
      const packages: AcePackage[] = [];
      for (const f of entries) {
        const full = join(parsed.pubPackagesDir!, f);
        let raw: string;
        try { raw = readFileSync(full, "utf8"); } catch { console.error(`ace: publish: skip unreadable ${f}`); continue; }
        let obj: unknown;
        try { obj = JSON.parse(raw); } catch { console.error(`ace: publish: skip non-JSON ${f}`); continue; }
        if (typeof obj !== "object" || obj === null || typeof (obj as AcePackage).manifest !== "object" || (obj as AcePackage).manifest === null
          || typeof (obj as AcePackage).manifest.name !== "string" || typeof (obj as AcePackage).manifest.version !== "string"
          || typeof (obj as AcePackage).files !== "object" || (obj as AcePackage).files === null) {
          console.error(`ace: publish: skip non-package ${f}`); continue;
        }
        packages.push(obj as AcePackage);
      }
      if (packages.length === 0) { console.error(`ace: publish refused: no valid packages in ${parsed.pubPackagesDir}`); return 1; }
      const outPath = parsed.pubOut ?? "index.json";
      let prev: import("./registry-remote.ts").IndexDoc | null = null;
      if (existsSync(outPath)) {
        try { const p = parseIndex(readFileSync(outPath, "utf8")); if (!("error" in p)) prev = p; } catch { /* no prev */ }
      }
      const seq = nextSequence(prev);
      if (prev && seq <= prev.sequence) { console.error(`ace: publish refused: sequence ${seq} <= prev ${prev.sequence}`); return 1; }
      const doc = buildIndexDoc({ packages, baseUrl: parsed.pubBaseUrl!, sequence: seq, issuedAt: new Date().toISOString(), privatePem: pem });
      if ("error" in doc) { console.error(`ace: publish refused: ${doc.error}`); return 1; }
      // Round-trip self-verify: never write an index the consumer would reject.
      const serialized = JSON.stringify(doc, null, 2);
      const reparsed = parseIndex(serialized);
      if ("error" in reparsed) { console.error(`ace: publish refused: self-verify parse failed: ${reparsed.error}`); return 1; }
      const info = publicKeyInfoFromPrivatePem(pem);
      const { signature, ...content } = doc;
      const sv = verifyIndexSignature(content, signature, new Map([[info.keyId, { public_key: info.public_key }]]));
      if (!sv.ok) { console.error(`ace: publish refused: self-verify signature failed: ${sv.reason}`); return 1; }
      try { writeFileSync(outPath, serialized); }
      catch (e) { console.error(`ace: publish failed: cannot write ${outPath}: ${(e as Error).message}`); return 1; }
      console.log(`ace: published ${packages.length} package(s) at sequence ${seq} → ${outPath}`);
      return 0;
    }
```
> **Implementer note:** match the file's actual import style. `AcePackage` is already
> imported in ace.ts (used by install/update). If `readdirSync`/`existsSync` aren't imported,
> add them to the `node:fs` import. The `import("./registry-remote.ts").IndexDoc` inline type
> can instead be a top `import type { IndexDoc } from "./registry-remote.ts";` if cleaner.

(e) Usage text: add `ace registry publish --packages <dir> --base-url <url> --key <pem> [--out <path>]`.

- [ ] **Step 4: Run → `bun test tools/ace/` all green; `tsc` exit 0.** False-green: corrupt
  the signing key passed to publish (write a non-PEM) → the publish test fails (key read /
  self-verify) → restore.

- [ ] **Step 5: Commit** (canary 67)

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "feat(ace): registry publish CLI + handler with round-trip self-verify (slice 6.1 task 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: SKILL.md — document `ace registry publish`

**Files:** Modify `.claude/skills/ace/SKILL.md`.

- [ ] **Step 1: Implement** (patch-script append a "Publishing a registry (slice 6.1)" section)

Document: `ace registry publish --packages <dir> --base-url <url> --key <pem-path>
[--out index.json]`; that it scans the dir for package `*.json` (non-packages skipped),
derives each `url` as `<base-url>/<name>-<version>.json` + the `package_hash`, signs the
index with the ed25519 private key, auto-bumps `sequence` from the existing `--out` (refusing
a non-increasing sequence), and **round-trip self-verifies** the produced index through the
consumer's own parse + signature check before writing (so a published index always satisfies
`ace install` against `ace registry remote add <url> --key <keyId>`). Note the deferred
items (per-package url, ETag sidecar, multi-dir, incremental/multi-signer).

- [ ] **Step 2: Verify** → `bunx markdownlint-cli2 ".claude/skills/ace/SKILL.md"` exit 0.
- [ ] **Step 3: Commit** (canary 67)

```bash
git add .claude/skills/ace/SKILL.md
git commit -m "docs(ace): document ace registry publish (slice 6.1 task 4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## After all tasks

- [ ] Whole suite: `bun test tools/ace/` → all pass.
- [ ] Strict: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] Canary: `git ls-tree HEAD | wc -l` → 67; no stray `tools/ace/_patch_*.ts`.
- [ ] Final holistic code-review subagent over `git diff origin/main..HEAD -- tools/ace/ .claude/skills/ace/SKILL.md`.
- [ ] Open the impl PR; arm auto-merge; run the PR-gate loop.
- [ ] Post-merge: annotate 081KT07NV0008QG0R0016FVWD7 (mark `ace registry publish` core shipped; per-package url
  + ETag sidecar + multi-dir + incremental/multi-signer stay deferred).
