---
name: ace
description: Ace DLC package manager — list/install/verify content-addressed packages in ~/.ace store. Run via bun.
record_source: "B-0288 + ace-package-manager agenda; distribution per 2026-06-01 design"
load_datetime: "2026-06-01"
last_updated: "2026-06-01"
status: active
---

# Ace — DLC package manager (skill surface)

Ace is the repo's package manager (`tools/ace/ace.ts`). This skill is the agent
surface; the human surface is the `ace` command (exposed by `install.sh` via
`bun link`).

## Runtime precondition (load-bearing)

Ace is TS run on **bun** in-repo: `bun tools/ace/ace.ts <verb>`. The floor is a JS
runtime — **Node ≥ 22.5 or bun**. Harnesses with a JS runtime (Claude Code, Cursor,
Gemini CLI) run it directly. A pure-Rust harness with **no** JS runtime (e.g. OpenAI
Codex CLI) must first install bun/Node (run the repo `install.sh`) — Ace cannot run
without one.

## Verb grammar

Publisher verbs: `keygen`, `sign`. Consumer verbs: `install`, `verify`, `trust add`, `trust list`, `registry add`, `registry list`, `list`.

| Verb | Form | What |
|---|---|---|
| `keygen` | `bun tools/ace/ace.ts keygen [--out <prefix>]` | Generate an Ed25519 keypair (writes `<prefix>.key` 0600 + `<prefix>.pub`) |
| `sign` | `bun tools/ace/ace.ts sign <pkg> --key <priv.key> [--out <file>]` | Sign a package manifest with an Ed25519 private key |
| `list` | `bun tools/ace/ace.ts list [--store <path>] [--json]` | List installed packages from `~/.ace/store` |
| `install` | `bun tools/ace/ace.ts install <url-or-path> [--allow-no-signature] [--print-resolution] [--frozen\|--locked] [--lockfile <path>]` | Resolve the transitive dependency graph, verify integrity + authenticity of every node, install leaves-first (atomic) |
| `update` | `bun tools/ace/ace.ts update <url-or-path> [--lockfile <path>] [--allow-no-signature]` | Re-solve the graph and rewrite the lockfile; installs nothing (lock-only) |
| `verify` | `bun tools/ace/ace.ts verify <hash>` | Confirm an installed package is present |
| `trust add` | `bun tools/ace/ace.ts trust add <pub-file-or-b64> [--label <name>]` | Add an Ed25519 public key to the user trust store (`~/.ace/trusted-keys.json`) |
| `trust list` | `bun tools/ace/ace.ts trust list` | List all trusted keys (bundled + user) |
| `registry add` | `bun tools/ace/ace.ts registry add <name> <version> <url> [--hash <package_hash>]` | Register a package version in the user registry (`~/.ace/registry.json`); fetches + computes package_hash unless `--hash` given |
| `registry list` | `bun tools/ace/ace.ts registry list` | List registry entries (bundled + user) |
| `help` | `bun tools/ace/ace.ts help` | Usage |

`install` verifies **integrity** (content hash) AND **authenticity** (Ed25519 signature
against the trust store). Unsigned packages need `--allow-no-signature`; a present-but-untrusted
signature is always refused (`ace trust add` the key).

For a manifest with `dependencies` (inline-URL: `{name, version, url, package_hash}`),
`install` resolves the full transitive graph and installs every node leaves-first.
Resolution is atomic: it verifies the whole graph (slice-2 hash + slice-3 signature
per node, identity-pinned by `package_hash`) and preflights path-safety + store-key
uniqueness BEFORE extracting anything — any failure installs nothing. Refusal reasons:
`version-skew`, `tamper`, `pin-mismatch`, `bad-content-hash`, `bad-signature`,
`untrusted-key`, `unsupported-algo`, `no-signature`, `cycle`, `fetch-failed`,
`invalid-package`, `store-collision`, `registry-miss`, `unsatisfiable`.
`--allow-no-signature` applies graph-wide
(permits only genuinely-unsigned nodes; a bad/untrusted signature on any node always refuses).

A dependency edge is one of two kinds: `inline` (`{kind:"inline", name, version, url, package_hash}` — self-pinned) or `registry` (`{kind:"registry", name, version}` — resolved via the registry). Registry deps are resolved against the bundled (`tools/ace/registry.json`) ∪ user (`~/.ace/registry.json`) registry. After lookup, a registry dep runs the identical verify path (hash + pin + identity + signature) as an inline dep.

## Semver ranges (slice 5.2)

Registry dependency `version` fields may be semver ranges. `ace install` runs a solver
that picks the newest registry version satisfying each range across the transitive graph,
then runs the same verify + atomic-install path.

Supported range subset:

- Caret `^1.2.0` — compatible with the major version
- Tilde `~1.2.0` — compatible with the minor version
- Comparators `>=1.0.0`, `<=2.0.0`, `>1.0.0`, `<2.0.0`, `=1.0.0`
- Exact `1.2.3`
- Wildcard `*` or `x`
- Space-AND ranges `>=1.0.0 <2.0.0`

Deferred to B-0970: `||` (OR ranges), hyphen ranges (`1.0.0 - 2.0.0`), pre-release tags.

Inline edges stay exact-pinned by `package_hash` and are never registry-routed. An
unsatisfiable range (no registry version matches any constraint) refuses with exit 1 and
installs nothing (`unsatisfiable` reason).

### `--print-resolution`

Pass `--print-resolution` to print the solved graph before installing:

```bash
ace install <pkg> --allow-no-signature --print-resolution
```

Each printed line has the format `name@version`, sorted lexicographically. Useful for
auditing which versions the solver selected before committing to the install.

## Lockfile (slices 5.3 + 5.4)

A normal `ace install` writes `./ace.lock` after a successful install — for a
dependency graph (pins every resolved dep by name, version, URL, `package_hash`) AND
for a leaf (no-dependency) package (an empty-`nodes` lock pinning just the root identity,
slice 5.4).

**`--frozen`** replays the locked graph: skips solving and registry access entirely,
fetches each node from the locked URL, and byte-verifies the result against the locked
`package_hash` and `content_hash`. On a leaf it just drift-gates the root against the
lock. Refused if the lockfile is missing or if the root package has drifted from its
locked state ("lockfile out of date — re-run without `--frozen` to regenerate").

**`--locked`** (slice 5.4) is the CI guard: it re-solves, then asserts the committed
lock equals a fresh solve, and refuses (installing nothing) if they differ — "lockfile
out of date (--locked) — run 'ace update' to regenerate". Unlike `--frozen` (which
replays the lock registry-independently), `--locked` consults the registry to detect a
stale lock. `--locked` and `--frozen` are mutually exclusive (a usage error together).

**`ace update`** (slice 5.4) refreshes the lock by re-solving the dependency graph and
rewriting the lockfile — it installs nothing (lock-only). It runs the same signature gate,
root `content_hash` check, solve, resolve, and integrity preflight as `install`, but
preflights the freshly-solved graph BEFORE writing: it never writes a lock for a graph
`install` would reject. A failed solve/resolve/preflight refuses with exit `1` and writes
no lock; a write failure is a hard error (exit `1`). On a leaf it writes the empty-`nodes`
lock. Typical loop: `ace update` (regenerate) → commit `ace.lock` → `ace install --locked`
(CI asserts it is current) or `ace install --frozen` (reproducible replay).

**`--lockfile <path>`** overrides the default lockfile path (`ace.lock`) for `install`
and `update`.

Errors during a normal `install` lockfile *write* are warnings (install still succeeds).
All `--frozen`/`--locked` refusals (missing lock, drift, stale, hash mismatch, bad
signature) and an `ace update` write failure are hard exits (code `1`).

## Invocation

```bash
bun tools/ace/ace.ts list --json
```

Exit codes: `0` ok · `64` usage error · `65` invalid package JSON · `1` refused (bad signature / untrusted key / integrity fail / unsatisfiable range).

## Where the deep substrate lives (one Read away)

- Distribution + DX design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-distribution-dx-design.md`
- Authenticity design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice3-authenticity-signature-verify-design.md`
- Agenda: `docs/agendas/ace-package-manager/AGENDA.md`
- The bus↔Ace one-substrate synthesis: PR #6284 (G-Set ⊂ bag ⊂ Z-set; shared B-0867.27 fold engine)
