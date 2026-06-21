# Ace CLI slice 5.3 — lockfile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the solved+pinned dependency graph to `./ace.lock` on a normal `ace install`, and add `ace install --frozen` to replay that lock (skip solving, install exactly the locked graph from the locked urls/hashes, registry untouched).

**Architecture:** A new pure `tools/ace/lockfile.ts` module (types + build/serialize/parse/drift-gate). `resolve.ts` exports its existing `canonicalJson`. `ace.ts` gains `--frozen`/`--lockfile` flags, writes the lock on the default path, and takes a frozen replay path that reuses the exported verify primitives. The slice-5.1/5.2 solve+resolve+verify pipeline is reused, not rewritten.

**Tech Stack:** TypeScript on Bun. Tests `bun test tools/ace/`. Strict gate `bun --bun tsc --noEmit -p tsconfig.json`.

**Spec:** `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.3-lockfile-design.md`

**Harness notes (every task):**

- The Otto-343 hook blocks the `Edit` tool even after `Read`/`Write`. For **new files** use `Write` (full file). For **edits to existing files** write a throwaway `tools/ace/_patch_<x>.ts` that does `readFileSync` → `String.split(find).join(repl)` (assert exactly 1 occurrence) → `writeFileSync`, run it with `bun run`, then `rm` it. Never leave the patch script committed.
- Commit canary: `git ls-tree HEAD | wc -l` MUST stay **67** (top-level tree count; `tools/`-only changes never change it). Verify after each commit.
- Commit trailer (last line of every commit message): `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch is already `otto-windows/ace-slice5.3-impl-2026-06-01` off `origin/main`. Do NOT switch branches.

**Existing-code facts (verified against `origin/main` this session — rely on these, but read the file before editing):**

- `tools/ace/resolve.ts`: `export function packageHash(pkg: AcePackage): string`; `export type ResolveResult = { ok: true; order: AcePackage[] } | { ok: false; reason: ResolveReason; detail: string; path: string[] }`. In `resolve()`, `order` is deps-first and the **root is pushed LAST** (`order.push(root)`). `canonicalJson` is a **private** `function canonicalJson(value: unknown): string` near the top (recursively sorts object keys, preserves array order).
- `tools/ace/store.ts`: `export interface AcePackage { manifest: AceManifest; files: Record<string,string> }`; `export interface AceManifest { format_version: number; name: string; version: string; content_hash: string; dependencies?: AceDependency[]; signature?: ... }`; `export type AceDependency = { kind:"inline"; name; version; url; package_hash } | { kind:"registry"; name; version }` (kind may be absent == inline back-compat); `export function contentHash(bytes: Uint8Array): string`; `export function validatePackagePaths(pkg): string | null`; `export function installPackage(storePath, pkg): { ok:true; dir } | { ok:false; error }`; `export type RegistryEntry = { readonly url: string; readonly package_hash: string }`; `export type Registry = Map<string, Map<string, RegistryEntry>>`; `export function loadRegistry(...): Registry`; `export function loadTrustStore(...): Map<string, LoadedTrustEntry>`; `export function defaultStorePath(): string`.
- `tools/ace/signing.ts`: `export function verifySignature(manifest, trustStore): { ok:true; key_id; label? } | { ok:false; reason: "no-signature"|"bad-signature"|"untrusted-key"|"unsupported-algo" }`.
- `tools/ace/ace.ts` install handler (graph path) does, in order: read root (url-or-path) → `verifySignature` gate (no-signature overridable by `--allow-no-signature`; bad/untrusted/unsupported always refused) → root `content_hash` check → `solve()` → `--print-resolution` → `resolve()` → preflight loop over `res.order` (per node: `content_hash`, `validatePackagePaths`, store-collision) → install loop. `InstallArgs` carries `command:"install"; source; storePath; allowNoSignature; printResolution?`.

---

## Tasks

### Task 1: `lockfile.ts` — types + `buildLockfile`

**Files:**

- Create: `tools/ace/lockfile.ts`
- Test: `tools/ace/lockfile.test.ts`

- [ ] **Step 1: Write the failing test** (`tools/ace/lockfile.test.ts`)

```ts
import { describe, expect, test } from "bun:test";
import { buildLockfile } from "./lockfile.ts";
import { packageHash } from "./resolve.ts";
import { contentHash } from "./store.ts";
import type { AcePackage, AceDependency, RegistryEntry, Registry } from "./store.ts";

function pkgAt(name: string, version: string, deps: AceDependency[] = []): AcePackage {
  const files = { "f.txt": `${name}@${version}` };
  return { manifest: { format_version: 1, name, version, content_hash: contentHash(new TextEncoder().encode(JSON.stringify(files))), dependencies: deps }, files };
}
const regEdge = (name: string, range: string): AceDependency => ({ kind: "registry", name, version: range });
const inlineEdge = (pkg: AcePackage, url: string): AceDependency => ({ kind: "inline", name: pkg.manifest.name, version: pkg.manifest.version, url, package_hash: packageHash(pkg) });
function reg(entries: { name: string; version: string; url: string; pkg: AcePackage }[]): Registry {
  const r: Registry = new Map();
  for (const e of entries) {
    if (!r.has(e.name)) r.set(e.name, new Map<string, RegistryEntry>());
    r.get(e.name)!.set(e.version, { url: e.url, package_hash: packageHash(e.pkg) });
  }
  return r;
}

describe("buildLockfile", () => {
  test("records registry node url from the registry + excludes root", () => {
    const A = pkgAt("A", "1.2.0");
    const root = pkgAt("root", "1.0.0", [regEdge("A", "^1.0.0")]);
    const registry = reg([{ name: "A", version: "1.2.0", url: "u/A/1.2.0", pkg: A }]);
    const order: AcePackage[] = [A, root]; // resolve order: deps-first, root last
    const lf = buildLockfile(root, order, registry);
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.format_version).toBe(1);
      expect(lf.root).toEqual({ name: "root", version: "1.0.0", package_hash: packageHash(root) });
      expect(lf.nodes).toEqual([{ name: "A", version: "1.2.0", url: "u/A/1.2.0", package_hash: packageHash(A) }]);
    }
  });
  test("records inline node url from the inline edge (inline precedence)", () => {
    const B = pkgAt("B", "2.0.0");
    const root = pkgAt("root", "1.0.0", [inlineEdge(B, "http://e/B")]);
    const order: AcePackage[] = [B, root];
    const lf = buildLockfile(root, order, new Map());
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.nodes).toEqual([{ name: "B", version: "2.0.0", url: "http://e/B", package_hash: packageHash(B) }]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/ace/lockfile.test.ts`
Expected: FAIL — `Cannot find module './lockfile.ts'`.

- [ ] **Step 3: Write minimal implementation** (`tools/ace/lockfile.ts`)

```ts
import { packageHash } from "./resolve.ts";
import type { AcePackage, Registry } from "./store.ts";

export type LockNode = { name: string; version: string; url: string; package_hash: string };
export type Lockfile = {
  format_version: 1;
  root: { name: string; version: string; package_hash: string };
  nodes: LockNode[];
};

/** Build the lockfile from a successful resolve. `order` is resolve()'s output (deps-first,
 *  root LAST); root is excluded from `nodes`. Each node's url is taken inline-edge-first
 *  (inline pins are authoritative — the solver never registry-solves an inline-fixed name),
 *  then registry. package_hash is the hash of the actually-installed package. */
export function buildLockfile(root: AcePackage, order: AcePackage[], registry: Registry): Lockfile | { error: string } {
  // Prescan every inline edge in the graph → name@version -> url.
  const inlineUrls = new Map<string, string>();
  for (const p of order) {
    for (const edge of (p.manifest.dependencies ?? [])) {
      if (edge.kind === "inline" && typeof edge.url === "string") {
        inlineUrls.set(`${edge.name}@${edge.version}`, edge.url);
      }
    }
  }
  const deps = order.filter((p) => p !== root); // root is the input, not a locked dependency
  const nodes: LockNode[] = [];
  for (const dep of deps) {
    const name = dep.manifest.name;
    const version = dep.manifest.version;
    const url = inlineUrls.get(`${name}@${version}`) ?? registry.get(name)?.get(version)?.url;
    if (url === undefined) return { error: `cannot resolve url for ${name}@${version}` };
    nodes.push({ name, version, url, package_hash: packageHash(dep) });
  }
  return {
    format_version: 1,
    root: { name: root.manifest.name, version: root.manifest.version, package_hash: packageHash(root) },
    nodes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/ace/lockfile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/lockfile.ts tools/ace/lockfile.test.ts
git commit -m "$(printf 'feat(ace): lockfile.ts buildLockfile (slice 5.3 task 1)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # must print 67
```

---

### Task 2: export `canonicalJson` + `serializeLockfile` / `parseLockfile`

**Files:**

- Modify: `tools/ace/resolve.ts` (make `canonicalJson` exported)
- Modify: `tools/ace/lockfile.ts` (add serialize/parse)
- Test: `tools/ace/lockfile.test.ts` (add round-trip + shape-guard tests)

- [ ] **Step 1: Write the failing tests** (append to `tools/ace/lockfile.test.ts`)

```ts
import { serializeLockfile, parseLockfile, type Lockfile } from "./lockfile.ts";

describe("serializeLockfile / parseLockfile", () => {
  const lf: Lockfile = {
    format_version: 1,
    root: { name: "root", version: "1.0.0", package_hash: "sha256:r" },
    nodes: [{ name: "A", version: "1.2.0", url: "u/A", package_hash: "sha256:a" }],
  };
  test("round-trips", () => {
    const parsed = parseLockfile(serializeLockfile(lf));
    expect(parsed).toEqual(lf);
  });
  test("serialization is canonical (object keys sorted) + ends in newline", () => {
    const s = serializeLockfile(lf);
    expect(s.endsWith("\n")).toBe(true);
    // canonical: every object's keys are emitted in sorted order
    expect(s).toContain('"format_version":1');
    expect(s.indexOf('"name"')).toBeLessThan(s.indexOf('"package_hash"')); // n < p within root
  });
  test("parse rejects malformed input with {error} (no throw)", () => {
    expect("error" in parseLockfile("not json {")).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({ ...lf, format_version: 2 }))).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({ ...lf, nodes: "x" }))).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({ ...lf, nodes: [{ name: 1, version: "1", url: "u", package_hash: "h" }] }))).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({ ...lf, root: { name: "r" } }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/ace/lockfile.test.ts`
Expected: FAIL — `serializeLockfile`/`parseLockfile` not exported.

- [ ] **Step 3a: Export `canonicalJson` from `resolve.ts`** (patch-script — change the one declaration)

Find: `function canonicalJson(value: unknown): string {`
Replace: `export function canonicalJson(value: unknown): string {`

(Patch-script asserts exactly 1 occurrence; no call-site changes — the in-file callers still resolve.)

- [ ] **Step 3b: Add serialize/parse to `lockfile.ts`** (append; also add the `canonicalJson` import to the existing import block)

Add to the top import from `./resolve.ts` so it reads:
`import { canonicalJson, packageHash } from "./resolve.ts";`

Append:

```ts
export function serializeLockfile(lf: Lockfile): string {
  return canonicalJson(lf) + "\n";
}

/** Parse + shape-guard an untrusted lockfile string. Never throws — malformed input → {error}. */
export function parseLockfile(json: string): Lockfile | { error: string } {
  let v: unknown;
  try { v = JSON.parse(json); } catch (e) { return { error: `not valid JSON: ${(e as Error).message}` }; }
  if (typeof v !== "object" || v === null) return { error: "lockfile is not an object" };
  const o = v as Record<string, unknown>;
  if (o.format_version !== 1) return { error: `unsupported format_version: ${JSON.stringify(o.format_version)}` };
  const root = o.root as Record<string, unknown> | null | undefined;
  if (typeof root !== "object" || root === null
      || typeof root.name !== "string" || typeof root.version !== "string" || typeof root.package_hash !== "string") {
    return { error: "malformed lockfile root" };
  }
  if (!Array.isArray(o.nodes)) return { error: "lockfile nodes is not an array" };
  const nodes: LockNode[] = [];
  for (const n of o.nodes) {
    const e = n as Record<string, unknown> | null;
    if (typeof e !== "object" || e === null
        || typeof e.name !== "string" || typeof e.version !== "string"
        || typeof e.url !== "string" || typeof e.package_hash !== "string") {
      return { error: "malformed lockfile node" };
    }
    nodes.push({ name: e.name, version: e.version, url: e.url, package_hash: e.package_hash });
  }
  return { format_version: 1, root: { name: root.name, version: root.version, package_hash: root.package_hash }, nodes };
}
```

- [ ] **Step 4: Run tests + strict tsc + full ace suite**

Run: `bun test tools/ace/lockfile.test.ts` → PASS.
Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0 (canonicalJson export is additive; no call-site breakage).
Run: `bun test tools/ace/` → all PASS (resolve.ts export doesn't change resolve behavior).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.ts tools/ace/lockfile.ts tools/ace/lockfile.test.ts
git commit -m "$(printf 'feat(ace): lockfile serialize/parse + export canonicalJson (slice 5.3 task 2)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 3: `verifyRootMatchesLock`

**Files:**

- Modify: `tools/ace/lockfile.ts`
- Test: `tools/ace/lockfile.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { verifyRootMatchesLock } from "./lockfile.ts";

describe("verifyRootMatchesLock", () => {
  test("true when root packageHash matches, false on any root change", () => {
    const root = pkgAt("root", "1.0.0", [regEdge("A", "^1.0.0")]);
    const lf = { format_version: 1 as const, root: { name: "root", version: "1.0.0", package_hash: packageHash(root) }, nodes: [] };
    expect(verifyRootMatchesLock(root, lf)).toBe(true);
    const changed = pkgAt("root", "1.0.0", [regEdge("A", "^2.0.0")]); // changed range → different packageHash
    expect(verifyRootMatchesLock(changed, lf)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/ace/lockfile.test.ts`
Expected: FAIL — `verifyRootMatchesLock` not exported.

- [ ] **Step 3: Implement** (append to `tools/ace/lockfile.ts`)

```ts
/** Drift gate for --frozen: the provided root must be byte-identical to the locked root. */
export function verifyRootMatchesLock(root: AcePackage, lf: Lockfile): boolean {
  return packageHash(root) === lf.root.package_hash;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/ace/lockfile.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/lockfile.ts tools/ace/lockfile.test.ts
git commit -m "$(printf 'feat(ace): lockfile verifyRootMatchesLock drift gate (slice 5.3 task 3)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 4: `--frozen` + `--lockfile` flag parsing

**Files:**

- Modify: `tools/ace/ace.ts` (read it first — locate `interface InstallArgs` and the `if (command === "install")` arg loop)
- Test: `tools/ace/ace.test.ts` (locate the existing `parseArgs` describe block)

- [ ] **Step 1: Write the failing tests** (append to the parseArgs tests in `tools/ace/ace.test.ts`)

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — `frozen`/`lockfile` not on InstallArgs / not parsed.

- [ ] **Step 3a: Extend `InstallArgs`** (patch-script on `tools/ace/ace.ts`)

Find the InstallArgs interface (read the file; it currently ends with `readonly printResolution?: boolean;` or similar before the closing `}`). Add two fields:

```ts
  readonly frozen: boolean;
  readonly lockfile: string;
```

- [ ] **Step 3b: Parse the flags** (patch-script) — in the `if (command === "install")` block, add a `frozen`/`lockfile` local initialized before the arg loop and two cases inside it, then thread them into the returned `InstallArgs`.

Add before the install arg loop (next to the existing `allowNoSignature` local):

```ts
    let frozen = false;
    let lockfilePath = "ace.lock";
```

Add inside the install arg `for` loop (alongside the existing `--store` / `--allow-no-signature` cases):

```ts
      } else if (argv[i] === "--frozen") {
        frozen = true;
      } else if (argv[i] === "--lockfile") {
        const next = argv[++i];
        if (!next || next.startsWith("-")) return { error: "--lockfile requires a path argument" };
        lockfilePath = next;
```

Thread into the returned object — change the `InstallArgs` return to include `frozen, lockfile: lockfilePath` (read the exact return expression first; it builds `{ command: "install", source, storePath, allowNoSignature, ... }`).

- [ ] **Step 4: Run tests + strict tsc**

Run: `bun test tools/ace/ace.test.ts` → PASS.
Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "$(printf 'feat(ace): --frozen + --lockfile install flags (slice 5.3 task 4)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 5: default-path lock write

**Files:**

- Modify: `tools/ace/ace.ts` (the graph-install path, after the install loop succeeds)
- Test: `tools/ace/ace.test.ts` (add an install-writes-lock integration test)

- [ ] **Step 1: Write the failing test** (`tools/ace/ace.test.ts`)

Follow the existing ace.test.ts integration idiom (it builds packages, writes them to temp files, and calls the install entrypoint with a temp `--store` and `--lockfile` in a temp dir). Read the existing install integration tests first to match how the entrypoint is invoked (the run function + temp-dir setup). The assertion:

```ts
// after a successful graph install with --lockfile <tmp>/ace.lock:
//   the lockfile exists, parses, root matches, and nodes pin the installed deps.
const lf = parseLockfile(readFileSync(lockPath, "utf8"));
expect("error" in lf).toBe(false);
if (!("error" in lf)) {
  expect(lf.root.name).toBe("root");
  expect(lf.nodes.map((n) => `${n.name}@${n.version}`).sort()).toEqual(["A@1.0.0"]);
  expect(lf.nodes[0]!.package_hash).toBe(packageHash(A));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — no lockfile written.

- [ ] **Step 3: Implement** (patch-script) — after the graph-install loop completes successfully (locate the success point after the `for (const node of res.order)` install loop, before the handler returns 0), insert:

```ts
      // SLICE 5.3: write the lockfile (write failure is a warning, not a failed install).
      const lf = buildLockfile(pkg, res.order, registry);
      if ("error" in lf) {
        console.error(`ace: WARNING: could not build lockfile: ${lf.error}`);
      } else {
        try { writeFileSync(parsed.lockfile, serializeLockfile(lf)); }
        catch (e) { console.error(`ace: WARNING: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`); }
      }
```

Add the imports at the top of `ace.ts`: `import { buildLockfile, serializeLockfile, parseLockfile, verifyRootMatchesLock } from "./lockfile.ts";` (`parseLockfile`/`verifyRootMatchesLock` are used in Task 6; importing now is fine — tsc tolerates them until used, but to avoid an unused-import lint add them in Task 6 instead if the repo's tsc flags unused imports. Safer: import only `buildLockfile, serializeLockfile` here; add `parseLockfile, verifyRootMatchesLock` in Task 6.) `writeFileSync` is already imported in ace.ts.

- [ ] **Step 4: Run tests + strict tsc + full suite**

Run: `bun test tools/ace/ace.test.ts` → PASS.
Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.
Run: `bun test tools/ace/` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "$(printf 'feat(ace): write ./ace.lock on graph install (slice 5.3 task 5)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 6: `--frozen` replay path

**Files:**

- Modify: `tools/ace/ace.ts` (branch the graph-install path on `parsed.frozen`)
- Test: `tools/ace/ace.test.ts` (frozen integration tests)

- [ ] **Step 1: Write the failing tests** (`tools/ace/ace.test.ts`)

Using the same integration idiom (temp store + temp lockfile + a `fetchPackage` over temp files / a stubbed fetch — match how the existing tests inject fetch; if the entrypoint fetches real urls, the tests use `file://`-style local paths via the existing helper). Cover:

```ts
// 1. --frozen installs from the lock with an EMPTY registry (registry-independence):
//    write a valid lock for {root -> A}, then run install --frozen with loadRegistry stubbed
//    empty (or a registry the test controls as empty). Expect exit 0 + A installed.
// 2. --frozen with a drifted root (root's deps changed vs the lock) → exit non-zero, refused.
// 3. --frozen with NO lockfile at the path → exit non-zero, refused.
// 4. --frozen with a tampered locked node (lock's package_hash != the bytes at url) → refused.
```

Match the existing test's process-exit / return-code capture (the handler returns a number; tests assert the returned code). Read an existing install integration test to copy the harness exactly.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — `--frozen` not handled (falls through to solve).

- [ ] **Step 3: Implement** (patch-script) — at the top of the graph-install branch (right after the `if (pkg.manifest.dependencies && pkg.manifest.dependencies.length > 0) {` and the root content_hash check, BEFORE `loadRegistry()`/`solve()`), insert the frozen branch. Also add the Task-6 imports (`parseLockfile, verifyRootMatchesLock`) to the lockfile import line.

```ts
      if (parsed.frozen) {
        // SLICE 5.3 frozen replay: install exactly the locked graph; never solve, never touch the registry.
        let lockRaw: string;
        try { lockRaw = readFileSync(parsed.lockfile, "utf8"); }
        catch { console.error(`ace: install refused: no lockfile at ${parsed.lockfile} — run install without --frozen first`); return 1; }
        const lf = parseLockfile(lockRaw);
        if ("error" in lf) { console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${lf.error}`); return 1; }
        if (!verifyRootMatchesLock(pkg, lf)) {
          console.error(`ace: install refused: lockfile out of date for ${pkg.manifest.name} — re-run without --frozen to regenerate`);
          return 1;
        }
        const trust = loadTrustStore();
        // Replay each locked node: fetch → parse → verify pin + content_hash + signature + path-safety → install.
        for (const node of lf.nodes) {
          let raw: string;
          try { raw = (node.url.startsWith("http://") || node.url.startsWith("https://")) ? await (await fetch(node.url)).text() : readFileSync(node.url, "utf8"); }
          catch (e) { console.error(`ace: install refused: fetch failed for ${node.name}@${node.version} (${node.url}): ${(e as Error).message}`); return 1; }
          let np: AcePackage;
          try { np = JSON.parse(raw) as AcePackage; } catch { console.error(`ace: install refused: ${node.name}@${node.version} is not valid JSON`); return 1; }
          if (packageHash(np) !== node.package_hash) { console.error(`ace: install refused: package_hash mismatch for ${node.name}@${node.version} (lock pin violated)`); return 1; }
          const fh = contentHash(new TextEncoder().encode(JSON.stringify(np.files)));
          if (fh !== np.manifest.content_hash) { console.error(`ace: install refused: bad-content-hash in ${node.name}@${node.version}`); return 1; }
          const unsafe = validatePackagePaths(np);
          if (unsafe !== null) { console.error(`ace: install refused: unsafe file path in ${node.name}@${node.version}: ${unsafe}`); return 1; }
          const nv = verifySignature(np.manifest, trust);
          if (!nv.ok && nv.reason !== "no-signature") { console.error(`ace: install refused: ${nv.reason} for ${node.name}@${node.version}`); return 1; }
          if (!nv.ok && nv.reason === "no-signature" && !parsed.allowNoSignature) { console.error(`ace: install refused: unsigned ${node.name}@${node.version} (use --allow-no-signature)`); return 1; }
          const ir = installPackage(parsed.storePath, np);
          if (!ir.ok) { console.error(`ace: install refused: ${node.name}@${node.version}: ${ir.error}`); return 1; }
        }
        // Install the root last (already signature+content_hash verified above).
        const rootIr = installPackage(parsed.storePath, pkg);
        if (!rootIr.ok) { console.error(`ace: install refused: ${pkg.manifest.name} (root): ${rootIr.error}`); return 1; }
        console.error(`ace: installed ${lf.nodes.length + 1} from lockfile ${parsed.lockfile} (frozen)`);
        return 0;
      }
```

Notes for the implementer:

- `installPackage`, `validatePackagePaths`, `contentHash` import from `./store.ts`; `verifySignature` from `./signing.ts`; `packageHash` from `./resolve.ts` — confirm each is already imported in ace.ts; add any missing.
- The root signature gate + root content_hash check already ran earlier in the handler (shared with the default path) — do not duplicate them.
- Frozen path must NOT call `loadRegistry()` or `solve()` and must NOT write the lock.

- [ ] **Step 4: Run tests + strict tsc + full suite**

Run: `bun test tools/ace/ace.test.ts` → PASS (4 frozen tests).
Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.
Run: `bun test tools/ace/` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "$(printf 'feat(ace): --frozen lockfile replay install (slice 5.3 task 6)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 7: usage text + SKILL.md docs

**Files:**

- Modify: `tools/ace/ace.ts` (the usage/help string — add `--frozen` / `--lockfile`)
- Modify: `.claude/skills/ace/SKILL.md`

- [ ] **Step 1: Update usage text** (patch-script) — in the install usage line, append the new flags + a one-line lockfile description, matching the existing usage style. E.g. extend the `ace install <url-or-path> [--allow-no-signature] [--print-resolution]` line to also list `[--frozen] [--lockfile <path>]` and add a short note: "writes ./ace.lock on install; --frozen installs exactly the locked graph (registry-independent)".

- [ ] **Step 2: Update SKILL.md** (patch-script or Write) — add a short "Lockfile (slice 5.3)" subsection documenting: normal install writes `./ace.lock`; `--frozen` replays it (skip solve, registry-independent, byte-verified); `--lockfile <path>` override; the drift gate ("re-run without --frozen to regenerate"). Keep it terse + consistent with the existing SKILL.md voice.

- [ ] **Step 3: Lint the docs**

Run: `bunx markdownlint-cli2 ".claude/skills/ace/SKILL.md"` → clean.

- [ ] **Step 4: Verify whole suite + tsc once more**

Run: `bun test tools/ace/` → all PASS.
Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts .claude/skills/ace/SKILL.md
git commit -m "$(printf 'docs(ace): document --frozen/--lockfile + lockfile (slice 5.3 task 7)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

## Final verification (after all tasks)

```bash
bun test tools/ace/                              # all green
bun --bun tsc --noEmit -p tsconfig.json          # exit 0
bunx markdownlint-cli2 ".claude/skills/ace/SKILL.md"
git ls-tree HEAD | wc -l                         # 67
```

Then open the PR against `main`, arm auto-merge, run the PR-gate loop (handle Copilot/Codex threads, keep canary 67), land on green.

## Self-review (plan vs spec)

- **Spec §Components `lockfile.ts`** (buildLockfile / serialize / parse / verifyRootMatchesLock) → Tasks 1–3. ✓
- **Spec §Components `resolve.ts` export canonicalJson** → Task 2 Step 3a. ✓
- **Spec §Components `ace.ts` flags + default write + frozen replay** → Tasks 4–6. ✓
- **Spec §Testing** (lockfile unit; frozen integration incl. empty-registry / drift / no-lock / tamper) → Task 1–3 unit + Task 6 integration (4 cases) + Task 5 write test. ✓
- **Spec §Error handling table** (lock-write warning; frozen missing/parse/drift/dead-url/tamper/bad-sig all hard-refuse) → Task 5 (warning) + Task 6 (all refusals). ✓
- **Spec leaf-install unchanged / no lock** → the graph-install branch is `dependencies.length > 0`; the leaf path is untouched, so no lock is written for leaves and `--frozen` on a leaf falls through to the normal leaf install (no-op flag). ✓ (Optional: a Task-6 note can assert leaf `--frozen` still installs.)
- **Spec §Files touched** → all covered (lockfile.ts, lockfile.test.ts, resolve.ts, ace.ts, ace.test.ts, SKILL.md). Deferred backlog rows already filed (081KT07NV0008QG0R002GV3MXW/0974/0975 in the spec PR). ✓
- **Type consistency:** `Lockfile` / `LockNode` / `buildLockfile(root, order, registry)` / `serializeLockfile` / `parseLockfile` / `verifyRootMatchesLock` names + signatures consistent across Tasks 1–6. ✓
