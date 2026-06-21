# Ace slice 4 — inline-URL dependency resolution: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ace install` resolves a manifest's full transitive inline-URL dependency graph, verifies every node (slice-2 hash + slice-3 signature), and installs leaves-first — atomically.

**Architecture:** A new pure `resolve.ts` (fetch boundary injected → fully in-memory testable) does identity-keyed graph resolution; `store.ts` gains the `dependencies?` manifest field + a factored-out `validatePackagePaths`; `ace.ts` wires the resolver into `install` with a graph preflight (path-safety + store-collision) before extracting anything.

**Tech Stack:** TypeScript on Bun; `bun:test`; `node:crypto` (sha256). Spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice4-inline-url-dependency-resolution-design.md`.

**Conventions (every commit):** run `git ls-tree HEAD | wc -l` — must stay **67** root entries (commit canary); confirm `git branch --show-current` = `otto-windows/ace-slice4-impl-2026-06-01` before committing; commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. The Otto-343 hook blocks `Edit` on files not Read this session — prefer `Write` (full file) when it blocks. Run the full ace suite with `bun test tools/ace/` (currently 76 tests, all green).

---

## File Structure

| File | Responsibility |
|---|---|
| `tools/ace/store.ts` | (modify) `AceManifest.dependencies?` + `AceDependency` export; factor `validatePackagePaths(pkg)` out of `installPackage` |
| `tools/ace/resolve.ts` | (create) pure resolver: `packageHash`, `resolve` (identity-keyed DFS, verify per node, topo order) |
| `tools/ace/resolve.test.ts` | (create) resolver unit tests, injected in-memory fetch |
| `tools/ace/ace.ts` | (modify) wire `resolve` into `install`; graph preflight; graph-wide `--allow-no-signature`; resolved-set output |
| `tools/ace/ace.test.ts` | (modify) e2e graph-install + atomic-refuse tests |
| `.claude/skills/ace/SKILL.md` | (modify) document transitive install + refusal reasons |

---

## Task 1: Manifest gains `dependencies?` (back-compat)

**Files:**

- Modify: `tools/ace/store.ts` (the `AceManifest` interface + a new `AceDependency` interface, near lines 7-14)
- Test: `tools/ace/store.test.ts`

- [ ] **Step 1: Write the failing test** (append to `store.test.ts`, inside the `installPackage` describe)

```ts
test("installPackage ignores a manifest's dependencies field (leaf back-compat)", () => {
  const store = mkdtempSync(join(tmpdir(), "ace-store-"));
  const files = { "r.txt": "hi" };
  const content_hash = "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  const pkg = {
    manifest: {
      format_version: 1, name: "demo", version: "1.0.0", content_hash,
      dependencies: [{ name: "x", version: "1.0.0", url: "http://e/x.json", package_hash: "sha256:deadbeef" }],
    },
    files,
  };
  const result = installPackage(store, pkg);
  expect(result.ok).toBe(true); // store layer ignores dependencies; still installs the single package
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tools/ace/store.test.ts`
Expected: FAIL — TypeScript rejects `dependencies` (not on `AceManifest`).

- [ ] **Step 3: Add the field + interface** (in `tools/ace/store.ts`, replace the `AceManifest` interface block, lines 7-14)

```ts
export interface AceDependency {
  readonly name: string;
  readonly version: string;
  readonly url: string;
  readonly package_hash: string; // sha256 of the canonical FULL package (manifest incl. signature + files)
}

export interface AceManifest {
  readonly format_version: number;
  readonly name: string;
  readonly version: string;
  readonly content_hash: string; // slice-2: sha256(files)
  readonly description?: string;
  readonly signature?: { readonly algo: string; readonly key_id: string; readonly sig: string };
  readonly dependencies?: ReadonlyArray<AceDependency>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/ace/store.test.ts`
Expected: PASS (all existing store tests still green).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/store.ts tools/ace/store.test.ts
git commit -m "feat(ace): AceManifest.dependencies? + AceDependency (slice 4 task 1)"
```

---

## Task 2: Factor `validatePackagePaths` out of `installPackage`

**Files:**

- Modify: `tools/ace/store.ts` (`installPackage`, the path-safety loop ~lines 115-119)
- Test: `tools/ace/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { validatePackagePaths } from "./store.ts"; // add to the existing import line

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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tools/ace/store.test.ts`
Expected: FAIL — `validatePackagePaths` is not exported.

- [ ] **Step 3: Add the helper + use it in `installPackage`** (in `tools/ace/store.ts`)

Add the exported helper just above `installPackage`:

```ts
/** Returns the first unsafe file path in the package, or null if all paths are safe.
 *  Unsafe = contains '..', or is absolute (leading '/' or '\\'). Shared by installPackage
 *  AND the slice-4 graph install preflight so the two never drift. */
export function validatePackagePaths(pkg: AcePackage): string | null {
  for (const rel of Object.keys(pkg.files)) {
    if (rel.includes("..") || rel.startsWith("/") || rel.startsWith("\\")) return rel;
  }
  return null;
}
```

Then replace the inline loop in `installPackage` (the `for (const rel of Object.keys(pkg.files)) { if (...) return {ok:false,...}}` block) with:

```ts
  const unsafe = validatePackagePaths(pkg);
  if (unsafe !== null) {
    return { ok: false, error: `unsafe file path in package: ${unsafe}` };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/ace/store.test.ts`
Expected: PASS (the existing traversal/absolute-path installPackage tests still pass — behavior unchanged, just refactored).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/store.ts tools/ace/store.test.ts
git commit -m "refactor(ace): factor validatePackagePaths out of installPackage (slice 4 task 2)"
```

---

## Task 3: `packageHash` (full-package identity)

**Files:**

- Create: `tools/ace/resolve.ts`
- Test: `tools/ace/resolve.test.ts`

- [ ] **Step 1: Write the failing test** (create `tools/ace/resolve.test.ts`)

```ts
import { describe, expect, test } from "bun:test";
import { packageHash } from "./resolve.ts";
import type { AcePackage } from "./store.ts";

const mk = (name: string, deps?: unknown): AcePackage => ({
  manifest: { format_version: 1, name, version: "1.0.0", content_hash: "sha256:aaa", ...(deps ? { dependencies: deps } : {}) } as AcePackage["manifest"],
  files: { "a.txt": "x" },
});

describe("packageHash", () => {
  test("stable under key reordering (canonical)", () => {
    const a: AcePackage = { manifest: { format_version: 1, name: "n", version: "1", content_hash: "h" }, files: { a: "1", b: "2" } };
    const b: AcePackage = { manifest: { content_hash: "h", version: "1", name: "n", format_version: 1 }, files: { b: "2", a: "1" } } as AcePackage;
    expect(packageHash(a)).toBe(packageHash(b));
  });
  test("differs when manifest differs even if files identical", () => {
    expect(packageHash(mk("A"))).not.toBe(packageHash(mk("B"))); // same files, different name
  });
  test("differs when files differ", () => {
    const base = mk("A");
    const other: AcePackage = { manifest: base.manifest, files: { "a.txt": "DIFFERENT" } };
    expect(packageHash(base)).not.toBe(packageHash(other));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tools/ace/resolve.test.ts`
Expected: FAIL — `resolve.ts` does not exist.

- [ ] **Step 3: Create `tools/ace/resolve.ts` with `packageHash`**

```ts
import { createHash } from "node:crypto";
import type { AcePackage } from "./store.ts";

/** Deterministic JSON: object keys recursively sorted; arrays preserve order. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

/** sha256 of the canonical whole package ({manifest incl. signature, files}). The parent's
 *  pin / identity for a dependency. Two edges sharing a packageHash are byte-identical. */
export function packageHash(pkg: AcePackage): string {
  return "sha256:" + createHash("sha256").update(canonicalJson({ manifest: pkg.manifest, files: pkg.files })).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/ace/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.ts tools/ace/resolve.test.ts
git commit -m "feat(ace): packageHash full-package identity helper (slice 4 task 3)"
```

---

## Task 4: `resolve` — leaf + linear chain (topo order)

**Files:**

- Modify: `tools/ace/resolve.ts`, `tools/ace/resolve.test.ts`

**Shared test helper** (add near the top of `resolve.test.ts`, after imports): builds a package + a fetch map keyed by URL, with edges carrying the correct `package_hash`.

```ts
import { resolve, packageHash, type FetchPackage } from "./resolve.ts";
import { contentHash, type AcePackage } from "./store.ts";

// Build a package; deps is an array of { pkg, url } children already built.
function pkgOf(name: string, files: Record<string, string>, children: { pkg: AcePackage; url: string }[] = []): AcePackage {
  const ch = "sha256:" + // slice-2 files hash
    require("node:crypto").createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  return {
    manifest: {
      format_version: 1, name, version: "1.0.0", content_hash: ch,
      dependencies: children.map((c) => ({ name: c.pkg.manifest.name, version: c.pkg.manifest.version, url: c.url, package_hash: packageHash(c.pkg) })),
    },
    files,
  };
}
// An injected fetch over a {url: package} map.
function fetchOf(map: Record<string, AcePackage>): FetchPackage {
  return async (url: string) => { const p = map[url]; if (!p) throw new Error("404 " + url); return JSON.stringify(p); };
}
const NO_TRUST = new Map(); // empty trust store; tests use allowNoSignature:true unless testing signatures
```

- [ ] **Step 1: Write the failing tests**

```ts
describe("resolve — basic", () => {
  test("leaf package (no deps) resolves to [root]", async () => {
    const root = pkgOf("root", { "r.txt": "x" });
    const r = await resolve(root, fetchOf({}), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name)).toEqual(["root"]);
  });
  test("linear chain root->A->B installs leaves-first [B, A, root]", async () => {
    const B = pkgOf("B", { "b.txt": "b" });
    const A = pkgOf("A", { "a.txt": "a" }, [{ pkg: B, url: "http://e/B" }]);
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name)).toEqual(["B", "A", "root"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/resolve.test.ts`
Expected: FAIL — `resolve` not exported.

- [ ] **Step 3: Implement `resolve` (basic DFS, no conflict checks yet)** — append to `tools/ace/resolve.ts`

```ts
import { contentHash, verifyHelpersPlaceholder } from "./store.ts"; // NOTE: see Task 8 for the real imports
import type { AceManifest, LoadedTrustEntry } from "./store.ts";

export type FetchPackage = (urlOrPath: string) => Promise<string>;

export type ResolveReason =
  | "version-skew" | "tamper" | "pin-mismatch" | "bad-content-hash"
  | "bad-signature" | "untrusted-key" | "unsupported-algo" | "no-signature"
  | "cycle" | "fetch-failed" | "invalid-package";

export type ResolveResult =
  | { ok: true; order: AcePackage[] }
  | { ok: false; reason: ResolveReason; detail: string; path: string[] };

export async function resolve(
  root: AcePackage,
  fetchPackage: FetchPackage,
  _trustStore: Map<string, LoadedTrustEntry>,
  _opts: { allowNoSignature: boolean },
): Promise<ResolveResult> {
  const byName = new Map<string, { version: string; pkgHash: string; path: string[] }>();
  const visiting = new Set<string>();
  const order: AcePackage[] = [];

  byName.set(root.manifest.name, { version: root.manifest.version, pkgHash: packageHash(root), path: ["root"] });
  visiting.add(root.manifest.name);

  const walk = async (node: AcePackage, path: string[]): Promise<ResolveResult | null> => {
    for (const edge of node.manifest.dependencies ?? []) {
      const here = [...path, edge.name];
      let dep: AcePackage;
      try { dep = JSON.parse(await fetchPackage(edge.url)) as AcePackage; }
      catch (e) { return { ok: false, reason: "fetch-failed", detail: `${edge.url}: ${(e as Error).message}`, path: here }; }
      byName.set(edge.name, { version: edge.version, pkgHash: edge.package_hash, path: here });
      visiting.add(edge.name);
      const sub = await walk(dep, here);
      if (sub) return sub;
      visiting.delete(edge.name);
      order.push(dep);
    }
    return null;
  };

  const failure = await walk(root, ["root"]);
  if (failure) return failure;
  order.push(root);
  return { ok: true, order };
}
```

> NOTE: the `verifyHelpersPlaceholder` import line above is a deliberate stand-in — delete it; the real imports (`contentHash`, `verifySignature`) are added in Task 8. For Task 4, the only imports needed are `packageHash` (same file) and the types.

- [ ] **Step 4: Run to verify it passes**

Run: `bun test tools/ace/resolve.test.ts`
Expected: PASS (basic + packageHash tests).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.ts tools/ace/resolve.test.ts
git commit -m "feat(ace): resolve leaf + linear-chain topo order (slice 4 task 4)"
```

---

## Task 5: Diamond dedup + distinct-identical-files

**Files:** `tools/ace/resolve.ts`, `tools/ace/resolve.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe("resolve — dedup", () => {
  test("diamond (root->A->D, root->B->D, same D) installs D once", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const A = pkgOf("A", { "a.txt": "a" }, [{ pkg: D, url: "http://e/D" }]);
    const B = pkgOf("B", { "b.txt": "b" }, [{ pkg: D, url: "http://e/D" }]);
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }, { pkg: B, url: "http://e/B" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B, "http://e/D": D }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.filter((p) => p.manifest.name === "D").length).toBe(1);
  });
  test("distinct packages with identical files (different names) both resolve", async () => {
    const files = { "same.txt": "identical" };
    const X = pkgOf("X", files); // same files...
    const Y = pkgOf("Y", files); // ...different name => different package_hash
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: X, url: "http://e/X" }, { pkg: Y, url: "http://e/Y" }]);
    const r = await resolve(root, fetchOf({ "http://e/X": X, "http://e/Y": Y }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name).sort()).toEqual(["X", "Y", "root"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/resolve.test.ts`
Expected: FAIL — diamond installs D twice (no dedup yet).

- [ ] **Step 3: Add dedup/cycle/skew/tamper branch** — in `walk`, replace the top of the loop body (before the fetch) with the identity checks:

```ts
    for (const edge of node.manifest.dependencies ?? []) {
      const here = [...path, edge.name];
      if (visiting.has(edge.name)) {
        return { ok: false, reason: "cycle", detail: here.join(" → "), path: here };
      }
      const seen = byName.get(edge.name);
      if (seen) {
        if (seen.version !== edge.version) {
          return { ok: false, reason: "version-skew", detail: `${edge.name} required at ${seen.version} (via ${seen.path.join(" → ")}) and ${edge.version} (via ${here.join(" → ")})`, path: here };
        }
        if (seen.pkgHash !== edge.package_hash) {
          return { ok: false, reason: "tamper", detail: `${edge.name}@${edge.version} has two different package hashes`, path: here };
        }
        continue; // diamond dedup: same name+version+package_hash, already resolved
      }
      let dep: AcePackage;
      try { dep = JSON.parse(await fetchPackage(edge.url)) as AcePackage; }
      catch (e) { return { ok: false, reason: "fetch-failed", detail: `${edge.url}: ${(e as Error).message}`, path: here }; }
      byName.set(edge.name, { version: edge.version, pkgHash: edge.package_hash, path: here });
      visiting.add(edge.name);
      const sub = await walk(dep, here);
      if (sub) return sub;
      visiting.delete(edge.name);
      order.push(dep);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test tools/ace/resolve.test.ts`
Expected: PASS (diamond D once; X+Y both resolve).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.ts tools/ace/resolve.test.ts
git commit -m "feat(ace): resolve diamond dedup + identity-keyed (slice 4 task 5)"
```

---

## Task 6: Version-skew + tamper + root-seeded skew/cycle

**Files:** `tools/ace/resolve.test.ts` (logic already added in Task 5; this task proves skew/tamper + root-seeding)

- [ ] **Step 1: Write the failing/confirming tests**

```ts
describe("resolve — conflicts", () => {
  test("version-skew (A->D@1.0, B->D@2.0) refuses", async () => {
    const D1 = pkgOf("D", { "d.txt": "d1" });
    const D2: AcePackage = { manifest: { ...D1.manifest, version: "2.0.0" }, files: { "d.txt": "d2" } };
    const A = pkgOf("A", { "a.txt": "a" }, [{ pkg: D1, url: "http://e/D1" }]);
    const B: AcePackage = { manifest: { ...pkgOf("B", { "b.txt": "b" }).manifest, dependencies: [{ name: "D", version: "2.0.0", url: "http://e/D2", package_hash: packageHash(D2) }] }, files: { "b.txt": "b" } };
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }, { pkg: B, url: "http://e/B" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B, "http://e/D1": D1, "http://e/D2": D2 }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("version-skew");
  });
  test("root-involving skew (root@1 -> A -> root@2) refuses (root is seeded)", async () => {
    const root2: AcePackage = { manifest: { format_version: 1, name: "root", version: "2.0.0", content_hash: "sha256:zzz" }, files: { "r.txt": "two" } };
    const A: AcePackage = { manifest: { ...pkgOf("A", { "a.txt": "a" }).manifest, dependencies: [{ name: "root", version: "2.0.0", url: "http://e/root2", package_hash: packageHash(root2) }] }, files: { "a.txt": "a" } };
    const root = pkgOf("root", { "r.txt": "one" }, [{ pkg: A, url: "http://e/A" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/root2": root2 }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["version-skew", "cycle"]).toContain(r.reason); // root is on the stack -> cycle takes precedence
  });
  test("root cycle (root@1 -> A -> root@1) refuses as cycle", async () => {
    const root1Files = { "r.txt": "one" };
    const rootPlaceholder = pkgOf("root", root1Files); // for hash only
    const A: AcePackage = { manifest: { ...pkgOf("A", { "a.txt": "a" }).manifest, dependencies: [{ name: "root", version: "1.0.0", url: "http://e/root", package_hash: packageHash(rootPlaceholder) }] }, files: { "a.txt": "a" } };
    const root = pkgOf("root", root1Files, [{ pkg: A, url: "http://e/A" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/root": root }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
  });
});
```

- [ ] **Step 2: Run** — Run: `bun test tools/ace/resolve.test.ts`

Expected: the cycle/skew logic from Task 5 + root seeding from Task 4 make these PASS. If root-skew/cycle fail, confirm Task 4 seeded `byName`+`visiting` with the root (it does).

- [ ] **Step 3: (only if a test fails)** — no new code expected; the Task-4 seeding + Task-5 checks cover this. If `version-skew` detail doesn't name both requirers, confirm `byName` stores `path` (it does, Task 4).

- [ ] **Step 4: Run to verify pass** — Run: `bun test tools/ace/resolve.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.test.ts
git commit -m "test(ace): resolve version-skew + root-seeded skew/cycle (slice 4 task 6)"
```

---

## Task 7: Cycle (A->B->A)

**Files:** `tools/ace/resolve.test.ts`

- [ ] **Step 1: Write the test**

```ts
test("cycle A->B->A refuses with the loop in path", async () => {
  // Build B that depends on A, and A that depends on B (mutual). Use placeholders for hashes.
  const aFiles = { "a.txt": "a" }, bFiles = { "b.txt": "b" };
  const aPlaceholder = pkgOf("A", aFiles);
  const B: AcePackage = { manifest: { ...pkgOf("B", bFiles).manifest, dependencies: [{ name: "A", version: "1.0.0", url: "http://e/A", package_hash: packageHash(aPlaceholder) }] }, files: bFiles };
  const A: AcePackage = { manifest: { ...pkgOf("A", aFiles).manifest, dependencies: [{ name: "B", version: "1.0.0", url: "http://e/B", package_hash: packageHash(B) }] }, files: aFiles };
  const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }]);
  const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B }), NO_TRUST, { allowNoSignature: true });
  expect(r.ok).toBe(false);
  if (!r.ok) { expect(r.reason).toBe("cycle"); expect(r.path).toContain("A"); }
});
```

- [ ] **Step 2: Run** → Run: `bun test tools/ace/resolve.test.ts` → expect PASS (Task-5 cycle logic covers it).

- [ ] **Step 3:** no new code expected.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.test.ts
git commit -m "test(ace): resolve A->B->A cycle (slice 4 task 7)"
```

---

## Task 8: Per-node verification (slice-2 hash, pin, identity, slice-3 signature)

**Files:** `tools/ace/resolve.ts` (add the verification block in `walk`, after fetch), `tools/ace/resolve.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe("resolve — verification", () => {
  test("bad-content-hash (files don't hash to manifest.content_hash) refuses", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const tampered: AcePackage = { manifest: D.manifest, files: { "d.txt": "TAMPERED" } }; // hash no longer matches
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]); // edge pins original D
    const r = await resolve(root, fetchOf({ "http://e/D": tampered }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-content-hash");
  });
  test("pin-mismatch (edge package_hash != fetched) refuses", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]);
    // mutate the edge's package_hash to a wrong value
    (root.manifest.dependencies as any)[0] = { ...root.manifest.dependencies![0], package_hash: "sha256:wrongwrong" };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("pin-mismatch");
  });
  test("declared-identity mismatch (edge name != fetched manifest name) refuses pin-mismatch", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]);
    (root.manifest.dependencies as any)[0] = { ...root.manifest.dependencies![0], name: "NOT_D" }; // edge claims a different name
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("pin-mismatch");
  });
  test("unsigned node refuses without allowNoSignature, resolves with it", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]);
    const strict = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, { allowNoSignature: false });
    expect(strict.ok).toBe(false);
    if (!strict.ok) expect(strict.reason).toBe("no-signature");
    const lax = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, { allowNoSignature: true });
    expect(lax.ok).toBe(true);
  });
});
```

> Note on the identity-mismatch test: after changing the edge `name`, that edge no longer matches a `byName` seed, so it fetches D, whose manifest.name ("D") ≠ edge.name ("NOT_D") → `pin-mismatch` at the identity check.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/resolve.test.ts`
Expected: FAIL — no verification yet (e.g. bad-content-hash resolves OK).

- [ ] **Step 3: Add verification** — fix the imports at the top of `resolve.ts` (replace the placeholder import line from Task 4):

```ts
import { contentHash, type AcePackage, type LoadedTrustEntry } from "./store.ts";
import { verifySignature } from "./signing.ts";
```

Then in `walk`, immediately AFTER the successful `JSON.parse` of `dep` and BEFORE `byName.set(...)`, insert:

```ts
      // slice-2 self-check
      const filesHash = contentHash(new TextEncoder().encode(JSON.stringify(dep.files)));
      if (filesHash !== dep.manifest.content_hash) {
        return { ok: false, reason: "bad-content-hash", detail: `${edge.name}: files hash ${filesHash} != manifest ${dep.manifest.content_hash}`, path: here };
      }
      // pin check (whole-package identity)
      const got = packageHash(dep);
      if (got !== edge.package_hash) {
        return { ok: false, reason: "pin-mismatch", detail: `${edge.name}: expected package_hash ${edge.package_hash} but fetched ${got}`, path: here };
      }
      // declared-identity check
      if (dep.manifest.name !== edge.name || dep.manifest.version !== edge.version) {
        return { ok: false, reason: "pin-mismatch", detail: `${edge.name}@${edge.version}: edge identity != fetched ${dep.manifest.name}@${dep.manifest.version}`, path: here };
      }
      // slice-3 signature gate
      const v = verifySignature(dep.manifest, _trustStore);
      if (!v.ok) {
        if (v.reason === "no-signature") {
          if (!_opts.allowNoSignature) return { ok: false, reason: "no-signature", detail: `${edge.name}: unsigned (use --allow-no-signature)`, path: here };
        } else {
          return { ok: false, reason: v.reason, detail: `${edge.name}: ${v.reason}`, path: here };
        }
      }
```

Rename `_trustStore`/`_opts` params to `trustStore`/`opts` (drop the underscores) now that they're used.

- [ ] **Step 4: Run to verify it passes**

Run: `bun test tools/ace/resolve.test.ts`
Expected: PASS (all resolver tests).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.ts tools/ace/resolve.test.ts
git commit -m "feat(ace): resolve per-node hash/pin/identity/signature gates (slice 4 task 8)"
```

---

## Task 9: Wire `resolve` into `ace install` (graph preflight + atomic)

**Files:** `tools/ace/ace.ts` (the `install` command, ~lines 358-410), `tools/ace/ace.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `ace.test.ts`; it already has the temp-HOME beforeEach/afterEach + helpers — reuse them; build packages with the resolve.test helper pattern, writing each dep package to a temp file and pointing edges at `file://`-less local paths via the install `<path>` form)

```ts
import { resolve as _r, packageHash } from "./resolve.ts"; // packageHash for building edges

test("e2e: install a small graph (root->A->B) installs all three, leaves first", async () => {
  const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
  const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
  const hash = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  const B = { manifest: { format_version:1, name:"B", version:"1.0.0", content_hash: hash({ "b.txt":"b" }) }, files: { "b.txt":"b" } };
  writeFileSync(join(dir,"B.json"), JSON.stringify(B));
  const A = { manifest: { format_version:1, name:"A", version:"1.0.0", content_hash: hash({ "a.txt":"a" }), dependencies:[{ name:"B", version:"1.0.0", url: join(dir,"B.json"), package_hash: packageHash(B) }] }, files: { "a.txt":"a" } };
  writeFileSync(join(dir,"A.json"), JSON.stringify(A));
  const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: hash({ "r.txt":"r" }), dependencies:[{ name:"A", version:"1.0.0", url: join(dir,"A.json"), package_hash: packageHash(A) }] }, files: { "r.txt":"r" } };
  writeFileSync(join(dir,"root.json"), JSON.stringify(root));
  const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
  expect(code).toBe(0);
  expect(listInstalled(store).map((p)=>p.manifest.name).sort()).toEqual(["A","B","root"]);
});

test("atomic: a graph with an unsafe-path node installs NOTHING (preflight)", async () => {
  const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
  const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
  const hash = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  const bad = { manifest: { format_version:1, name:"BAD", version:"1.0.0", content_hash: hash({ "../escape":"x" }) }, files: { "../escape":"x" } };
  writeFileSync(join(dir,"BAD.json"), JSON.stringify(bad));
  const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: hash({ "r.txt":"r" }), dependencies:[{ name:"BAD", version:"1.0.0", url: join(dir,"BAD.json"), package_hash: packageHash(bad) }] }, files: { "r.txt":"r" } };
  writeFileSync(join(dir,"root.json"), JSON.stringify(root));
  const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
  expect(code).toBe(1);
  expect(listInstalled(store).length).toBe(0); // nothing extracted
});
```

> Ensure `ace.test.ts` imports `writeFileSync`, `mkdtempSync`, `createHash`, `join`, `tmpdir`, `listInstalled`, `main` (most already imported — add any missing).

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — `install` doesn't resolve graphs yet (root with deps installs only root; listInstalled has 1, not 3).

- [ ] **Step 3: Wire the resolver into `install`** — in `tools/ace/ace.ts`, add imports at top:

```ts
import { resolve, packageHash } from "./resolve.ts";
import { validatePackagePaths } from "./store.ts"; // add to the existing store import
```

In the `install` block, AFTER the root authenticity gate succeeds and BEFORE the `installPackage(parsed.storePath, pkg)` line, branch on dependencies:

```ts
    // SLICE 4: transitive graph. Leaf (no deps) falls through to the single-package path below (unchanged).
    if (pkg.manifest.dependencies && pkg.manifest.dependencies.length > 0) {
      const fetchPackage = async (u: string): Promise<string> =>
        u.startsWith("http") ? await (await fetch(u)).text() : readFileSync(u, "utf8");
      const res = await resolve(pkg, fetchPackage, loadTrustStore(), { allowNoSignature: parsed.allowNoSignature });
      if (!res.ok) {
        console.error(`ace: install refused: ${res.reason} — ${res.detail} (path: ${res.path.join(" → ")})`);
        return 1;
      }
      // PREFLIGHT (atomic): path-safety + store-key collision across the whole graph BEFORE any extract.
      const byStoreKey = new Map<string, string>(); // content_hash -> package_hash
      for (const node of res.order) {
        const unsafe = validatePackagePaths(node);
        if (unsafe !== null) { console.error(`ace: install refused: unsafe file path in ${node.manifest.name}: ${unsafe}`); return 1; }
        const ph = packageHash(node);
        const prior = byStoreKey.get(node.manifest.content_hash);
        if (prior !== undefined && prior !== ph) { console.error(`ace: install refused: store-collision — ${node.manifest.name} shares a content_hash store key with a different package`); return 1; }
        byStoreKey.set(node.manifest.content_hash, ph);
      }
      // EXTRACT all, leaves first.
      for (const node of res.order) {
        const out = installPackage(parsed.storePath, node);
        if (!out.ok) { console.error(`ace: install failed mid-graph: ${out.error}`); return 1; }
      }
      console.log(`ace: installed ${res.order.length}: ${res.order.map((p) => `${p.manifest.name}@${p.manifest.version}`).join(", ")}`);
      return 0;
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test tools/ace/ace.test.ts`
Expected: PASS (graph install installs 3; unsafe-path graph installs 0).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "feat(ace): wire resolver into install — graph preflight + atomic (slice 4 task 9)"
```

---

## Task 10: store-collision e2e test + SKILL.md docs

**Files:** `tools/ace/ace.test.ts`, `.claude/skills/ace/SKILL.md`

- [ ] **Step 1: Write the store-collision test**

```ts
test("store-collision: two distinct packages with identical files install NOTHING", async () => {
  const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
  const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
  const hash = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  const sharedFiles = { "same.txt": "identical" };
  const X = { manifest: { format_version:1, name:"X", version:"1.0.0", content_hash: hash(sharedFiles) }, files: sharedFiles };
  const Y = { manifest: { format_version:1, name:"Y", version:"1.0.0", content_hash: hash(sharedFiles) }, files: sharedFiles }; // same content_hash, diff name => diff package_hash
  writeFileSync(join(dir,"X.json"), JSON.stringify(X));
  writeFileSync(join(dir,"Y.json"), JSON.stringify(Y));
  const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: hash({ "r.txt":"r" }), dependencies:[
    { name:"X", version:"1.0.0", url: join(dir,"X.json"), package_hash: packageHash(X) },
    { name:"Y", version:"1.0.0", url: join(dir,"Y.json"), package_hash: packageHash(Y) },
  ] }, files: { "r.txt":"r" } };
  writeFileSync(join(dir,"root.json"), JSON.stringify(root));
  const code = await main(["install", join(dir,"root.json"), "--store", store, "--allow-no-signature"]);
  expect(code).toBe(1);
  expect(listInstalled(store).length).toBe(0);
});
```

- [ ] **Step 2: Run** → Run: `bun test tools/ace/ace.test.ts` → expect PASS (Task-9 preflight store-collision check covers it).

- [ ] **Step 3: Update `.claude/skills/ace/SKILL.md`** — in the `install` row + the paragraph below the verb table, document transitive resolution. Replace the install-row description and add a sentence:

In the verb table, the `install` row becomes:

```
| `install` | `bun tools/ace/ace.ts install <url-or-path> [--allow-no-signature]` | Resolve the transitive dependency graph, verify integrity + authenticity of every node, install leaves-first (atomic) |
```

Add after the existing "install verifies integrity AND authenticity" paragraph:

```markdown
For a manifest with `dependencies` (inline-URL: `{name, version, url, package_hash}`),
`install` resolves the full transitive graph and installs every node leaves-first.
Resolution is atomic: it verifies the whole graph (slice-2 hash + slice-3 signature
per node, identity-pinned by `package_hash`) and preflights path-safety + store-key
uniqueness BEFORE extracting anything — any failure installs nothing. Refusal reasons:
`version-skew`, `tamper`, `pin-mismatch`, `bad-content-hash`, `bad-signature`,
`untrusted-key`, `unsupported-algo`, `no-signature`, `cycle`, `fetch-failed`,
`invalid-package`, `store-collision`. `--allow-no-signature` applies graph-wide
(permits only genuinely-unsigned nodes; a bad/untrusted signature on any node always refuses).
```

- [ ] **Step 4: Run the full suite + build**

Run: `bun test tools/ace/` (expect all green — 76 prior + the new slice-4 tests)
Run: `git ls-tree HEAD | wc -l` (expect 67)

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.test.ts .claude/skills/ace/SKILL.md
git commit -m "feat(ace): store-collision e2e test + SKILL transitive-install docs (slice 4 task 10)"
```

---

## Final: open the PR

After all tasks pass + the plan doc is committed:

```bash
git push -u origin otto-windows/ace-slice4-impl-2026-06-01
gh pr create --head otto-windows/ace-slice4-impl-2026-06-01 --base main \
  --title "feat(ace): slice 4 — inline-URL transitive dependency resolution (081KR2E4K0008QG0R002YE3MMD)" --body "<summary>"
gh pr merge <N> --auto --squash
```

Then run the standard PR-gate loop (`bun tools/github/poll-pr-gate.ts <N>`): address review threads (verify-before-fix), keep the canary at 67, resolve threads, land on green.

---

## Self-Review

**Spec coverage:** D1 inline-URL (Task 1 manifest field) · D2 transitive (Task 4 recursion) · D3 version-skew (Task 6) · D4 tamper (Task 5/6) · D5 diamond dedup (Task 5) · D6 atomic + preflight (Task 9) · D7 no lockfile (nothing to build) · D8 signature policy graph-wide (Task 8 + Task 9 `allowNoSignature` threaded through) · packageHash (Task 3) · validatePackagePaths factor (Task 2) · store-collision (Task 9/10) · resolved-set output (Task 9) · all 16 resolver test cases + 4 ace.test cases (Tasks 4-10) · SKILL docs (Task 10). No gaps.

**Placeholder scan:** the only intentional stand-in is the Task-4 `verifyHelpersPlaceholder` import line, explicitly flagged to delete + replaced with real imports in Task 8. No other TBD/TODO.

**Type consistency:** `resolve(root, fetchPackage, trustStore, {allowNoSignature})` signature consistent across Tasks 4/8/9. `packageHash(pkg)` consistent (Tasks 3/5/8/9/10). `validatePackagePaths(pkg): string|null` consistent (Tasks 2/9). `ResolveReason` union matches the per-node returns in Task 8 + the spec. `byName` value `{version, pkgHash, path}` consistent (Tasks 4/5/6/8). `verifySignature(manifest, trustStore)` matches the existing `ace.ts` call signature.
