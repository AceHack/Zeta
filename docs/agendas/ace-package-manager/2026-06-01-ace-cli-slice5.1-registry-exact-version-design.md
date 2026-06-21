# Ace CLI slice 5.1 — registry data layer + exact-version resolution (design)

- **Date:** 2026-06-01
- **Slice:** 5.1 (registry data layer + exact-version lookup) — first sub-slice of slice 5 (registry + semver)
- **Status:** approved (the operator 2026-06-01) — spec for implementation
- **Builds on:** slice 4 (inline-URL transitive resolution: `resolve.ts` identity-keyed DFS + verify + atomic install; `store.ts` store + trust store)
- **Agenda:** `docs/agendas/ace-package-manager/AGENDA.md` (lifecycle stages distribute → discover)
- **Backlog:** 081KR2E4K0008QG0R002YE3MMD

## Goal

A manifest dependency can name a package by `name + version` and let a **registry**
supply its location + integrity pin, instead of inline-pinning `url` + `package_hash`.
`ace install` resolves such registry deps by looking them up (exact version) in a
local registry, then runs the **identical** slice-4 verify + atomic-install path.

This is sub-slice **5.1 of 5**. It is the *lower half* of the registry — the data
layer + exact-version lookup — with **no semver ranges and no constraint solver**
(those are 5.2). Just as slice 4 was the lower half of dependency resolution
(the inline-pinned graph a solver eventually outputs), 5.1 is the registry's data
layer that the 5.2 solver eventually populates.

## Decomposition of slice 5 (the operator 2026-06-01)

| Sub-slice | Scope |
|---|---|
| **5.1 (this spec)** | registry data layer (bundled ∪ user, local) + **exact-version** lookup |
| 5.2 | semver ranges (`^1.2.0`) + constraint **solver** |
| 5.3 | lockfile (pin the solved graph) |
| deferred | remote registry (network fetch + caching + offline + staleness) |

## Decisions (this spec locks them)

| # | Decision | Choice |
|---|---|---|
| D1 | Registry shape | **Bundled ∪ user, LOCAL** — `tools/ace/registry.json` (ships `{}`) ∪ `~/.ace/registry.json`, mirroring the trust store's `bundledTrustPath ∪ trustStorePath` union. Remote = deferred. |
| D2 | Dep edge shape | **Explicit discriminated union** — `{kind:"inline", …}` \| `{kind:"registry", name, version}` (per the implicit-not-explicit-in-DUs rule). |
| D3 | Version match | **Exact only** — `registry[name][version]` exact key lookup. Ranges (`^1.2.0`) = 5.2. |
| D4 | Registry-dep verification | **Identical to inline** — after lookup fills `{url, package_hash}`, run the exact slice-4 path (slice-2 files hash + `package_hash` pin + declared-identity + slice-3 signature gate). |
| D5 | Registry-miss | New `registry-miss` refusal when `registry[name][version]` is absent. |
| D6 | Back-compat | Slice-4 inline deps gain `kind:"inline"`. Zero real `.ace` packages with deps exist (verified), so this is a pre-release type change touching tests + spec only — no migration. |

## Manifest dep DU (`tools/ace/store.ts`)

`AceDependency` becomes a discriminated union:

```ts
export type AceDependency =
  | { readonly kind: "inline"; readonly name: string; readonly version: string;
      readonly url: string; readonly package_hash: string }
  | { readonly kind: "registry"; readonly name: string; readonly version: string };
```

(`AceManifest.dependencies?: ReadonlyArray<AceDependency>` is unchanged in shape.)
An `inline` edge carries its own location + pin (slice-4 behaviour). A `registry`
edge carries only identity; the resolver fills `url` + `package_hash` from the
registry.

## Registry data layer (`tools/ace/store.ts`, mirrors the trust store)

On-disk format (both bundled + user files):

```jsonc
{
  "libfoo": {
    "1.2.0": { "url": "https://…/libfoo-1.2.0.json", "package_hash": "sha256:…" },
    "1.3.0": { "url": "https://…/libfoo-1.3.0.json", "package_hash": "sha256:…" }
  }
}
```

```ts
export interface RegistryEntry { readonly url: string; readonly package_hash: string; }
export type Registry = Map<string, Map<string, RegistryEntry>>; // name → version → entry

/** tools/ace/registry.json — bundled root anchor (ships `{}`). */
export function bundledRegistryPath(): string;   // mirrors bundledTrustPath()
/** ~/.ace/registry.json — operator-managed. */
export function registryPath(): string;          // mirrors trustStorePath()
/** bundled ∪ user; user overrides bundled on (name, version). */
export function loadRegistry(bundledPath?: string, userPath?: string): Registry;
/** Append/overwrite a user-registry entry; dir 0700, file 0600, dedup by (name,version). */
export function addRegistryEntry(name: string, version: string, entry: RegistryEntry, userPath?: string): { added: boolean };
```

`tools/ace/registry.json` ships as `{}` (empty bundled anchor — exactly like
`trusted-keys.json` ships `[]`). `loadRegistry` reuses the read/merge discipline
of `loadTrustStore` (malformed entries skipped, not fatal).

## Resolver (`tools/ace/resolve.ts`)

`resolve` gains an injected `registry` parameter (positioned after `trustStore`),
keeping the same injected-boundary testability as `fetchPackage`/`trustStore`:

```ts
export async function resolve(
  root: AcePackage,
  fetchPackage: FetchPackage,
  trustStore: Map<string, LoadedTrustEntry>,
  registry: Registry,
  opts: { allowNoSignature: boolean },
): Promise<ResolveResult>;
```

`ResolveReason` gains `"registry-miss"`.

Per-edge, at the top of the dependency loop, derive `{url, package_hash}` from the
edge kind **before** the existing cycle/dedup/skew/tamper/verify logic (which is
otherwise unchanged — it already keys on `name`, `version`, `package_hash`):

```ts
    let url: string;
    let package_hash: string;
    if (edge.kind === "registry") {
      const entry = registry.get(edge.name)?.get(edge.version);
      if (entry === undefined) {
        return { ok: false, reason: "registry-miss",
                 detail: `${edge.name}@${edge.version} not found in registry`, path: here };
      }
      url = entry.url; package_hash = entry.package_hash;
    } else { // kind === "inline"
      url = edge.url; package_hash = edge.package_hash;
    }
    // …existing slice-4 logic, now using `url` + `package_hash` (instead of edge.url/edge.package_hash):
    //   cycle (visiting) → dedup/skew/tamper (byName keyed on name, package_hash) →
    //   fetch(url) → slice-2 self-hash → pin (packageHash(dep) === package_hash) →
    //   identity (dep.manifest.name/version === edge.name/version) → slice-3 signature gate
```

Registry deps are transitive automatically: a registry-dep's fetched package may
itself declare `registry` edges → the same `registry` param resolves them on
recursion. The exact-version lookup is a plain `Map` get — no range logic (5.2).

## CLI (`tools/ace/ace.ts`)

- `ace registry add <name> <version> <url> [--hash <package_hash>]` — if `--hash`
  given, store it directly; else fetch the package at `url`, compute `packageHash`,
  and store `{url, package_hash}` to `~/.ace/registry.json` (dir 0700, file 0600,
  dedup by name+version — mirrors `ace trust add`).
- `ace registry list` — list all `name@version → url` entries with source
  (bundled | user), mirroring `ace trust list`.
- `install` passes `loadRegistry()` into `resolve()`. No new install flag; a
  manifest with registry deps just resolves through the registry.

## → 5.2 (captured, out of scope here)

Semver ranges (`^1.2.0`, `~1.2.0`, comparators) + a constraint **solver** across
the transitive graph. Per the operator 2026-06-01:

- **Z3-SMT is a strong candidate** — encode each package's candidate versions as
  an integer var, ranges as constraints, "prefer newest" as a maximize objective;
  Z3 already ships in the repo (formal-verification stack) → no new dep, and it
  sidesteps hand-rolling the backtracking that is the buggiest part of npm/pip/yarn.
- **Differential-test the solver against a reference** (per the operator: "even if
  we write our own solver we should test it against existing ones") — the
  `bcl-interface-boundary` differential-test trick (own impl + a library-backed
  adapter behind a flag, tested against each other on shared constraint-graph
  fixtures), exactly as the Rust observe oracle (081KSXN940008QG0R0033T2BQT/.29, PRs #6255/#6257)
  differential-tested our own `ZetaJsonParser` against a `serde_json`-backed
  adapter behind the `serde` feature flag.
- **Pulling in a vetted solver library is on the table** if the problem proves
  hard (per BCL soft-exception: provenance-vetted + widely-used, behind our port).

**→ 5.3:** lockfile (pin the solved graph). **Deferred:** remote registry.

## Out of scope (explicit)

No semver ranges, no solver (5.2). No lockfile (5.3). No remote registry / caching
/ staleness (deferred). No multiple-versions-of-same-name (still strict one-name →
one-version per graph, inherited from slice 4 — exact-version registry deps don't
change that).

## Testing

**`store.test.ts`:**

- `loadRegistry` unions bundled + user; user overrides bundled on (name, version)
- `loadRegistry` skips malformed entries (not fatal)
- `addRegistryEntry` creates the user file + dedups by (name, version); POSIX perms 0600 file / 0700 dir; corrects a pre-existing permissive file
- registry JSON round-trips (name → version → {url, package_hash})

**`resolve.test.ts`** (injected in-memory registry + fetch):

- a `registry` dep resolves: lookup → fetch → full slice-4 verify → installs
- `registry-miss` (name or version absent) → `registry-miss` refuse
- mixed graph: one `inline` edge + one `registry` edge → both resolve
- transitive registry deps (registry-dep whose package declares its own registry-dep) → full graph resolves
- a registry dep whose looked-up `package_hash` mismatches the fetched package → `pin-mismatch` (verification still applies post-lookup)
- exact-version: `registry` dep at a version NOT in the registry (even if a *different* version is present) → `registry-miss` (no range fallback)

**`ace.test.ts`** (temp HOME + temp pkg files):

- `ace registry add <name> <version> <url>` fetches + computes hash + stores; `registry list` shows it
- `ace registry add … --hash <h>` stores without fetching
- e2e: install a root with a `registry` dep, registry populated → both installed
- e2e: install with a `registry` dep missing from the registry → exit non-zero, store empty (atomic)

## Files

| File | Change |
|---|---|
| `tools/ace/store.ts` | `AceDependency` → DU (`inline`\|`registry`); add `RegistryEntry`/`Registry`, `bundledRegistryPath`/`registryPath`/`loadRegistry`/`addRegistryEntry` |
| `tools/ace/resolve.ts` | `resolve` gains `registry` param; per-edge kind dispatch (registry lookup → `url`+`package_hash`); add `registry-miss` reason |
| `tools/ace/ace.ts` | `ace registry add`/`list` verbs; pass `loadRegistry()` into `resolve` in `install`; slice-4 inline edges constructed with `kind:"inline"` |
| `tools/ace/registry.json` | **new** — bundled anchor, ships `{}` |
| `tools/ace/store.test.ts` | registry load/add tests |
| `tools/ace/resolve.test.ts` | registry-dep + registry-miss + mixed/transitive tests; existing inline edges gain `kind:"inline"` |
| `tools/ace/ace.test.ts` | `registry add`/`list` + e2e registry-install tests; existing inline edges gain `kind:"inline"` |
| `.claude/skills/ace/SKILL.md` | document `registry add`/`list` + registry-dep resolution + `registry-miss` |
