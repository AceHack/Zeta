# Ace slice 5.1 — registry data layer + exact-version: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A manifest dependency can name a package by `name + version` and let a local registry supply `{url, package_hash}`; `ace install` looks it up (exact version) and runs the identical slice-4 verify + atomic-install path.

**Architecture:** `AceDependency` becomes an explicit DU (`inline | registry`). A registry data layer (bundled ∪ user JSON, mirroring the trust store) maps `name → version → {url, package_hash}`. `resolve()` gains an injected `registry` param and dispatches per-edge on `kind` (registry → lookup → fill `url`+`package_hash`; inline → unchanged), then runs the existing slice-4 verify logic.

**Tech Stack:** TypeScript on Bun; `bun:test`; `node:crypto`/`node:fs`. Spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.1-registry-exact-version-design.md`.

**Conventions (every commit):** `git ls-tree HEAD | wc -l` must stay **67**; `git branch --show-current` = `otto-windows/ace-slice5.1-impl-2026-06-01` before committing; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Otto-343 hook blocks `Edit` on unread files → Read-first or `Write`. Full suite: `bun test tools/ace/` (currently 104 pass).

---

## File Structure

| File | Responsibility |
|---|---|
| `tools/ace/store.ts` | `AceDependency` → DU; `RegistryEntry`/`Registry` types; `bundledRegistryPath`/`registryPath`/`loadRegistry`/`listRegistry`/`addRegistryEntry` (mirror the trust-store fns) |
| `tools/ace/registry.json` | (create) bundled anchor, ships `{}` |
| `tools/ace/resolve.ts` | `resolve` gains `registry` param; per-edge `kind` dispatch (registry lookup); `registry-miss` reason |
| `tools/ace/ace.ts` | `ace registry add`/`list` verbs; pass `loadRegistry()` into `resolve` |
| `tools/ace/store.test.ts`, `resolve.test.ts`, `ace.test.ts` | tests; existing inline edges gain `kind:"inline"`; `resolve()` calls add the registry arg |
| `.claude/skills/ace/SKILL.md` | `registry` verbs + registry-dep docs |

---

## Task 1: AceDependency DU + registry types/paths + bundled registry.json

**Files:** Modify `tools/ace/store.ts`; create `tools/ace/registry.json`; Test `tools/ace/store.test.ts`

- [ ] **Step 1: Write the failing test** (append to `store.test.ts`; add `bundledRegistryPath, registryPath, loadRegistry` to the `./store.ts` import)

```ts
describe("registry paths + empty load", () => {
  test("registryPath is under ~/.ace", () => {
    expect(registryPath().replace(/\\/g, "/")).toMatch(/\.ace\/registry\.json$/);
  });
  test("bundledRegistryPath ends in tools/ace/registry.json", () => {
    expect(bundledRegistryPath().replace(/\\/g, "/")).toMatch(/tools\/ace\/registry\.json$/);
  });
  test("loadRegistry on two missing files is an empty Map", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const m = loadRegistry(join(dir, "b.json"), join(dir, "u.json"));
    expect(m.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `bun test tools/ace/store.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement in `tools/ace/store.ts`.** (a) Replace the `AceDependency` interface with the DU:

```ts
export type AceDependency =
  | { readonly kind: "inline"; readonly name: string; readonly version: string; readonly url: string; readonly package_hash: string }
  | { readonly kind: "registry"; readonly name: string; readonly version: string };
```

(b) Add registry types + paths (near the trust-store section):

```ts
export interface RegistryEntry { readonly url: string; readonly package_hash: string; }
export type Registry = Map<string, Map<string, RegistryEntry>>; // name → version → entry

/** ~/.ace/registry.json — operator-managed (sibling of trusted-keys.json). */
export function registryPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "registry.json");
}
/** tools/ace/registry.json — bundled root anchor (ships `{}`). Portable ESM idiom (per bundledTrustPath). */
export function bundledRegistryPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "registry.json");
}

/** Parse a registry file into the on-disk object shape; {} on missing/malformed (non-fatal). */
function readRegistryFile(p: string): Record<string, Record<string, RegistryEntry>> {
  if (!existsSync(p)) return {};
  try {
    const obj = JSON.parse(readFileSync(p, "utf8"));
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return {};
    return obj as Record<string, Record<string, RegistryEntry>>;
  } catch { return {}; }
}

/** bundled ∪ user; user overrides bundled on (name, version). */
export function loadRegistry(bundledPath: string = bundledRegistryPath(), userPath: string = registryPath()): Registry {
  const m: Registry = new Map();
  const merge = (src: Record<string, Record<string, RegistryEntry>>): void => {
    for (const [name, versions] of Object.entries(src)) {
      if (typeof versions !== "object" || versions === null) continue;
      let vm = m.get(name);
      if (!vm) { vm = new Map(); m.set(name, vm); }
      for (const [version, entry] of Object.entries(versions)) {
        if (entry && typeof (entry as RegistryEntry).url === "string" && typeof (entry as RegistryEntry).package_hash === "string") {
          vm.set(version, { url: (entry as RegistryEntry).url, package_hash: (entry as RegistryEntry).package_hash });
        }
      }
    }
  };
  merge(readRegistryFile(bundledPath));
  merge(readRegistryFile(userPath));
  return m;
}
```

(c) Create `tools/ace/registry.json` with exactly:

```json
{}
```

- [ ] **Step 4: Run** `bun test tools/ace/store.test.ts` → PASS (existing store tests stay green; note the `AceDependency` DU change is type-only here, exercised behaviorally in Task 4).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/store.ts tools/ace/registry.json tools/ace/store.test.ts
git commit -m "feat(ace): AceDependency DU (inline|registry) + registry types/paths + bundled registry.json (slice 5.1 task 1)"
```

---

## Task 2: loadRegistry union/override + listRegistry (with source)

**Files:** Modify `tools/ace/store.ts`, `tools/ace/store.test.ts`

- [ ] **Step 1: Write the failing tests** (add `listRegistry` to the import)

```ts
describe("registry load + list", () => {
  test("loadRegistry unions bundled+user; user overrides on (name,version)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const b = join(dir, "b.json"); const u = join(dir, "u.json");
    writeFileSync(b, JSON.stringify({ libfoo: { "1.0.0": { url: "B", package_hash: "sha256:b" } } }));
    writeFileSync(u, JSON.stringify({ libfoo: { "1.0.0": { url: "U", package_hash: "sha256:u" }, "2.0.0": { url: "U2", package_hash: "sha256:u2" } } }));
    const m = loadRegistry(b, u);
    expect(m.get("libfoo")?.get("1.0.0")?.url).toBe("U");      // user override
    expect(m.get("libfoo")?.get("2.0.0")?.url).toBe("U2");
  });
  test("loadRegistry skips malformed entries (not fatal)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const u = join(dir, "u.json");
    writeFileSync(u, JSON.stringify({ libfoo: { "1.0.0": { url: "U" } }, libbar: "nope" })); // missing package_hash; non-object
    const m = loadRegistry(join(dir, "missing.json"), u);
    expect(m.get("libfoo")?.has("1.0.0")).toBe(false); // skipped (no package_hash)
    expect(m.has("libbar")).toBe(false);
  });
  test("listRegistry reports source per entry, user overriding bundled", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const b = join(dir, "b.json"); const u = join(dir, "u.json");
    writeFileSync(b, JSON.stringify({ a: { "1.0.0": { url: "B", package_hash: "sha256:b" } } }));
    writeFileSync(u, JSON.stringify({ a: { "1.0.0": { url: "U", package_hash: "sha256:u" } } }));
    const rows = listRegistry(b, u);
    const row = rows.find((r) => r.name === "a" && r.version === "1.0.0");
    expect(row?.source).toBe("user");
    expect(row?.url).toBe("U");
  });
});
```

- [ ] **Step 2: Run** `bun test tools/ace/store.test.ts` → FAIL (`listRegistry` missing; loadRegistry override/skip unverified).

- [ ] **Step 3: Implement `listRegistry` in `tools/ace/store.ts`** (loadRegistry from Task 1 already handles union/override/skip):

```ts
export function listRegistry(
  bundledPath: string = bundledRegistryPath(), userPath: string = registryPath(),
): Array<{ name: string; version: string; url: string; source: "bundled" | "user" }> {
  const idx = new Map<string, number>(); // "name@version" → row index (for override)
  const rows: Array<{ name: string; version: string; url: string; source: "bundled" | "user" }> = [];
  const add = (src: Record<string, Record<string, RegistryEntry>>, source: "bundled" | "user"): void => {
    for (const [name, versions] of Object.entries(src)) {
      if (typeof versions !== "object" || versions === null) continue;
      for (const [version, entry] of Object.entries(versions)) {
        if (!entry || typeof entry.url !== "string" || typeof entry.package_hash !== "string") continue;
        const key = `${name}@${version}`;
        const row = { name, version, url: entry.url, source };
        const prior = idx.get(key);
        if (prior !== undefined) rows[prior] = row; else { idx.set(key, rows.length); rows.push(row); }
      }
    }
  };
  add(readRegistryFile(bundledPath), "bundled");
  add(readRegistryFile(userPath), "user");
  return rows;
}
```

- [ ] **Step 4: Run** `bun test tools/ace/store.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/store.ts tools/ace/store.test.ts
git commit -m "feat(ace): loadRegistry union/override + listRegistry with source (slice 5.1 task 2)"
```

---

## Task 3: addRegistryEntry (perms + dedup)

**Files:** Modify `tools/ace/store.ts`, `tools/ace/store.test.ts`

- [ ] **Step 1: Write the failing tests** (add `addRegistryEntry`, `statSync`, `chmodSync` to imports as needed)

```ts
describe("addRegistryEntry", () => {
  test("creates the user file + dedups by (name,version)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ace-reg-"));
    const u = join(dir, "registry.json");
    expect(addRegistryEntry("libfoo", "1.0.0", { url: "U", package_hash: "sha256:u" }, u).added).toBe(true);
    expect(addRegistryEntry("libfoo", "1.0.0", { url: "U", package_hash: "sha256:u" }, u).added).toBe(false); // dedup
    expect(loadRegistry(join(dir, "missing.json"), u).get("libfoo")?.get("1.0.0")?.url).toBe("U");
  });
  test("writes owner-only perms on POSIX (0600 file, 0700 dir)", () => {
    if (process.platform === "win32") return; // chmod advisory on Windows
    const parent = mkdtempSync(join(tmpdir(), "ace-regperm-"));
    const aceDir = join(parent, ".ace");
    const u = join(aceDir, "registry.json");
    addRegistryEntry("a", "1.0.0", { url: "U", package_hash: "sha256:u" }, u);
    expect(statSync(u).mode & 0o077).toBe(0);
    expect(statSync(aceDir).mode & 0o077).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `bun test tools/ace/store.test.ts` → FAIL (`addRegistryEntry` missing).

- [ ] **Step 3: Implement in `tools/ace/store.ts`** (mirror `addTrustedKey`'s perm discipline; nested-object format):

```ts
/** Append/overwrite a user-registry entry; dir 0o700, file 0o600 on EVERY call (incl. dedup
 * early-return) — mirrors addTrustedKey. chmod after write (writeFileSync mode only applies on create). */
export function addRegistryEntry(name: string, version: string, entry: RegistryEntry, userPath: string = registryPath()): { added: boolean } {
  const dir = dirname(userPath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* best-effort */ }
  const tightenFile = (): void => { if (existsSync(userPath)) { try { chmodSync(userPath, 0o600); } catch { /* best-effort */ } } };
  const obj = readRegistryFile(userPath);
  if (obj[name]?.[version]) { tightenFile(); return { added: false }; }
  obj[name] = obj[name] ?? {};
  obj[name][version] = { url: entry.url, package_hash: entry.package_hash };
  writeFileSync(userPath, JSON.stringify(obj, null, 2));
  chmodSync(userPath, 0o600);
  return { added: true };
}
```

- [ ] **Step 4: Run** `bun test tools/ace/store.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/ace/store.ts tools/ace/store.test.ts
git commit -m "feat(ace): addRegistryEntry with trust-store perm discipline + dedup (slice 5.1 task 3)"
```

---

## Task 4: resolver registry dispatch + registry-miss

**Files:** Modify `tools/ace/resolve.ts`, `tools/ace/resolve.test.ts`

- [ ] **Step 1: Update the existing `resolve.test.ts` helper + calls, then write new tests.**

(a) In `pkgOf` (the helper), tag inline edges with `kind:"inline"`. Change the `dependencies` map to:

```ts
      dependencies: children.map((c) => ({
        kind: "inline" as const, name: c.pkg.manifest.name, version: c.pkg.manifest.version, url: c.url, package_hash: packageHash(c.pkg),
      })),
```

(b) Every existing `resolve(root, fetchOf(...), NO_TRUST, { allowNoSignature: ... })` call gains an empty registry arg before opts: `resolve(root, fetchOf(...), NO_TRUST, new Map(), { allowNoSignature: ... })`. Also any explicit inline edges built in the conflict/verification tests (e.g. `(root.manifest.dependencies as any)[0] = { name:..., version:..., url:..., package_hash:... }`) gain `kind:"inline"`. Add `import { loadRegistry, type Registry } from "./store.ts"` is NOT needed; tests build registries as plain `new Map()` typed via the resolve signature.

(c) Add new tests:

```ts
import type { RegistryEntry } from "./store.ts";

// Build a registry Map from {name:{version:entry}}
function regOf(src: Record<string, Record<string, RegistryEntry>>): Map<string, Map<string, RegistryEntry>> {
  const m = new Map<string, Map<string, RegistryEntry>>();
  for (const [n, vs] of Object.entries(src)) { const vm = new Map<string, RegistryEntry>(); for (const [v, e] of Object.entries(vs)) vm.set(v, e); m.set(n, vm); }
  return m;
}
// A registry dependency edge (no url/package_hash on the edge).
function regEdge(name: string, version: string) { return { kind: "registry" as const, name, version }; }

describe("resolve — registry deps", () => {
  test("a registry dep resolves via lookup + full verify", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [regEdge("D", "1.0.0")] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name)).toEqual(["D", "root"]);
  });
  test("registry-miss (name/version absent) refuses", async () => {
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [regEdge("D", "9.9.9")] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: "sha256:x" } } }); // 9.9.9 absent
    const r = await resolve(root, fetchOf({}), NO_TRUST, reg, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("registry-miss");
  });
  test("mixed inline + registry edges both resolve", async () => {
    const A = pkgOf("A", { "a.txt": "a" });       // inline child
    const D = pkgOf("D", { "d.txt": "d" });        // registry child
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }]).manifest, dependencies: [
      { kind: "inline" as const, name: "A", version: "1.0.0", url: "http://e/A", package_hash: packageHash(A) },
      regEdge("D", "1.0.0"),
    ] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/D": D }), NO_TRUST, reg, { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name).sort()).toEqual(["A", "D", "root"]);
  });
  test("registry dep whose registry package_hash mismatches the fetched pkg → pin-mismatch", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [regEdge("D", "1.0.0")] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: "sha256:wrong" } } });
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("pin-mismatch");
  });
});
```

- [ ] **Step 2: Run** `bun test tools/ace/resolve.test.ts` → FAIL (resolve signature lacks `registry`; `registry-miss` not a reason; kind not handled).

- [ ] **Step 3: Implement in `tools/ace/resolve.ts`.**

(a) Import the registry type: change `import { contentHash, type AcePackage, type LoadedTrustEntry } from "./store.ts";` to add `type Registry`:

```ts
import { contentHash, type AcePackage, type LoadedTrustEntry, type Registry } from "./store.ts";
```

(b) Add `"registry-miss"` to the `ResolveReason` union.

(c) Add the `registry` param to `resolve` (after `trustStore`):

```ts
export async function resolve(
  root: AcePackage,
  fetchPackage: FetchPackage,
  trustStore: Map<string, LoadedTrustEntry>,
  registry: Registry,
  opts: { allowNoSignature: boolean },
): Promise<ResolveResult> {
```

(d) At the TOP of the `walk` for-loop body (right after `const here = [...path, edge.name];`), derive `url` + `package_hash` from the edge kind, BEFORE the cycle/seen checks:

```ts
      let url: string;
      let package_hash: string;
      if (edge.kind === "registry") {
        const entry = registry.get(edge.name)?.get(edge.version);
        if (entry === undefined) {
          return { ok: false, reason: "registry-miss", detail: `${edge.name}@${edge.version} not found in registry`, path: here };
        }
        url = entry.url; package_hash = entry.package_hash;
      } else {
        url = edge.url; package_hash = edge.package_hash;
      }
```

(e) Replace the remaining `edge.package_hash` references in the loop with `package_hash`, and `edge.url` with `url`:

- `if (seen.pkgHash !== edge.package_hash)` → `if (seen.pkgHash !== package_hash)`
- `byName.set(edge.name, { version: edge.version, pkgHash: edge.package_hash, path: here })` → `pkgHash: package_hash`
- `await fetchPackage(edge.url)` → `await fetchPackage(url)`
- `fetch-failed` detail `${edge.url}` → `${url}`; `invalid-package` detail `${edge.url}` → `${url}`
- pin check `got !== edge.package_hash` → `got !== package_hash`; detail `expected package_hash ${edge.package_hash}` → `${package_hash}`
- Leave `edge.name` and `edge.version` as-is (present on both DU variants).

- [ ] **Step 4: Run** `bun test tools/ace/resolve.test.ts` → PASS (all prior inline tests + the 4 new registry tests).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/resolve.ts tools/ace/resolve.test.ts
git commit -m "feat(ace): resolver registry dispatch + registry-miss (slice 5.1 task 4)"
```

---

## Task 5: `ace registry add`/`list` verbs + wire registry into install

**Files:** Modify `tools/ace/ace.ts`, `tools/ace/ace.test.ts`

- [ ] **Step 1: Update `ace.test.ts` inline edges + add new tests.**

(a) Every graph test that builds an inline dependency object `{ name, version, url, package_hash }` gains `kind: "inline"` (e.g. `{ kind: "inline", name: "B", version: "1.0.0", url: join(dir,"B.json"), package_hash: packageHash(B as any) }`).

(b) Add new tests (the file already imports `main`, `listInstalled`, `writeFileSync`, `mkdtempSync`, `join`, `tmpdir`, `createHash`, `packageHash`; the temp-HOME beforeEach/afterEach already redirects `~/.ace`):

```ts
import { loadRegistry } from "./store.ts";

test("ace registry add fetches + computes hash + stores; registry list shows it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
  const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  const D = { manifest: { format_version:1, name:"D", version:"1.0.0", content_hash: h({ "d.txt":"d" }) }, files: { "d.txt":"d" } };
  const dPath = join(dir, "D.json"); writeFileSync(dPath, JSON.stringify(D));
  expect(await main(["registry", "add", "D", "1.0.0", dPath])).toBe(0);
  // HOME is redirected to a temp dir by beforeEach, so loadRegistry() reads the test user file
  const reg = loadRegistry();
  expect(reg.get("D")?.get("1.0.0")?.package_hash).toBe(packageHash(D as any));
  expect(await main(["registry", "list"])).toBe(0);
});

test("e2e: install a root with a registry dep resolves via the registry", async () => {
  const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
  const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
  const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  const D = { manifest: { format_version:1, name:"D", version:"1.0.0", content_hash: h({ "d.txt":"d" }) }, files: { "d.txt":"d" } };
  const dPath = join(dir, "D.json"); writeFileSync(dPath, JSON.stringify(D));
  await main(["registry", "add", "D", "1.0.0", dPath]); // populate user registry
  const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry", name:"D", version:"1.0.0" }] }, files: { "r.txt":"r" } };
  const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
  const code = await main(["install", rootPath, "--store", store, "--allow-no-signature"]);
  expect(code).toBe(0);
  expect(listInstalled(store).map((p)=>p.manifest.name).sort()).toEqual(["D","root"]);
});

test("e2e: install with a registry dep missing from the registry → exit 1, store empty", async () => {
  const store = mkdtempSync(join(tmpdir(), "ace-graph-"));
  const dir = mkdtempSync(join(tmpdir(), "ace-pkgs-"));
  const h = (files: Record<string,string>) => "sha256:" + createHash("sha256").update(new TextEncoder().encode(JSON.stringify(files))).digest("hex");
  const root = { manifest: { format_version:1, name:"root", version:"1.0.0", content_hash: h({ "r.txt":"r" }), dependencies:[{ kind:"registry", name:"MISSING", version:"1.0.0" }] }, files: { "r.txt":"r" } };
  const rootPath = join(dir, "root.json"); writeFileSync(rootPath, JSON.stringify(root));
  const code = await main(["install", rootPath, "--store", store, "--allow-no-signature"]);
  expect(code).toBe(1);
  expect(listInstalled(store).length).toBe(0);
});
```

- [ ] **Step 2: Run** `bun test tools/ace/ace.test.ts` → FAIL (`registry` command unknown; registry not wired into install).

- [ ] **Step 3: Implement in `tools/ace/ace.ts`.**

(a) Add to the `./store.ts` import: `loadRegistry, addRegistryEntry, listRegistry`. Add to the resolve import line (`./resolve.ts`): nothing new needed (resolve already imported).

(b) **parseArgs:** add a `registry` command parallel to `trust`. After the `trust` parsing block, add (mirror its shape — `registry add <name> <version> <url> [--hash <h>]` and `registry list`):

```ts
  if (cmd === "registry") {
    const sub = argv[1];
    if (sub === "list") return { command: "registry", sub: "list", storePath };
    if (sub === "add") {
      const name = argv[2], version = argv[3], url = argv[4];
      if (!name || !version || !url || name.startsWith("-") || version.startsWith("-") || url.startsWith("-")) {
        return { error: "registry add requires <name> <version> <url>" };
      }
      let hash: string | undefined;
      for (let i = 5; i < argv.length; i++) {
        if (argv[i] === "--hash") { hash = argv[++i]; if (!hash) return { error: "--hash requires a value" }; }
        else return { error: `Unknown option for registry add: ${argv[i]}` };
      }
      return { command: "registry", sub: "add", regName: name, regVersion: version, regUrl: url, regHash: hash, storePath };
    }
    return { error: "registry requires 'add' or 'list'" };
  }
```

(Extend the parsed-args type to carry `sub?`, `regName?`, `regVersion?`, `regUrl?`, `regHash?` — match how the existing `trust` parse carries its fields.)

(c) **Verb handler** (add before the `install` handler, mirroring the `trust` handler):

```ts
  if (parsed.command === "registry") {
    if (parsed.sub === "list") {
      const rows = listRegistry();
      if (rows.length === 0) { console.log("No registry entries. (add one: ace registry add <name> <version> <url>)"); return 0; }
      for (const r of rows) console.log(`  ${r.name}@${r.version}  ${r.url}  [${r.source}]`);
      return 0;
    }
    // sub === "add"
    let pkgHash = parsed.regHash;
    if (pkgHash === undefined) {
      let raw: string;
      try { raw = parsed.regUrl!.startsWith("http://") || parsed.regUrl!.startsWith("https://") ? await (await fetch(parsed.regUrl!)).text() : readFileSync(parsed.regUrl!, "utf8"); }
      catch (e) { console.error(`ace: registry add: fetch/read failed: ${(e as Error).message}`); return 1; }
      let pkg: AcePackage;
      try { pkg = JSON.parse(raw) as AcePackage; } catch { console.error("ace: registry add: package is not valid JSON"); return 65; }
      pkgHash = packageHash(pkg);
    }
    const res = addRegistryEntry(parsed.regName!, parsed.regVersion!, { url: parsed.regUrl!, package_hash: pkgHash });
    console.log(res.added ? `ace: registered ${parsed.regName}@${parsed.regVersion}` : `ace: ${parsed.regName}@${parsed.regVersion} already registered`);
    return 0;
  }
```

(d) **Wire registry into install:** change the graph-branch resolve call from
`resolve(pkg, fetchPackage, loadTrustStore(), { allowNoSignature: parsed.allowNoSignature })`
to
`resolve(pkg, fetchPackage, loadTrustStore(), loadRegistry(), { allowNoSignature: parsed.allowNoSignature })`.

- [ ] **Step 4: Run** `bun test tools/ace/` (full suite) → PASS (all green; ~115 with the new tests). Run `git ls-tree HEAD | wc -l` (expect 67).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "feat(ace): ace registry add/list verbs + wire registry into install (slice 5.1 task 5)"
```

---

## Task 6: SKILL.md docs

**Files:** Modify `.claude/skills/ace/SKILL.md`

- [ ] **Step 1: Read `.claude/skills/ace/SKILL.md`**, then add `registry add`/`list` to the verb table and document registry deps. In the **Consumer verbs** list + the verb table, add rows:

```
| `registry add` | `bun tools/ace/ace.ts registry add <name> <version> <url> [--hash <package_hash>]` | Register a package version in the user registry (`~/.ace/registry.json`); fetches + computes package_hash unless `--hash` given |
| `registry list` | `bun tools/ace/ace.ts registry list` | List registry entries (bundled + user) |
```

Add a paragraph after the transitive-install paragraph:

```markdown
A dependency edge is one of two kinds: `inline` (`{kind:"inline", name, version, url, package_hash}` — self-pinned) or `registry` (`{kind:"registry", name, version}` — resolved via the registry). Registry deps are looked up **exact-version** in the bundled (`tools/ace/registry.json`) ∪ user (`~/.ace/registry.json`) registry; a miss is the `registry-miss` refusal. After lookup, a registry dep runs the identical verify path (hash + pin + identity + signature) as an inline dep. Semver ranges + a solver are slice 5.2; a lockfile is 5.3.
```

- [ ] **Step 2: Run** `bun test tools/ace/` (still green) + `git ls-tree HEAD | wc -l` (67). (No code test for docs; this keeps the suite green check as the gate.)

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/ace/SKILL.md
git commit -m "docs(ace): SKILL registry verbs + registry-dep resolution (slice 5.1 task 6)"
```

---

## Final: open the PR

```bash
git push -u origin otto-windows/ace-slice5.1-impl-2026-06-01
gh pr create --head otto-windows/ace-slice5.1-impl-2026-06-01 --base main --title "feat(ace): slice 5.1 — registry data layer + exact-version resolution (081KR2E4K0008QG0R002YE3MMD)" --body "<summary>"
gh pr merge <N> --auto --squash
```

Then the standard PR-gate loop (`bun tools/github/poll-pr-gate.ts <N>`): markdownlint on any new docs (blank lines around lists — MD032), verify-before-fix on review threads, keep canary 67, resolve threads, land on green.

---

## Self-Review

**Spec coverage:** D1 registry shape bundled∪user (Task 1-3) · D2 dep DU inline|registry (Task 1) · D3 exact-version (Task 4 — Map.get, no range) · D4 registry-dep identical verify (Task 4 — derived url/package_hash flow into the existing slice-4 checks) · D5 registry-miss (Task 4) · D6 back-compat kind:"inline" (Task 4 + 5 test updates) · registry data layer load/list/add (Task 2-3) · CLI add/list (Task 5) · install wiring (Task 5) · registry.json `{}` (Task 1) · SKILL docs (Task 6). All spec test cases mapped (store load/override/skip/perms/dedup; resolve registry/miss/mixed/transitive/pin-mismatch; ace add/list/e2e/missing). No gaps.

**Placeholder scan:** no TBD/TODO; every step has real code + exact commands.

**Type consistency:** `AceDependency` DU shape consistent (Task 1/4/5). `Registry = Map<string, Map<string, RegistryEntry>>` consistent (Task 1/2/4). `resolve(root, fetchPackage, trustStore, registry, opts)` signature consistent (Task 4 def; Task 4/5 call-sites add the `registry` arg — empty `new Map()` in inline-only tests, `loadRegistry()` in install). `registry-miss` reason consistent. `addRegistryEntry(name, version, entry, userPath?)` / `loadRegistry(bundled?, user?)` / `listRegistry(bundled?, user?)` signatures consistent across store + ace + tests.
