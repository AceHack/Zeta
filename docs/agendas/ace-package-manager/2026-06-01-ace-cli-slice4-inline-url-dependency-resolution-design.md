# Ace CLI slice 4 — inline-URL transitive dependency resolution (design)

- **Date:** 2026-06-01
- **Slice:** 4 (dependency resolution)
- **Status:** approved (the human maintainer 2026-06-01) — spec for implementation
- **Builds on:** slice 1 (content-addressed store), slice 2 (content-hash integrity), slice 3 (Ed25519 authenticity)
- **Agenda:** `docs/agendas/ace-package-manager/AGENDA.md` (lifecycle stages distribute → discover → verify → grow)
- **Backlog:** 081KR2E4K0008QG0R002YE3MMD

## Goal

A package manifest may declare dependencies on other packages. `ace install`
resolves the full transitive dependency graph, fetches and verifies every node
(reusing the slice-2 content-hash gate and the slice-3 signature gate), and
installs in dependency order (leaves first, root last).

This slice uses the **inline-URL** resolution model: each dependency edge
carries its own resolved location and integrity pin. There is **no registry and
no version solving** — those are slice 5. The inline-pinned graph this slice
resolves is exactly the shape a future registry resolver produces *after*
solving, so slice 4 is the lower half of the registry design, not a throwaway
detour.

## Decisions (this spec locks them)

| # | Decision | Choice |
|---|---|---|
| D1 | Resolution model | **Inline-URL** — dependency edges carry `{name, version, url, package_hash}`. Registry + semver = slice 5. |
| D2 | Graph shape | **Recursive / transitive** — a fetched dependency is itself a full package with its own `dependencies`; resolution recurses. |
| D3 | Version skew (same name, different version, in one graph) | **Strict-refuse** — hard error, install nothing. One name → one version per install graph. Easiest to relax later behind a flag. |
| D4 | Same name + same version + different `package_hash` | **Always hard-refuse** (`tamper`) — two different packages cannot both be that declared identity. |
| D5 | Diamond (same name + same version + same `package_hash` via multiple paths) | **Dedup** — visit/install once. Identical `package_hash` ⇒ byte-identical package (manifest+signature+files), so the already-verified node is safe to reuse. |
| D6 | Atomicity | **Resolve+verify the whole graph, THEN preflight every node's file-path safety + store-key uniqueness, THEN extract.** Any resolution / verification / preflight failure → install nothing. |
| D7 | Lockfile | **None this slice.** The manifest's inline pins already *are* the transitive lock. (Lockfile becomes relevant in slice 5, where a solver's output needs pinning.) |
| D8 | Signature policy | Per-node slice-3 gate. A present-but-bad / untrusted / unsupported-algo signature on **any** node hard-refuses always. `--allow-no-signature` applies **graph-wide** and only permits nodes that carry **no** signature. |

## Manifest extension

`AceManifest` gains one optional field (in `tools/ace/store.ts`):

```ts
export interface AceDependency {
  readonly name: string;         // identity — skew detection + error messages
  readonly version: string;      // identity — skew detection + error messages
  readonly url: string;          // where to fetch the dependency package (http(s) or path)
  readonly package_hash: string; // integrity pin — sha256 of the canonical FULL package
                                 // (manifest incl. signature + files), NOT files-only.
}

export interface AceManifest {
  readonly format_version: number;
  readonly name: string;
  readonly version: string;
  readonly content_hash: string;   // slice-2: sha256(files) — the package's OWN files hash (unchanged)
  readonly description?: string;
  readonly signature?: { readonly algo: string; readonly key_id: string; readonly sig: string };
  readonly dependencies?: ReadonlyArray<AceDependency>;   // NEW — absent = leaf
}
```

Absent `dependencies` ⇒ leaf package ⇒ **existing single-package installs are
byte-for-byte unaffected** (back-compat).

**Two distinct hashes, two distinct jobs** (this separation closes the dedup
hole — see the Algorithm note):

- `manifest.content_hash` = `sha256(files)` — the package's *own* slice-2 files
  hash. A package self-verifies its files against it. Unchanged from slice 2.
- `AceDependency.package_hash` = `sha256` of the canonical JSON of the **entire
  package** (`{manifest, files}`, manifest including its `signature` field) —
  the *parent's* pin on a *specific, whole* dependency. Canonicalization is the
  recursive key-sort already used in slice 3 (applied here to the whole package,
  signature **included**, since the signature is part of the package's identity).

Pinning the **whole package** (not files-only) means two dependency edges that
share a `package_hash` are provably byte-identical — same `dependencies`, same
`signature`, same files — so deduping the second is safe. A files-only pin could
not distinguish two packages that ship identical files but differ in their
manifest (deps/signature).

## Resolver — `tools/ace/resolve.ts` (new, pure)

A pure module with the fetch boundary **injected**, so tests run fully in-memory
and production wires in `fetch` / `readFileSync`.

```ts
// Injected fetch: given a dependency URL/path, return the raw package JSON text.
export type FetchPackage = (urlOrPath: string) => Promise<string>;

export type ResolveResult =
  | { ok: true; order: ReadonlyArray<AcePackage> }   // topo order, leaves first, root last
  | { ok: false; reason: ResolveReason; detail: string; path: ReadonlyArray<string> };

export type ResolveReason =
  | "version-skew"        // D3: same name, two versions in the graph
  | "tamper"              // D4: same name+version, different package_hash
  | "pin-mismatch"        // fetched package's hash/identity != the edge's declared pin
  | "bad-content-hash"    // slice-2: dep files do not hash to its manifest.content_hash
  | "bad-signature"       // slice-3: present signature fails verification
  | "untrusted-key"       // slice-3: signature by a key not in the trust store
  | "unsupported-algo"    // slice-3: signature.algo !== "ed25519"
  | "no-signature"        // node carries no signature and --allow-no-signature not given
  | "cycle"               // back-edge in the dependency graph
  | "fetch-failed"        // url/path could not be fetched or parsed as a package
  | "invalid-package";    // fetched JSON is not a well-formed AcePackage

export async function resolve(
  root: AcePackage,
  fetchPackage: FetchPackage,
  trustStore: Map<string, LoadedTrustEntry>,
  opts: { allowNoSignature: boolean },
): Promise<ResolveResult>;
```

### Algorithm

Dedup, skew, tamper, and cycle detection key on **package identity = `name`**;
the **`package_hash`** (whole-package hash) is the tamper/dedup discriminator
within a name. `content_hash` (files-only) is never the dedup key — two distinct
packages can ship identical files, so a files-only key would wrongly dedup the
second and skip its manifest, transitive deps, and signature check.

1. **Seed with the root** before walking — so skew / tamper / cycles that involve
   the root itself are caught (e.g. `root@1 → A → root@2` is skew;
   `root@1 → A → root@1` is a cycle):
   - `byName: Map<name, {version, package_hash, path}>` ← `{ root.name: {root.version, hash(root), path: ["root"]} }`
   - `visiting: Set<name>` ← `{ root.name }` — current DFS stack, for cycle detection
   - `order: AcePackage[]` ← `[]` — filled post-order; root appended last
   - `path: string[]` — human-readable dependency path for error messages (`root → A → D`)
2. DFS the current node's `dependencies`. For each edge `{name, version, url, package_hash}`, in this order:
   - **Cycle:** if `name ∈ visiting` → `cycle` (detail lists the loop via `path`).
   - **Else if `name ∈ byName`** (already resolved, not on the current stack):
     - different `version` → `version-skew` (detail cites the first requirer via `byName[name].path` and the current `path`)
     - same `version`, different `package_hash` → `tamper`
     - same `version`, same `package_hash` → **diamond dedup**: skip (already resolved + fully verified; identical `package_hash` ⇒ byte-identical ⇒ no re-fetch, no recurse)
   - **Else (new identity)** — fetch via `fetchPackage(url)`:
     - fetch/parse failure → `fetch-failed` / `invalid-package`
     - **slice-2 self-check:** `contentHash(JSON.stringify(dep.files)) === dep.manifest.content_hash` else `bad-content-hash`
     - **pin check:** `packageHash(dep) === edge.package_hash` else `pin-mismatch` (the fetched whole package must be exactly what the parent pinned)
     - **identity check:** `dep.manifest.name === name && dep.manifest.version === version` else `pin-mismatch`
     - **slice-3 gate** (`verifySignature(dep.manifest, trustStore)`): `no-signature` → refuse unless `allowNoSignature`; `bad-signature` / `untrusted-key` / `unsupported-algo` → refuse **always**
     - record `byName[name] = {version, package_hash, path: [...path, name]}` (the first-seen requirer path, so skew/tamper can name BOTH requirers); add `name` to `visiting`; recurse into `dep.manifest.dependencies`; on return, remove `name` from `visiting` and append the package to `order` (post-order ⇒ leaves first)
3. On success, append the root to `order` last and return it (leaves first, root last).

`packageHash(pkg)` = `sha256` of the canonical (recursive key-sorted) JSON of the
whole `{manifest, files}` (signature included). The resolver verifies; it does
**not** touch the filesystem store (that stays `installPackage`'s job).

## Install integration — `tools/ace/ace.ts`

`install` becomes:

1. Read/fetch the **root** package (unchanged from slice 3).
2. Verify the root's own integrity + signature (unchanged slice 2/3 gates).
3. If `root.manifest.dependencies` is absent/empty → install the single package exactly as today (no behavior change for leaf packages).
4. Else call `resolve(root, fetchPackage, loadTrustStore(), {allowNoSignature})`:
   - `ok:false` → print `reason`, `detail`, and the dependency `path`; **exit non-zero; install nothing** (atomic — D6).
   - `ok:true` → **preflight**: run the file-path safety validation `installPackage` does (reject `..` / absolute / backslash paths) for **every** node in `order` *without writing*; if any node fails → print the offending node + path; **exit non-zero; install nothing**. It also rejects a store-key collision — two nodes sharing a content_hash (the store directory key) but differing in package_hash (identity) → refuse store-collision; the content-addressed store keys by files-hash and cannot hold two distinct packages with identical files (re-keying the store by package identity is a possible slice-5+ evolution, out of scope here). Only once every node passes preflight, `installPackage(storePath, node)` each node in `order` (leaves first, root last).
5. Print the resolved set on success: `installed 3: D@1.0, A@2.1, root@1.0`.

The preflight closes the graph-atomicity gap: without it, `resolve` could succeed
yet a later `installPackage` fail on an unsafe path *after* earlier nodes were
already extracted, leaving a partial graph. The `slice-2` path validation is
factored into a shared `validatePackagePaths(pkg): string | null` helper that both
the preflight loop and `installPackage` call, so the two never drift.

`fetchPackage` for production: the same source-handling `install` already uses for
the root — `fetch(url).text()` for http(s), `readFileSync` for a path.

## CLI / UX

- `ace install <url-or-path>` — resolves transitively, **no new flag** for the happy path.
- `--allow-no-signature` — unchanged flag, now **graph-wide**: permits *unsigned* nodes anywhere in the graph; never bypasses a present-but-bad/untrusted signature on any node.
- Refusal output names the offending node, the reason, and the dependency path to it. Examples:
  - `version-skew: D required at 1.0 (via root → A) and 2.0 (via root → B) — align on one version`
  - `cycle: root → A → B → A`
  - `pin-mismatch: root → A expected D package_hash sha256:abc… but fetched sha256:def…`
  - `untrusted-key: root → A → D signed by ed25519:… which is not trusted — run: ace trust add <pub-file-or-b64>`
- Exit codes unchanged: `0` ok · `64` usage · `65` invalid package JSON · `1` refused (any resolution/verification/preflight failure).

## Out of scope (explicit)

Deferred to **slice 5** (registry): a name→version→url registry (bundled ∪ user ∪
remote), semver range constraints (`^1.2.0`), version solving, a lockfile, and
multiple-versions-of-same-name. Deferred indefinitely unless needed: remote
registry caching/signing; per-node signature-policy granularity.

## Testing

**`resolve.test.ts`** (pure, injected in-memory fetch):

- linear chain (root → A → B) installs in order B, A, root
- diamond dedup (root → A → D, root → B → D, same D name+version+package_hash) visits/installs D once
- distinct packages with identical files but different manifests (same `content_hash`, different `package_hash`) are NOT deduped — both resolve + recurse + sig-check (the P1 hole)
- version-skew (A → D@1.0, B → D@2.0) → `version-skew` refuse
- same-version-different-package_hash (A → D@1.0/hashX, B → D@1.0/hashY) → `tamper` refuse
- root-involving skew (root@1 → A → root@2) → refused (root is seeded)
- root cycle (root@1 → A → root@1) → `cycle` refuse (root is seeded into `visiting`)
- cycle (A → B → A) → `cycle` refuse with the loop in `path`
- pin-mismatch (edge package_hash ≠ fetched package hash) → `pin-mismatch` refuse
- declared-identity mismatch (edge name/version ≠ fetched manifest name/version) → `pin-mismatch` refuse
- bad-content-hash (dep files don't hash to its manifest) → `bad-content-hash` refuse
- untrusted-key / bad-signature node → refuse always (even with `allowNoSignature`)
- unsigned node + `allowNoSignature:false` → `no-signature` refuse; `true` → resolves
- deep graph topo-order correctness (multi-level, verify full leaf-first order)
- leaf package (no `dependencies`) → resolves to `[root]` (back-compat)

**`ace.test.ts`** (extend; temp store + temp dep files):

- e2e install of a small graph → all nodes present in store, in order
- resolver-refuse (a bad node mid-graph) → store left **empty**
- **preflight-refuse**: a graph where a non-first node has an unsafe file path (passes hash + signature, fails path safety) → store left **empty** (nothing extracted)
- **store-collision-refuse**: a graph with two distinct packages sharing content_hash but different package_hash → install refuses store-collision; store left **empty**
- `--allow-no-signature` permits an unsigned graph end-to-end

## Files

| File | Change |
|---|---|
| `tools/ace/resolve.ts` | **new** — pure transitive resolver + `packageHash` helper |
| `tools/ace/resolve.test.ts` | **new** — resolver tests |
| `tools/ace/store.ts` | extend `AceManifest` with `dependencies?`; export `AceDependency`; factor `validatePackagePaths(pkg)` out of `installPackage` (shared with the install preflight) |
| `tools/ace/ace.ts` | wire `resolve` into `install`; graph preflight; graph-wide `--allow-no-signature`; resolved-set output |
| `tools/ace/ace.test.ts` | extend — e2e graph install + resolver-refuse + preflight-refuse + store-collision-refuse + unsigned-graph |
| `.claude/skills/ace/SKILL.md` | document transitive install + the new refusal reasons |
