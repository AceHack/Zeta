---
name: ace
description: Ace DLC package manager — list/install/verify content-addressed packages in ~/.ace store. Run via bun.
record_source: "081KR2E4K0008QG0R002YE3MMD + ace-package-manager agenda; distribution per 2026-06-01 design"
load_datetime: "2026-06-01"
last_updated: "2026-06-01"
status: active
---

# Ace — DLC package manager (skill surface)

Ace is the repo's package manager (`src/Core.TypeScript/ace/ace.ts`). This skill is the agent
surface; the human surface is the `ace` command (exposed by `install.sh` via
`bun link`).

## Runtime precondition (load-bearing)

Ace is TS run on **bun** in-repo: `bun src/Core.TypeScript/ace/ace.ts <verb>`. The floor is a JS
runtime — **Node ≥ 22.5 or bun**. Harnesses with a JS runtime (Claude Code, Cursor,
Gemini CLI) run it directly. A pure-Rust harness with **no** JS runtime (e.g. OpenAI
Codex CLI) must first install bun/Node (run the repo `install.sh`) — Ace cannot run
without one.

## Verb grammar

Publisher verbs: `keygen`, `sign`. Consumer verbs: `install`, `verify`, `trust add`, `trust list`, `registry add`, `registry list`, `list`.

| Verb | Form | What |
|---|---|---|
| `keygen` | `bun src/Core.TypeScript/ace/ace.ts keygen [--out <prefix>]` | Generate an Ed25519 keypair (writes `<prefix>.key` 0600 + `<prefix>.pub`) |
| `sign` | `bun src/Core.TypeScript/ace/ace.ts sign <pkg> --key <priv.key> [--out <file>]` | Sign a package manifest with an Ed25519 private key |
| `list` | `bun src/Core.TypeScript/ace/ace.ts list [--store <path>] [--json]` | List installed packages from `~/.ace/store` |
| `install` | `bun src/Core.TypeScript/ace/ace.ts install <url-or-path> [--allow-no-signature] [--print-resolution] [--frozen\|--locked] [--lockfile <path>]` | Resolve the transitive dependency graph, verify integrity + authenticity of every node, install leaves-first (atomic) |
| `update` | `bun src/Core.TypeScript/ace/ace.ts update <url-or-path> [--lockfile <path>] [--allow-no-signature]` | Re-solve the graph and rewrite the lockfile; installs nothing (lock-only) |
| `verify` | `bun src/Core.TypeScript/ace/ace.ts verify <hash>` | Confirm an installed package is present |
| `trust add` | `bun src/Core.TypeScript/ace/ace.ts trust add <pub-file-or-b64> [--label <name>]` | Add an Ed25519 public key to the user trust store (`~/.ace/trusted-keys.json`) |
| `trust list` | `bun src/Core.TypeScript/ace/ace.ts trust list` | List all trusted keys (bundled + user) |
| `registry add` | `bun src/Core.TypeScript/ace/ace.ts registry add <name> <version> <url> [--hash <package_hash>]` | Register a package version in the user registry (`~/.ace/registry.json`); fetches + computes package_hash unless `--hash` given |
| `registry list` | `bun src/Core.TypeScript/ace/ace.ts registry list` | List registry entries (bundled + user) |
| `help` | `bun src/Core.TypeScript/ace/ace.ts help` | Usage |

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

A dependency edge is one of two kinds: `inline` (`{kind:"inline", name, version, url, package_hash}` — self-pinned) or `registry` (`{kind:"registry", name, version}` — resolved via the registry). Registry deps are resolved against the bundled (`src/Core.TypeScript/ace/registry.json`) ∪ user (`~/.ace/registry.json`) registry. After lookup, a registry dep runs the identical verify path (hash + pin + identity + signature) as an inline dep.

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

Deferred to 081KT07NV0008QG0R002WK9064: `||` (OR ranges), hyphen ranges (`1.0.0 - 2.0.0`), pre-release tags.

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
bun src/Core.TypeScript/ace/ace.ts list --json
```

Exit codes: `0` ok · `64` usage error · `65` invalid package JSON · `1` refused (bad signature / untrusted key / integrity fail / unsatisfiable range).

## Where the deep substrate lives (one Read away)

- Distribution + DX design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-distribution-dx-design.md`
- Authenticity design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice3-authenticity-signature-verify-design.md`
- Agenda: `docs/agendas/ace-package-manager/AGENDA.md`
- The bus↔Ace one-substrate synthesis: PR #6284 (G-Set ⊂ bag ⊂ Z-set; shared 081KSXN940008QG0R0033T2BQT fold engine)

## Remote registries (slice 6)

Slice 6 extends the registry from a local-only file to a network of signed,
anti-rollback-protected remote index servers.

### Registering a remote

```bash
ace registry remote add <url> --key <keyid> [--max-staleness-days <n>]
```

- **`--key <keyid>`** is **required**: every remote pins its Ed25519 signer by
  key ID. The pinned key must also be present in the trust store (add it first
  with `ace trust add`).
- **`--max-staleness-days <n>`** overrides the 30-day default maximum age for
  a fetched index.
- **`ace registry remote list`** — print all registered remotes.
- **`ace registry remote rm <url>`** — deregister a remote.

Remote entries are persisted in **`~/.ace/registries.json`**.

### Three index-trust gates

Every index fetched from a remote must pass three gates before any package
resolution uses it:

1. **Signature** — the index carries an Ed25519 signature that must match the
   registry's pinned key *and* that key must be in the user trust store.
2. **Anti-rollback** — each registry maintains a monotonic per-registry
   `sequence` high-water mark. An incoming index whose `sequence` is lower than
   the stored high-water mark is refused outright.
3. **Two-sided freshness** — the index's `issued_at` timestamp must satisfy both
   bounds:

   - **Past bound**: `issued_at` must not be older than the registry's
     `max-staleness-days` (default 30 days). This gate is skipped when running
     `--offline` (see below).
   - **Future bound**: `issued_at` must not be more than 5 minutes in the future.
     A future-dated index is always refused, even when offline.

### `--offline` flag

Pass `--offline` to `ace install` or `ace update` to use the cached index and
skip all network calls:

```bash
ace install <pkg> --offline
ace update  <pkg> --offline [--lockfile <path>]
```

- The past-staleness gate is skipped (stale cache is accepted as-is).
- The signature, anti-rollback, and future-skew gates are still enforced
  against the cached index.
- `--offline` composes with `--frozen`: both flags may be supplied together; the
  registry-index fetch uses the cache (no registry network) while package artifacts
  at `http(s)` URLs are still fetched. `--offline` skips the *registry* network,
  not all network. The signature, anti-rollback, and future-skew gates remain
  enforced against the cached index throughout.

### Index cache

Fetched indexes are stored content-addressed under **`~/.ace/registry-cache/`**.
Revalidation uses conditional GET (ETag / Last-Modified headers), so unchanged
indexes cost only a round-trip with no body transfer.

### Registry precedence

When multiple registries supply an entry for the same package, the resolution
order is:

1. **User registry** (`~/.ace/registry.json`) — always wins.
2. **Bundled registry** (`src/Core.TypeScript/ace/registry.json`) — wins over any remote.
3. **Remote registries** — resolved in the order listed in
   `~/.ace/registries.json` (first-listed remote wins among remotes).

Local registries always override remotes; earlier-listed remotes win over
later-listed ones.

### Relationship to per-package security

The index-trust gates defend **availability** and **version-selection integrity**:
they prevent an attacker from rolling back the index to an older version list or
injecting a future-dated index. The per-package **content-hash pin** and
**Ed25519 signature gate** (slice 2–3) are unchanged and still enforced on every
downloaded package. Remote registry support is additive security — the two layers
cover different attack surfaces and both must pass.

## Publishing a registry (slice 6.1)

Slice 6.1 adds the producer side: `ace registry publish` scans a directory of
package manifests, builds a signed index, and writes the file a registry serves.

### Command

```bash
ace registry publish --packages <dir>[,<dir>...] --base-url <url> --key <pem-path> [--out <path>] [--sequence <n>]
```

- **`--packages <dir>[,<dir>...]`** — one or more directories to scan (comma-separated).
  Every `*.json` file in each directory is attempted as a package manifest; files
  that do not parse as a valid package manifest are skipped with a warning. Each
  listed directory must be readable (an unreadable directory is a hard error).
  A duplicate `name@version` across directories is also a hard error.
- **`--base-url <url>`** — base URL of the registry. Each package's consumer
  `url` is derived as `<base-url>/<name>-<version>.json` (unless overridden — see
  Per-package `url` below) and its `package_hash` is the `packageHash` of the
  canonical whole package (`{ manifest, files }`) — the same hash the consumer pins.
- **`--key <pem-path>`** — path to the Ed25519 **private** key (PEM format). The index is signed
  with this key. Recommended: restrict the key file so only you can read it
  (e.g. `chmod 600` on POSIX); `publish` reads the key but does not enforce
  its file permissions.
- **`--out <path>`** — path to write the signed index JSON (default: `./index.json`).
- **`--sequence <n>`** — explicit positive integer to use as the index sequence number,
  overriding the auto-bump. Still anti-rollback-gated: if `--out` holds a prior index
  and `n <= prior_sequence`, publish refuses (exit 1). Absent → auto-bump as before.

### Sequence auto-bump

If `--out` already exists, `publish` reads the previous index and sets the new
index's `sequence` to `prior_sequence + 1`. A sequence that is not strictly
increasing is refused (exit 1). This is the producer-side mirror of the
consumer's anti-rollback gate: the published sequence always advances. Pass
`--sequence <n>` to supply an explicit positive integer instead of auto-bumping;
the anti-rollback gate still applies.

### Round-trip self-verify

Before writing, `publish` re-parses the produced index through the same
`parseIndex` path and signature check the consumer uses, verifying against the
signing key's own public key. This guarantees the published `index.json` loads
and verifies as a signed index for a consumer who pinned the matching registry
key ID. It does **not** by itself guarantee `ace install` succeeds: install
additionally verifies each package's own manifest signature against the
consumer's package trust store, which may use a different key than the registry
index. Consumers must trust both the registry key (for the index) and each
package's signing key (for install), or pass `--allow-no-signature` for unsigned
packages.

To find the `<keyId>` to pin, the `<keyId>` is shown by `ace trust list` (or printed by `ace trust add <pub>` when the key is added).

Then on the consumer side:

```bash
ace registry remote add <url> --key <keyId>
```

### The published index

The `index.json` written by `publish` is the file a registry serves at the URL
consumers configure. It contains the package list, `sequence`, `issued_at`,
and the Ed25519 signature over the canonical payload.

### Per-package `url` field (slice 6.2)

A package file may carry an optional top-level `url` key — a sibling of `manifest`
and `files`, outside the signed manifest:

```text
{
  "manifest": { ... },
  "files": { ... },
  "url": "https://cdn.example/my-pkg-v1.json"
}
```

When present, `url` overrides the derived `<base-url>/<name>-<version>.json` for
that package in the published index. Key properties:

- **Publish-only:** the `url` field is excluded from `package_hash`, which hashes
  only `manifest` and `files`. The content/signature gates are unaffected.
- **Filename exemption:** a package WITH a `url` is exempt from the
  `<name>-<version>.json` filename requirement (the on-disk file may be named
  anything, e.g. a CDN-style path). A package WITHOUT a `url` still must be named
  `<name>-<version>.json`.
- **Validation:** `url` must be a non-empty string that is a valid absolute URL.
  An invalid or empty `url` causes `publish` to skip that package with a warning.

Example — two directories, one package with a CDN url:

```bash
ace registry publish   --packages /srv/pkgs/tier1,/srv/pkgs/tier2   --base-url https://registry.example   --key registry.pem   --out index.json   --sequence 7
```

In `tier1/leaf.json`:

```text
{ "manifest": { ... }, "files": { ... }, "url": "https://cdn.example/leaf-v2.json" }
```

The published index entry for `leaf` uses `https://cdn.example/leaf-v2.json`
while all other packages derive their URL from `--base-url`.

### Deferred

- ETag / Last-Modified sidecar for conditional-GET cache validation.
- Multi-signer publish (multiple signing keys on one index).

## Revocation and quarantine (slice 7)

Slice 7 adds two mark states to the signed registry index. Marks live inside
`IndexSignableContent` (inherited by the Ed25519 signature, anti-rollback
sequence, and freshness gates). An index carrying any mark has `format_version`
set to `2`; a plain publish with no marks stays `format_version` `1`.

### Mark semantics

- **`revoked`** — permanent hard-refuse. A revoked version is refused at resolve
  and install regardless of the lockfile. There is no `unrevoke`; revocation is
  terminal.
- **`quarantined`** — soft-refuse, override-able with `--allow-quarantined`.

Revoke supersedes quarantine: revoking a quarantined version removes the
quarantine mark and adds the revocation mark. Quarantining an already-revoked
version is an error.

### Producer subcommands

Each mutate-command reads the existing `--out` index, verifies its signature
under `--key`, applies the mark, bumps the sequence by one, refreshes
`issued_at`, re-signs, self-verifies, and writes the result. `--out` must
already exist (these commands mutate an existing index; use `ace registry
publish` to create one first).

| Subcommand | Effect |
|---|---|
| `ace registry revoke <name>@<version> [--reason "..."] --key <pem> [--out <path>]` | Permanently revokes the version; also clears any quarantine on it |
| `ace registry quarantine <name>@<version> [--reason "..."] --key <pem> [--out <path>]` | Soft-refuses the version; errors if already revoked |
| `ace registry unquarantine <name>@<version> --key <pem> [--out <path>]` | Releases the quarantine after review; errors if not quarantined |

### publish carries marks forward

`ace registry publish` preserves existing `revoked` and `quarantined` maps from
a prior index when `--out` already exists, so marks are not silently dropped on
republish.

### Consumer behaviour

`ace install` (and the resolver) refuses marked versions:

- **Revoked** — always refused, even when the version is pinned in the lockfile.
  Revocation overrides the lockfile: if a locked version is subsequently revoked,
  `ace install` refuses and the lockfile must be updated.
- **Quarantined** — refused by default; pass `--allow-quarantined` to opt in.

```bash
# Producer: revoke a bad version
ace registry revoke my-pkg@1.2.3 --reason "supply-chain compromise" \
    --key registry.pem --out index.json

# Consumer: plain install now refuses my-pkg@1.2.3
ace install my-pkg.json
# Error: my-pkg@1.2.3 is revoked: supply-chain compromise

# Consumer: opt into a quarantined (but not revoked) version
ace install my-pkg.json --allow-quarantined
```
