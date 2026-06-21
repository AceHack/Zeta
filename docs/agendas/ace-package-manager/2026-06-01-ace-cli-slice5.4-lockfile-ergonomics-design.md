# Ace CLI slice 5.4 — lockfile ergonomics (design)

> Spec for slice 5.4 of the Ace DLC package manager (081KR2E4K0008QG0R002YE3MMD). Builds directly on
> slice 5.3 (lockfile: `tools/ace/lockfile.ts` + `ace install --frozen`/`--lockfile`,
> merged #6400 spec + #6410 impl). Brainstormed + decided with the operator 2026-06-01.
> Bundles three slice-5.3 deferral rows — 081KT07NV0008QG0R002GV3MXW (`ace update`), 081KT07NV0008QG0R0028AAV0E
> (`ace install --locked`), 081KT07NV0008QG0R003VDHWWG (lockfile ergonomics) — at the scope locked below.

## Goal

Round out the lockfile workflow with two additive verbs/flags and a uniformity fix,
**without changing the lock format**: `ace update` (refresh the lock by re-solving),
`ace install --locked` (assert the committed lock is up to date, else refuse), and
leaf-install lockfiles (so `--frozen`/`--locked` work uniformly on no-dependency
artifacts).

## Decomposition of slice 5 (recap)

- **5.1** (done, #6369): registry data layer + exact-version lookup.
- **5.2** (done, #6388 + #6391): semver ranges + solver.
- **5.3** (done, #6400 + #6410): lockfile — write `./ace.lock`; `--frozen` replay.
- **5.4** (this spec): lockfile ergonomics — `ace update` + `--locked` + leaf-lock.

## Decisions (this spec locks them; operator 2026-06-01)

1. **Lock format is UNCHANGED (`format_version: 1`).** Slice 5.3's nodes-in-
   deterministic-install-order serialization is already byte-stable (canonical JSON +
   deterministic solve/resolve), so **alphabetical node ordering is dropped** from
   this slice — it is purely cosmetic and would push graph-rebuild/format-migration
   complexity into the security-critical `--frozen` replay path. Stays deferred
   (081KT07NV0008QG0R003VDHWWG). If the format is ever bumped it should be for substantive metadata, not
   diff-prettiness.
2. **`ace update` is a FULL re-solve, lock-only.** No `--package <name>` single-bump
   and no partial-merge primitive this slice — those need solver "pin-all-but-one"
   support that earns its own work. Stays deferred (081KT07NV0008QG0R002GV3MXW `--package`, 081KT07NV0008QG0R003VDHWWG
   partial-merge). Full re-solve within the declared ranges is the meaningful
   capability.
3. **Three features in scope, all additive** (no solver change, no format change):
   `ace update`, `ace install --locked`, leaf-install lockfiles.

## Feature 1 — `ace update`

```text
ace update <url-or-path> [--lockfile <path>] [--allow-no-signature]
```

Re-solve the root's current ranges fresh against the registry and rewrite the lock.
**Lock-only — installs nothing** (cargo-consistent: `cargo update` rewrites the lock,
it does not build; the operator runs `ace install` afterwards to apply the new graph).

Flow (reuses the install front-half verification, skips extraction):

1. Read root (url-or-path) → signature gate (same as install: `no-signature`
   overridable by `--allow-no-signature`; bad/untrusted/unsupported always refused) →
   root `content_hash` check.
2. If the root has dependencies: `loadRegistry()` → `solve()` → `resolve()` (fetch +
   verify the graph, producing `order`) → **run the install integrity preflight**
   (`content_hash` + `validatePackagePaths` + store-key collision over `res.order`,
   identical to the install graph path) → `buildLockfile(root, order, registry)` →
   `serializeLockfile` → `writeFileSync(lockfile)`. **Runs the full preflight so
   `update` never writes a lock for a graph that `install` would reject (Codex review
   on #6412); skips only the extract (`installPackage`) step.** A preflight failure →
   hard refusal, no lock written.
3. If the root is a leaf (no deps): write the trivial leaf lock (Feature 3).
4. A solve/resolve failure → hard refusal (same reason surfacing as install). A lock
   write failure → hard error here (unlike install's warning: producing the refreshed
   lock IS the entire purpose of `update`, so a failed write is a failed `update`).

`ace update` is a NEW command: `UpdateArgs { command:"update"; source; lockfile;
allowNoSignature }`, added to the `ParsedArgs` union, with a `parseArgs` branch
mirroring `install`'s arg loop (source required; `--lockfile <path>` default
`ace.lock`; `--allow-no-signature`).

## Feature 2 — `ace install --locked`

```text
ace install <url-or-path> --locked [--lockfile <path>] [...]
```

Assert the committed lock already matches what a fresh solve would produce; install
only if it does. The CI / "did someone forget to commit the updated lock?" guard.

- Add `locked: boolean` to `InstallArgs`; parse `--locked`.
- **Mutually exclusive with `--frozen`** — `parseArgs` returns an error if both are
  given. They are opposites: `--locked` solves fresh + asserts-up-to-date
  (registry-dependent); `--frozen` replays the lock without solving
  (registry-independent).
- Handler (graph path): require an on-disk lock at `--lockfile` (absent → refuse:
  "no lockfile to check against — run `ace update` or install without --locked").
  Then the normal `solve()` → `resolve()` → `buildLockfile(pkg, res.order, registry)`;
  **compare** the freshly-built lock to the parsed on-disk lock via canonical-JSON
  equality (`lockfilesEqual`). If they differ → **hard refuse, install nothing**
  ("lockfile out of date — run `ace update` to regenerate"). If identical → proceed
  through the existing preflight + extract (lock already current; no rewrite needed).

## Feature 3 — leaf-install lockfiles

Today (5.3) only the graph-install path writes a lock; the leaf (no-dependency) path
writes none, so `--frozen`/`--locked` are no-ops on a leaf. Make the leaf path
uniform with an **empty `nodes`** lock:

- **Default leaf install:** after the successful single-package install, write
  `{ format_version: 1, root: { name, version, package_hash }, nodes: [] }` to
  `--lockfile` (write failure = warning, matching the graph default path).
- **`--frozen` on a leaf:** read the lock (absent → refuse), `verifyRootMatchesLock`
  drift gate (root `packageHash` ≠ locked → refuse "re-run without --frozen"), then
  install the (already signature+content_hash-verified) root. No nodes to replay.
- **`--locked` on a leaf:** require the lock; build the trivial lock; compare to
  on-disk; differ → refuse-install-nothing; same → install.

`buildLockfile` already returns `nodes: []` for a depless root (it filters the root
out of `order` and there are no other nodes), so a small helper
`buildLeafLockfile(root)` (or calling `buildLockfile(root, [root], emptyRegistry)`)
produces it — the spec uses a dedicated `buildLeafLockfile(root): Lockfile` for
clarity since the leaf path has no `order`/`registry` in hand.

## Components

- **`tools/ace/lockfile.ts`**: add
  - `lockfilesEqual(a: Lockfile, b: Lockfile): boolean` → `serializeLockfile(a) === serializeLockfile(b)` (canonical-JSON string equality — the `--locked` comparison).
  - `buildLeafLockfile(root: AcePackage): Lockfile` → `{ format_version: 1, root: { name, version, package_hash: packageHash(root) }, nodes: [] }`.
- **`tools/ace/ace.ts`**:
  - `UpdateArgs` interface + `ParsedArgs` union entry + `parseArgs` `update` branch + handler (Feature 1).
  - `InstallArgs.locked` + `--locked` parse + `--locked`/`--frozen` mutual-exclusion error (Feature 2).
  - graph-install `--locked` compare-before-extract branch (Feature 2).
  - leaf-install path: default lock write + `--frozen` drift-gate-replay + `--locked` compare (Feature 3).
  - usage text for `ace update` + `--locked`.
- **`.claude/skills/ace/SKILL.md`**: document `ace update` + `--locked` + leaf-lock.

## Data flow

```text
ace update <root>:   read root → verify → solve → resolve → preflight → buildLockfile → write lock   (no extract)
install --locked:    read root → verify → solve → resolve → buildLockfile → EQ on-disk? differ→refuse / same→preflight+extract
install (leaf):      read root → verify → install root → write {root, nodes:[]} lock
install --frozen leaf: read root → verify → read lock → root-drift gate → install root
```

## Error handling

| Situation | Verb | Behavior |
| --- | --- | --- |
| `update` solve/resolve fails | update | Hard refusal (reason surfaced) |
| `update` graph node fails preflight (bad content_hash / unsafe path / store-collision) | update | Hard refusal, **no lock written** (never lock a graph install would reject) |
| `update` lock write fails | update | **Hard error** (the refreshed lock is the purpose) |
| `install --locked` + no lockfile | install | Hard refusal ("nothing to check against") |
| `install --locked` + lock differs from fresh solve | install | Hard refusal, **install nothing** ("run `ace update`") |
| `install --locked --frozen` together | parseArgs | Error (mutually exclusive) |
| `--frozen` leaf, no lock | install | Hard refusal |
| `--frozen` leaf, root drift | install | Hard refusal |
| leaf default lock write fails | install | Warning (install succeeded) |

## Testing

- **`lockfile.test.ts`**: `lockfilesEqual` true for identical / false for any node or
  root diff; `buildLeafLockfile` produces `{format_version:1, root, nodes:[]}` with
  the right root `package_hash`.
- **`ace.test.ts`** (reuse the existing temp-store + temp-cwd + fetch harness):
  - `ace update` rewrites `./ace.lock` to the freshly-solved graph (e.g. registry gains
    a newer in-range version → `update` picks it up; no packages installed by `update`).
  - `ace install --locked` **passes** (installs) when the on-disk lock matches a fresh
    solve; **refuses + installs nothing** when the lock is stale (e.g. a newer in-range
    version exists so a fresh solve would differ); **refuses** when no lock exists.
  - `--locked --frozen` together → parse error.
  - leaf install writes an empty-nodes lock; `--frozen` on that leaf installs the root;
    `--frozen` leaf with a drifted root refuses.
- Gated by `bun test tools/ace/` + strict `bun --bun tsc --noEmit -p tsconfig.json` +
  markdownlint on this doc + commit canary 67.

## Scope / YAGNI — deferred (rows stay open)

- **Alphabetical node ordering** (081KT07NV0008QG0R003VDHWWG) — cosmetic; would complicate the `--frozen`
  replay path; deferred.
- **`ace update --package <name>` + partial-merge** (081KT07NV0008QG0R002GV3MXW / 081KT07NV0008QG0R003VDHWWG) — needs solver
  pin-all-but-one support; deferred to its own slice.
- **081KT07NV0008QG0R003659TWT single-fetch cache** — unrelated perf; composes better with remote
  registry (081KT07NV0008QG0R000SJ34AK).

## Files touched

- `tools/ace/lockfile.ts` — `lockfilesEqual` + `buildLeafLockfile`.
- `tools/ace/lockfile.test.ts` — unit tests for the two helpers.
- `tools/ace/ace.ts` — `update` command; `--locked` flag + mutual-exclusion; graph
  `--locked` compare; leaf lock write + `--frozen`/`--locked` leaf handling; usage.
- `tools/ace/ace.test.ts` — `update` + `--locked` + leaf-lock integration tests.
- `.claude/skills/ace/SKILL.md` — document the new surface.
