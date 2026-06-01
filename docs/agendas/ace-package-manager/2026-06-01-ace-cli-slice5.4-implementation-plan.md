# Ace CLI slice 5.4 — lockfile ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ace update` (re-solve + rewrite the lock), `ace install --locked` (assert the committed lock is up to date, else refuse), and leaf-install lockfiles — all additive, with the lock format (`format_version: 1`) unchanged.

**Architecture:** Two small pure helpers in `tools/ace/lockfile.ts` (`lockfilesEqual`, `buildLeafLockfile`); a new `update` command + a `--locked` install flag + leaf-path lock handling in `tools/ace/ace.ts`; the existing graph integrity preflight is extracted into a shared `preflightGraph` helper reused by install AND update. No solver changes; no lock-format changes.

**Tech Stack:** TypeScript on Bun. Tests `bun test tools/ace/`. Strict gate `bun --bun tsc --noEmit -p tsconfig.json`. Docs gate `bunx markdownlint-cli2`.

**Spec:** `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.4-lockfile-ergonomics-design.md` (the `ace update` preflight-before-write correction is landing via PR #6414 and is reflected below).

**Harness notes (every task):**

- The Otto-343 hook blocks the `Edit` tool even after `Read`/`Write`. NEW files → `Write`. EDITS to existing files → a throwaway `tools/ace/_patch_<x>.ts` doing `readFileSync` → `String.split(find).join(repl)` (assert exactly 1 occurrence) → `writeFileSync`, run `bun run`, then `rm`. Never commit a patch script.
- Commit canary: `git ls-tree HEAD | wc -l` MUST stay **67** after every commit. If not, STOP (tree corruption).
- Commit trailer (last line of every message): `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch is already `otto-windows/ace-slice5.4-impl-2026-06-01` off `origin/main`. Do NOT switch branches.

**Existing-code facts (verified against `origin/main` — read the file before editing):**

- `tools/ace/resolve.ts`: `export function packageHash(pkg: AcePackage): string`; `resolve(root, fetchPackage, trustStore, registry, solved, opts) → { ok: true; order: AcePackage[] } | { ok: false; ... }`; `order` is deps-first, **root LAST**; `export function canonicalJson`.
- `tools/ace/lockfile.ts` exports: `type LockNode`, `type Lockfile` (`{format_version:1; root:{name;version;package_hash}; nodes: LockNode[]}`), `buildLockfile(root, order, registry)`, `serializeLockfile(lf)`, `parseLockfile(json) → Lockfile | {error}`, `verifyRootMatchesLock(root, lf) → boolean`.
- `tools/ace/store.ts`: `contentHash`, `validatePackagePaths`, `installPackage`, `loadRegistry`, `loadTrustStore`, `defaultStorePath`, `type Registry`, `type AcePackage`, `type AceManifest`.
- `tools/ace/signing.ts`: `verifySignature(manifest, trustStore)`.
- `tools/ace/ace.ts`: `InstallArgs` already has `frozen: boolean; lockfile: string`. `parseArgs` install loop (~line 183) parses `--frozen`/`--lockfile`/`--allow-no-signature`/`--store`/`--print-resolution`, returns `InstallArgs` (~line 211). `ParsedArgs` union (~line 85). The install handler (~line 462) graph path: signature gate → root content_hash → `solve` → `--print-resolution` → `resolve` → **PREFLIGHT loop** over `res.order` (per node: content_hash, `validatePackagePaths`, `byStoreKey` content_hash→package_hash collision) → **EXTRACT loop** (`installPackage`) → `buildLockfile`+write. `--frozen` branch is at the top of the graph path. The leaf (no-deps) path falls through to the single-package install below (~line 617). Usage text ~line 258.

---

## Tasks

### Task 1: `lockfile.ts` — `lockfilesEqual` + `buildLeafLockfile`

**Files:**

- Modify: `tools/ace/lockfile.ts`
- Test: `tools/ace/lockfile.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `tools/ace/lockfile.test.ts`)

```ts
import { lockfilesEqual, buildLeafLockfile, type Lockfile } from "./lockfile.ts";

describe("lockfilesEqual", () => {
  const base: Lockfile = {
    format_version: 1,
    root: { name: "root", version: "1.0.0", package_hash: "sha256:r" },
    nodes: [{ name: "A", version: "1.2.0", url: "u/A", package_hash: "sha256:a" }],
  };
  test("true for identical (incl. key-order-insensitive via canonical)", () => {
    const clone: Lockfile = JSON.parse(JSON.stringify(base));
    expect(lockfilesEqual(base, clone)).toBe(true);
  });
  test("false when a node version differs", () => {
    const diff: Lockfile = { ...base, nodes: [{ ...base.nodes[0]!, version: "1.3.0" }] };
    expect(lockfilesEqual(base, diff)).toBe(false);
  });
  test("false when root differs", () => {
    const diff: Lockfile = { ...base, root: { ...base.root, package_hash: "sha256:other" } };
    expect(lockfilesEqual(base, diff)).toBe(false);
  });
});

describe("buildLeafLockfile", () => {
  test("produces {format_version:1, root, nodes:[]} with the root package_hash", () => {
    const files = { "f.txt": "leaf@1.0.0" };
    const root = { manifest: { format_version: 1, name: "leaf", version: "1.0.0", content_hash: contentHash(new TextEncoder().encode(JSON.stringify(files))) }, files };
    const lf = buildLeafLockfile(root);
    expect(lf.format_version).toBe(1);
    expect(lf.nodes).toEqual([]);
    expect(lf.root).toEqual({ name: "leaf", version: "1.0.0", package_hash: packageHash(root) });
  });
});
```

(`contentHash`/`packageHash` are already imported at the top of `lockfile.test.ts` from prior tasks — if not, add `import { contentHash } from "./store.ts"` and `import { packageHash } from "./resolve.ts"`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/ace/lockfile.test.ts`
Expected: FAIL — `lockfilesEqual` / `buildLeafLockfile` not exported.

- [ ] **Step 3: Implement** (append to `tools/ace/lockfile.ts`)

```ts
/** True iff two lockfiles serialize identically (canonical JSON — key-order-insensitive). */
export function lockfilesEqual(a: Lockfile, b: Lockfile): boolean {
  return serializeLockfile(a) === serializeLockfile(b);
}

/** Lockfile for a no-dependency (leaf) root: the root identity + empty nodes. */
export function buildLeafLockfile(root: AcePackage): Lockfile {
  return {
    format_version: 1,
    root: { name: root.manifest.name, version: root.manifest.version, package_hash: packageHash(root) },
    nodes: [],
  };
}
```

- [ ] **Step 4: Run tests + strict tsc**

Run: `bun test tools/ace/lockfile.test.ts` → PASS. Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/lockfile.ts tools/ace/lockfile.test.ts
git commit -m "$(printf 'feat(ace): lockfilesEqual + buildLeafLockfile (slice 5.4 task 1)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 2: extract `preflightGraph` helper (shared by install + update)

**Files:**

- Modify: `tools/ace/ace.ts` (extract the existing preflight loop into a function; route the install graph path through it)

- [ ] **Step 1: Read** the install graph path's preflight loop in `tools/ace/ace.ts` (the `const byStoreKey = new Map...` block over `res.order`, before the extract loop).

- [ ] **Step 2: Implement** (patch-script) — add a module-level helper near the other top-level helpers in `ace.ts` (after imports / before `parseArgs`, wherever module-scope functions live):

```ts
/** Integrity preflight over a resolved graph: per-node content_hash, path-safety, and
 *  store-key (content_hash → package_hash) collision. Returns null on success, or an
 *  error message. Shared by `install` (before extract) and `update` (before lock write). */
function preflightGraph(order: AcePackage[]): string | null {
  const byStoreKey = new Map<string, string>(); // content_hash -> package_hash
  for (const node of order) {
    const fh = contentHash(new TextEncoder().encode(JSON.stringify(node.files)));
    if (fh !== node.manifest.content_hash) return `bad-content-hash in ${node.manifest.name}`;
    const unsafe = validatePackagePaths(node);
    if (unsafe !== null) return `unsafe file path in ${node.manifest.name}: ${unsafe}`;
    const ph = packageHash(node);
    const prior = byStoreKey.get(node.manifest.content_hash);
    if (prior !== undefined && prior !== ph) return `store-collision — ${node.manifest.name} shares a content_hash store key with a different package`;
    byStoreKey.set(node.manifest.content_hash, ph);
  }
  return null;
}
```

Confirm `packageHash` is imported in ace.ts (it is — used by the existing preflight). Then replace the inline preflight loop in the install graph path with:

```ts
      const pf = preflightGraph(res.order);
      if (pf !== null) { console.error(`ace: install refused: ${pf}`); return 1; }
```

(Match the existing refusal message style; the extract loop immediately after is unchanged.)

- [ ] **Step 3: Run tests + strict tsc**

Run: `bun test tools/ace/` → all PASS (behavior identical — pure extraction). Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add tools/ace/ace.ts
git commit -m "$(printf 'refactor(ace): extract preflightGraph helper (slice 5.4 task 2)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 3: `--locked` flag (parse + mutual-exclusion with `--frozen`)

**Files:**

- Modify: `tools/ace/ace.ts` (`InstallArgs` + parseArgs)
- Test: `tools/ace/ace.test.ts`

- [ ] **Step 1: Write the failing tests** (append to the parseArgs describe in `tools/ace/ace.test.ts`)

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — `locked` not on InstallArgs / not parsed / no mutual-exclusion error.

- [ ] **Step 3a: Add `locked` to `InstallArgs`** (patch-script): add `readonly locked: boolean;` to the interface (next to `frozen`).

- [ ] **Step 3b: Parse `--locked` + mutual-exclusion** (patch-script): add `let locked = false;` next to `let frozen = false;`; add a parse case `} else if (argv[i] === "--locked") { locked = true;`; after the install arg loop (before building the return object) add `if (locked && frozen) return { error: "--locked and --frozen are mutually exclusive" };`; thread `locked` into the returned `InstallArgs` object (next to `frozen, lockfile: lockfilePath`).

- [ ] **Step 4: Run tests + strict tsc**

Run: `bun test tools/ace/ace.test.ts` → PASS. Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "$(printf 'feat(ace): --locked flag + --frozen mutual-exclusion (slice 5.4 task 3)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 4: `--locked` graph-path compare-before-extract

**Files:**

- Modify: `tools/ace/ace.ts` (install graph path)
- Test: `tools/ace/ace.test.ts`

- [ ] **Step 1: Write the failing tests** (`tools/ace/ace.test.ts`, reuse the existing graph-install integration harness — temp store, temp cwd, fetch map, registry)

```ts
// 1. --locked passes (installs) when the on-disk lock matches a fresh solve:
//    do a normal install (writes ./ace.lock), then install --locked again with the
//    SAME registry → exit 0, graph installed.
// 2. --locked refuses + installs nothing when the lock is stale:
//    normal install (locks A@1.0.0), then add A@1.1.0 to the registry (in-range), then
//    install --locked → exit non-zero, store unchanged (A@1.1.0 NOT installed).
// 3. --locked with NO lockfile → refused (exit non-zero).
```

Match the existing harness's return-code capture + store-assertion idiom (read a current graph-install test first).

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — `--locked` not handled (installs regardless).

- [ ] **Step 3: Implement** (patch-script) — in the install graph path, AFTER `resolve()` succeeds and BEFORE the `preflightGraph`/extract, insert the `--locked` gate:

```ts
      if (parsed.locked) {
        let lockRaw: string;
        try { lockRaw = readFileSync(parsed.lockfile, "utf8"); }
        catch { console.error(`ace: install refused: --locked but no lockfile at ${parsed.lockfile} — run 'ace update' or install without --locked`); return 1; }
        const onDisk = parseLockfile(lockRaw);
        if ("error" in onDisk) { console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${onDisk.error}`); return 1; }
        const fresh = buildLockfile(pkg, res.order, registry);
        if ("error" in fresh) { console.error(`ace: install refused: could not build lockfile: ${fresh.error}`); return 1; }
        if (!lockfilesEqual(onDisk, fresh)) {
          console.error(`ace: install refused: lockfile out of date (--locked) — run 'ace update' to regenerate`);
          return 1;
        }
      }
```

Add `lockfilesEqual` to the `./lockfile.ts` import line (alongside `buildLockfile, serializeLockfile, parseLockfile, verifyRootMatchesLock`). When `--locked` passes, control falls through to the existing `preflightGraph` + extract + (lock already matches; the existing buildLockfile+write rewrites an identical file — acceptable).

- [ ] **Step 4: Run tests + strict tsc + full suite**

Run: `bun test tools/ace/ace.test.ts` → PASS. Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0. Run: `bun test tools/ace/` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "$(printf 'feat(ace): install --locked compare-before-extract (slice 5.4 task 4)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 5: leaf-install lockfiles (default write + `--frozen` + `--locked` on leaf)

**Files:**

- Modify: `tools/ace/ace.ts` (the leaf / single-package install path)
- Test: `tools/ace/ace.test.ts`

- [ ] **Step 1: Write the failing tests** (`tools/ace/ace.test.ts`)

```ts
// 1. Leaf install writes an empty-nodes lock:
//    install a no-dep package with --lockfile <tmp> → ./lock parses to {root, nodes:[]}.
// 2. --frozen on a leaf installs the root when the lock matches:
//    after (1), install --frozen the same leaf → exit 0, installed.
// 3. --frozen leaf with a drifted root → refused:
//    build a leaf lock for root@1.0.0, then --frozen install a DIFFERENT root (changed files) → refused.
// 4. --locked leaf passes when lock matches / refuses when no lock.
```

Match the existing leaf-install test idiom.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — leaf path writes no lock; `--frozen`/`--locked` are no-ops on leaf.

- [ ] **Step 3: Implement** (patch-script) — find the leaf / single-package install path (the fall-through below the graph path, ~line 617 `const result = installPackage(parsed.storePath, pkg);`). Wrap it with frozen/locked handling + a default lock write. Replace the bare single-package install with:

```ts
    // SLICE 5.4: leaf (no-dependency) install — uniform lockfile handling.
    if (parsed.frozen) {
      let lockRaw: string;
      try { lockRaw = readFileSync(parsed.lockfile, "utf8"); }
      catch { console.error(`ace: install refused: no lockfile at ${parsed.lockfile} — run install without --frozen first`); return 1; }
      const lf = parseLockfile(lockRaw);
      if ("error" in lf) { console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${lf.error}`); return 1; }
      if (!verifyRootMatchesLock(pkg, lf)) { console.error(`ace: install refused: lockfile out of date for ${pkg.manifest.name} — re-run without --frozen to regenerate`); return 1; }
    } else if (parsed.locked) {
      let lockRaw: string;
      try { lockRaw = readFileSync(parsed.lockfile, "utf8"); }
      catch { console.error(`ace: install refused: --locked but no lockfile at ${parsed.lockfile} — run 'ace update' or install without --locked`); return 1; }
      const onDisk = parseLockfile(lockRaw);
      if ("error" in onDisk) { console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${onDisk.error}`); return 1; }
      if (!lockfilesEqual(onDisk, buildLeafLockfile(pkg))) { console.error(`ace: install refused: lockfile out of date (--locked) — run 'ace update' to regenerate`); return 1; }
    }
    const result = installPackage(parsed.storePath, pkg);
    if (!result.ok) { /* existing failure handling unchanged */ }
    // existing success logging ... then, for the default (non-frozen) path, write the leaf lock:
    if (!parsed.frozen) {
      try { writeFileSync(parsed.lockfile, serializeLockfile(buildLeafLockfile(pkg))); }
      catch (e) { console.error(`ace: WARNING: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`); }
    }
```

Add `buildLeafLockfile` to the `./lockfile.ts` import line. IMPORTANT: read the exact existing leaf-path code first — preserve its existing success/failure handling + return values; only WRAP it with the frozen/locked guards above and ADD the post-install leaf-lock write. Do not duplicate or drop the existing single-package verification that already runs before this point (signature gate + content_hash happen earlier in the handler, shared with the graph path).

- [ ] **Step 4: Run tests + strict tsc + full suite**

Run: `bun test tools/ace/ace.test.ts` → PASS. Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0. Run: `bun test tools/ace/` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "$(printf 'feat(ace): leaf-install lockfiles + --frozen/--locked leaf handling (slice 5.4 task 5)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 6: `ace update` command

**Files:**

- Modify: `tools/ace/ace.ts` (`UpdateArgs` + `ParsedArgs` + parseArgs branch + handler)
- Test: `tools/ace/ace.test.ts`

- [ ] **Step 1: Write the failing tests** (`tools/ace/ace.test.ts`)

```ts
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
// Integration:
// 1. ace update rewrites ./ace.lock to the freshly-solved graph, installs NOTHING:
//    seed registry A@1.0.0; install (locks A@1.0.0); add A@1.1.0 in-range; ace update →
//    ./ace.lock now pins A@1.1.0; store still has only the original install (update didn't extract).
// 2. ace update on a leaf writes an empty-nodes lock.
// 3. ace update refuses (no lock written) when a freshly-solved node fails preflight
//    (e.g. an unsafe file path in a dep) — the preflight-before-write guard.
```

Match the existing harness.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — no `update` command.

- [ ] **Step 3a: `UpdateArgs` + union + parseArgs branch** (patch-script):

Add the interface (near `InstallArgs`):

```ts
interface UpdateArgs {
  readonly command: "update";
  readonly source: string;
  readonly lockfile: string;
  readonly allowNoSignature: boolean;
}
```

Add `| UpdateArgs` to the `ParsedArgs` union. Add a parseArgs branch (mirror the install arg loop, minus `--frozen`/`--locked`/`--print-resolution`/`--store`-if-not-needed; `update` needs `source`, `--lockfile` default `"ace.lock"`, `--allow-no-signature`):

```ts
  if (command === "update") {
    const source = argv[1];
    if (!source || source.startsWith("-")) return { error: "update requires a <url-or-path> argument" };
    let lockfilePath = "ace.lock";
    let allowNoSignature = false;
    for (let i = 2; i < argv.length; i++) {
      if (argv[i] === "--lockfile") {
        const next = argv[++i];
        if (!next || next.startsWith("-")) return { error: "--lockfile requires a path argument" };
        lockfilePath = next;
      } else if (argv[i] === "--allow-no-signature") {
        allowNoSignature = true;
      } else {
        return { error: `Unknown option for update: ${argv[i]}` };
      }
    }
    return { command: "update", source, lockfile: lockfilePath, allowNoSignature };
  }
```

- [ ] **Step 3b: `update` handler** (patch-script) — add a handler block (near the install handler). It reuses the install front-half verification (read root → signature gate → root content_hash), then solves+resolves+preflights and writes the lock WITHOUT extracting:

```ts
  if (parsed.command === "update") {
    let raw: string;
    try {
      raw = parsed.source.startsWith("http://") || parsed.source.startsWith("https://")
        ? await (await fetch(parsed.source)).text() : readFileSync(parsed.source, "utf8");
    } catch (e) { console.error(`ace: download/read failed: ${(e as Error).message}`); return 1; }
    let pkg: AcePackage;
    try { pkg = JSON.parse(raw) as AcePackage; } catch { console.error("ace: package is not valid JSON"); return 65; }
    if (typeof pkg !== "object" || pkg === null || typeof pkg.manifest !== "object" || pkg.manifest === null || typeof pkg.files !== "object" || pkg.files === null) {
      console.error("ace: update refused: not a well-formed AcePackage"); return 1;
    }
    // Signature gate (same policy as install).
    const v = verifySignature(pkg.manifest, loadTrustStore());
    if (!v.ok && v.reason !== "no-signature") { console.error(`ace: update refused: ${v.reason}`); return 1; }
    if (!v.ok && v.reason === "no-signature" && !parsed.allowNoSignature) { console.error("ace: update refused: unsigned package (use --allow-no-signature)"); return 1; }
    // Root content_hash.
    const rootFilesHash = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
    if (rootFilesHash !== pkg.manifest.content_hash) { console.error(`ace: update refused: bad-content-hash in ${pkg.manifest.name} (root)`); return 1; }

    if (pkg.manifest.dependencies && pkg.manifest.dependencies.length > 0) {
      const fetchPackage = async (u: string): Promise<string> =>
        (u.startsWith("http://") || u.startsWith("https://")) ? await (await fetch(u)).text() : readFileSync(u, "utf8");
      const registry = loadRegistry();
      const solveResult = await solve(pkg, fetchPackage, registry);
      if (!solveResult.ok) { console.error(`ace: update refused: ${solveResult.reason} — ${solveResult.detail} (path: ${solveResult.path.join(" → ")})`); return 1; }
      const res = await resolve(pkg, fetchPackage, loadTrustStore(), registry, solveResult.versions, { allowNoSignature: parsed.allowNoSignature });
      if (!res.ok) { console.error(`ace: update refused: ${res.reason} — ${res.detail} (path: ${res.path.join(" → ")})`); return 1; }
      // Preflight BEFORE writing — never write a lock for a graph install would reject (Codex #6412).
      const pf = preflightGraph(res.order);
      if (pf !== null) { console.error(`ace: update refused: ${pf}`); return 1; }
      const lf = buildLockfile(pkg, res.order, registry);
      if ("error" in lf) { console.error(`ace: update refused: could not build lockfile: ${lf.error}`); return 1; }
      try { writeFileSync(parsed.lockfile, serializeLockfile(lf)); }
      catch (e) { console.error(`ace: update failed: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`); return 1; }
      console.log(`ace: wrote lockfile ${parsed.lockfile} (${lf.nodes.length} deps)`);
      return 0;
    }
    // Leaf: trivial lock.
    try { writeFileSync(parsed.lockfile, serializeLockfile(buildLeafLockfile(pkg))); }
    catch (e) { console.error(`ace: update failed: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`); return 1; }
    console.log(`ace: wrote lockfile ${parsed.lockfile} (0 deps)`);
    return 0;
  }
```

Confirm imports: `solve` (from `./solver.ts`), `resolve`, `packageHash` (from `./resolve.ts`), `buildLockfile`/`serializeLockfile`/`buildLeafLockfile` (from `./lockfile.ts`), `loadRegistry`/`loadTrustStore`/`contentHash` (from `./store.ts`), `verifySignature` (from `./signing.ts`) — all already imported for install; add any missing.

- [ ] **Step 4: Run tests + strict tsc + full suite**

Run: `bun test tools/ace/ace.test.ts` → PASS. Run: `bun --bun tsc --noEmit -p tsconfig.json` → exit 0. Run: `bun test tools/ace/` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "$(printf 'feat(ace): ace update command — re-solve + rewrite lock, preflight before write (slice 5.4 task 6)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
git ls-tree HEAD | wc -l   # 67
```

---

### Task 7: usage text + SKILL.md docs

**Files:**

- Modify: `tools/ace/ace.ts` (usage/help string)
- Modify: `.claude/skills/ace/SKILL.md`

- [ ] **Step 1: Update usage text** (patch-script) — add an `ace update <url-or-path> [--lockfile <path>] [--allow-no-signature]` line (re-solve + rewrite the lockfile, installs nothing) and add `[--locked]` to the `install` line with a one-line note (assert the committed lock is up to date, else refuse; mutually exclusive with `--frozen`). Match the existing usage style.

- [ ] **Step 2: Update SKILL.md** (patch-script or Write) — extend the lockfile section: `ace update` (refresh the lock by re-solving; lock-only), `install --locked` (CI guard: assert lock current vs `--frozen` replay), and that leaf installs now write a lock too. Terse; match the existing voice.

- [ ] **Step 3: Lint** — `bunx markdownlint-cli2 ".claude/skills/ace/SKILL.md"` → clean.

- [ ] **Step 4: Final verify** — `bun test tools/ace/` → all PASS; `bun --bun tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts .claude/skills/ace/SKILL.md
git commit -m "$(printf 'docs(ace): document ace update + --locked + leaf-lock (slice 5.4 task 7)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
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

Then open the PR against `main`, arm auto-merge, run the PR-gate loop (Copilot/Codex threads, keep canary 67), land on green.

## Self-review (plan vs spec)

- **Spec Feature 1 (`ace update`, lock-only, preflight-before-write)** → Task 6 (+ Task 2 extracts the shared `preflightGraph`). ✓
- **Spec Feature 2 (`ace install --locked`, compare, `--frozen` mutual-exclusion)** → Tasks 3 (parse + exclusion) + 4 (graph compare) + 5 (leaf compare). ✓
- **Spec Feature 3 (leaf-install lockfiles + `--frozen`/`--locked` on leaf)** → Task 5. ✓
- **Spec Components (`lockfilesEqual`, `buildLeafLockfile`)** → Task 1. ✓
- **Lock format unchanged (`format_version: 1`)** — no task touches the format; ✓.
- **Deferred (alpha-ordering, partial-merge, `--package`)** — no task implements them; ✓.
- **Error-handling table** — update solve/resolve/preflight refusals (Task 6), update write-fail hard error (Task 6), `--locked` no-lock/stale refusals (Tasks 4/5), `--locked`+`--frozen` error (Task 3), `--frozen` leaf no-lock/drift (Task 5), leaf default write warning (Task 5). ✓
- **Type consistency:** `lockfilesEqual(a,b)` / `buildLeafLockfile(root)` / `UpdateArgs` / `InstallArgs.locked` / `preflightGraph(order)` names + signatures consistent across Tasks 1–7. ✓
