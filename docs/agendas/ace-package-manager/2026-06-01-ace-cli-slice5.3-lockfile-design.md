# Ace CLI slice 5.3 — lockfile (design)

> Spec for slice 5.3 of the Ace DLC package manager (081KR2E4K0008QG0R002YE3MMD). Builds directly on
> slice 5.1 (registry data layer, merged PR #6369) and slice 5.2 (semver ranges +
> version solver, merged PRs #6388 + #6391). Brainstormed + decided with the
> operator 2026-06-01.

## Goal

Persist the **solved + pinned** dependency graph to a lockfile so a subsequent
install is **deterministic, registry-independent, and byte-reproducible**. A normal
`ace install` solves fresh and writes the lock; an `ace install --frozen` reads the
lock, skips solving entirely, and installs exactly the locked graph — verifying every
node against the locked hashes — without ever consulting the registry.

## Decomposition of slice 5 (recap)

- **5.1** (done, #6369): registry data layer + exact-version lookup.
- **5.2** (done, #6388 + #6391): semver ranges + solver → concrete versions → 5.1 engine.
- **5.3** (this spec): lockfile — persist the solved+pinned graph; replay it under `--frozen`.

## Decisions (this spec locks them; operator 2026-06-01)

1. **Workflow = cargo-style write + opt-in frozen-read.** A normal `ace install`
   **always solves fresh** and writes/refreshes the lockfile after a successful
   install. `--frozen` instead **reads** the lock, **skips solving**, installs
   exactly the locked graph, and **fails on drift**. Default behavior is unchanged;
   reproducibility is opt-in.
2. **Location = `./ace.lock` in CWD, `--lockfile <path>` override.** cargo-consistent
   (Cargo.lock sits in the project dir). No global state. Write and `--frozen`-read
   both resolve the same path.
3. **Content = full pin (`name` + `version` + `url` + `package_hash`) per node.**
   `--frozen` fetches the locked `url`, verifies bytes against the locked
   `package_hash` (+ `content_hash` + signature), and does **not** consult the
   registry. Registry-independent, byte-reproducible, tamper-evident — the actual
   lockfile guarantee (cargo/npm pin url + integrity).

## Lockfile format

JSON, written through the existing canonical-JSON discipline (deterministic key
ordering — `canonicalJson` in `resolve.ts`, **exported** by this slice for reuse;
see Components). Nodes are emitted in **install order** (deps-first), which is
deterministic because slice-5.2 solve + slice-5.1 resolve are deterministic
(newest-first, sorted) — so re-locking the same input yields a byte-identical file.

```json
{
  "format_version": 1,
  "root": { "name": "myapp", "version": "1.0.0", "package_hash": "sha256:…" },
  "nodes": [
    { "name": "leaf",  "version": "1.0.0", "url": "https://…/leaf-1.0.0.json",  "package_hash": "sha256:…" },
    { "name": "mid",   "version": "2.3.0", "url": "https://…/mid-2.3.0.json",   "package_hash": "sha256:…" }
  ]
}
```

- `format_version`: `1`. A lock with any other value is a hard refusal under `--frozen`
  (forward-compat guard; no silent migration this slice).
- `root`: identity of the root artifact the lock was generated from — the **drift gate**
  for `--frozen` (see §Frozen). `package_hash` = `packageHash(root)`.
- `nodes`: every resolved **dependency** node (root excluded — it is the input, not a
  locked dependency), each fully pinned. Covers both registry-solved and inline nodes
  (an inline node's `url` + `package_hash` come from its edge).

## Components

### `tools/ace/lockfile.ts` (new — pure, no I/O)

- `type LockNode = { name: string; version: string; url: string; package_hash: string }`
- `type Lockfile = { format_version: 1; root: { name: string; version: string; package_hash: string }; nodes: LockNode[] }`
- `buildLockfile(root: AcePackage, order: AcePackage[], registry: Registry): Lockfile | { error: string }`
  — `order` is resolve's output (deps-first, **root last**). Split root off the tail;
  for each dependency node compute `package_hash = packageHash(node)`,
  `version = node.manifest.version`, and resolve `url`:
  - registry node (`registry.get(name)?.get(version)` present) → that entry's `url`;
  - else inline node → look up the `url` from a **prescan** of every inline edge in
    the graph (`order.flatMap(p => p.manifest.dependencies).filter(kind==="inline")`,
    map `name@version → url`);
  - neither found → `{ error }` (should not happen for a graph resolve produced; the
    error path keeps `buildLockfile` total + testable).
- `serializeLockfile(lf): string` — canonical JSON + trailing newline.
- `parseLockfile(json: string): Lockfile | { error: string }` — JSON-parse + shape
  guard (every field present + correct type; `nodes` an array of well-formed
  `LockNode`; `format_version === 1`). Untrusted-input discipline per slice-5.2
  (non-string fields → `{ error }`, never a throw).
- `verifyRootMatchesLock(root: AcePackage, lf: Lockfile): boolean` —
  `packageHash(root) === lf.root.package_hash` (the drift gate). The frozen replay
  iterates `lf.nodes` directly (already in install order); no extra accessor.

### `tools/ace/resolve.ts` (one additive export)

- Export the existing private `canonicalJson` so `lockfile.ts` reuses it (no second
  canonical-JSON implementation). Pure rename of `function` → `export function`;
  no behavior change, no call-site change.

### `tools/ace/ace.ts` (install handler — additive)

- **`parseArgs`**: add `--frozen` (boolean) and `--lockfile <path>` (string, default
  `./ace.lock`) to `InstallArgs`. Unknown-option + missing-arg handling matches the
  existing `--store` / `--allow-no-signature` pattern.
- **Default path (graph install)**: after the existing successful `resolve()` +
  install, call `buildLockfile(pkg, res.order, registry)` → `serializeLockfile` →
  `writeFileSync(lockfilePath, …)`. A lockfile **write failure is a warning**
  (`ace: WARNING: could not write lockfile: …`), not a failed install — the install
  already succeeded. `--print-resolution` is unchanged.
- **Frozen path (`--frozen`)** — taken *instead of* solve+resolve when the root has
  dependencies:
  1. Read `--lockfile` (missing file → hard error: `ace: install refused: no
     lockfile at <path> — run install without --frozen first`).
  2. `parseLockfile` (parse / shape / `format_version` failure → hard error).
  3. Verify the provided root normally (signature gate + `content_hash`) — unchanged
     from the default path.
  4. **Drift gate**: `verifyRootMatchesLock(pkg, lf)` false → hard error
     (`ace: install refused: lockfile out of date for <name> — re-run without
     --frozen to regenerate`). Any change to the root manifest/files changes its
     `packageHash`, so this catches added/removed/changed deps + changed root files.
  5. **Replay** (registry untouched): for each `LockNode` in install order →
     `fetch(url)` → `JSON.parse` → verify `packageHash(node) === lockNode.package_hash`
     (pin) + `content_hash` + signature gate (`verifySignature` + `--allow-no-signature`
     semantics, identical to the default path) + `validatePackagePaths` →
     `installPackage`. Then install the root. Any fetch / parse / hash-mismatch /
     bad-or-untrusted-signature / unsafe-path → hard refusal with the offending node
     named.
  6. `--frozen` does **not** call `solve()`, does **not** `loadRegistry()`, and does
     **not** write the lock.

- **Leaf (no-dependency) install**: unchanged. No lock is written (nothing to
  reproduce beyond the single artifact the operator already supplied); `--frozen` on
  a leaf install is a no-op flag (documented; the leaf still installs normally).

## Data flow

```text
default:  read root → verify → solve → resolve → install → buildLockfile → write ./ace.lock
--frozen: read root → verify → read+parse ./ace.lock → root-drift gate
          → for each locked node: fetch+verify+install → install root   (registry never touched)
```

## Error handling

| Situation | Mode | Behavior |
| --- | --- | --- |
| Lock write fails (disk, perms) | default | **Warning**, exit 0 (install already succeeded) |
| `--frozen`, lock file missing | frozen | Hard refusal, exit non-zero |
| `--frozen`, lock parse / shape / `format_version` bad | frozen | Hard refusal |
| `--frozen`, root drift (packageHash ≠ lock.root) | frozen | Hard refusal — "re-run without --frozen" |
| `--frozen`, locked url unreachable | frozen | Hard refusal (registry-independent ⇒ the lock's urls are authoritative) |
| `--frozen`, fetched bytes ≠ locked package_hash | frozen | Hard refusal (tamper) |
| `--frozen`, bad / untrusted signature on a node | frozen | Hard refusal (same gate as default; `--allow-no-signature` only waives *no*-signature) |

## Testing

- **`tools/ace/lockfile.test.ts`** (new, pure unit):
  - `buildLockfile` resolves `url` correctly for registry nodes (from the registry)
    and inline nodes (from the inline-edge prescan); excludes root from `nodes`;
    records root identity.
  - `serializeLockfile` → `parseLockfile` round-trips; output is canonical
    (key-order-stable) + ends in a newline.
  - `parseLockfile` rejects malformed input (missing field, wrong type, non-string
    `url`/`version`, `format_version ≠ 1`) with `{ error }` (no throw) — slice-5.2
    untrusted-input discipline.
  - `verifyRootMatchesLock` true on match, false on any root change.
- **Frozen integration (in `tools/ace/ace.test.ts`)**, reusing the existing
  build-packages + `fetchOf` map + registry helpers:
  - default install **writes** `./ace.lock` with the expected pinned nodes;
  - `--frozen` with a matching lock installs the graph using an **empty registry**
    (proves registry-independence) and the lock's urls;
  - `--frozen` with a **drifted root** (added/changed dep) → refused;
  - `--frozen` with **no lockfile** → refused;
  - `--frozen` with a **tampered** locked node (bytes whose `packageHash` ≠ the lock)
    → refused;
  - `--lockfile <path>` override is honored for both write and read.
- All gated by the existing local `bun test tools/ace/` suite (new lockfile +
  frozen tests added) + strict whole-repo `tsc` (the `lint (tsc tools)` CI gate)
  + markdownlint on this doc.

## Scope / YAGNI — deferred (future slices / backlog rows)

- **`ace update`** — re-solve within ranges + rewrite the lock (bump). → backlog.
- **Partial-lock / lock-merge** — add one dep without a full re-solve. → backlog.
- **Alphabetical lock ordering + re-derived install order** — current design stores
  deterministic install order; an alpha-sorted file with a separately-derived order
  is a later readability nicety. → backlog.
- **Lock for leaf (no-dep) installs** — skipped this slice (nothing to reproduce). → backlog.
- **Separate `--locked` mode** (verify the lock matches a fresh solve *without*
  registry-independent replay, cargo's `--locked` vs `--frozen` distinction) — one
  flag (`--frozen`) this slice. → backlog.
- **Single-fetch cache across solve+resolve** — already filed 081KT07NV0008QG0R003659TWT in slice 5.2;
  composes here (frozen replay re-fetches each node) but stays deferred.

## Files touched

- `tools/ace/lockfile.ts` — **new** (pure module).
- `tools/ace/lockfile.test.ts` — **new** (unit tests).
- `tools/ace/resolve.ts` — export `canonicalJson` (one-keyword additive change).
- `tools/ace/ace.ts` — `--frozen` / `--lockfile` flags; default-path lock write;
  frozen replay path; usage text.
- `tools/ace/ace.test.ts` — frozen integration tests.
- `.claude/skills/ace/SKILL.md` — document `--frozen` / `--lockfile` + the lockfile.
- Deferred-enhancement backlog rows filed alongside the PR (matching slice 5.2's
  081KT07NV0008QG0R002WK9064/0971/0972 pattern).
