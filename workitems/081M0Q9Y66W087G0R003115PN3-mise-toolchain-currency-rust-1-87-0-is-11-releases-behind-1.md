---
id: 081M0Q9Y66W087G0R003115PN3
type: task
state: backlog
priority: P2
slug: mise-toolchain-currency-rust-1-87-0-is-11-releases-behind-1
title: "mise toolchain currency: rust 1.87.0 is 11 releases behind 1.98.0, plus zig/uv/go/golangci-lint/semgrep/ruff/mypy drift"
created: 2026-08-23T12:36:13.660Z
depends_on: []
composes_with: []
---

# mise toolchain currency: rust 1.87.0 is 11 releases behind 1.98.0, plus zig/uv/go/golangci-lint/semgrep/ruff/mypy drift

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q9Y66W087G0R003115PN3-*.md` glob. -->

## Measured (2026-08-23, upstream release APIs)

| tool              | `.mise.toml` pin | upstream latest             | delta                                     |
| ----------------- | ---------------- | --------------------------- | ----------------------------------------- |
| **rust**          | `1.87.0`         | **1.98.0** (2026-08-20)     | **11 releases** (~15 months)              |
| **zig**           | `0.13.0`         | **0.15.2**                  | 2 minors; 0.13.0 is ~2 years old          |
| **uv**            | `0.11.21`        | **0.12.5** (2026-08-14)     | 1 minor                                   |
| **go**            | `1.26.4`         | **1.27.0** (1.26.7 in-line) | 1 minor + 3 patches                       |
| **golangci-lint** | `2.12.2`         | **2.13.1** (2026-08-20)     | 1 minor                                   |
| **semgrep**       | `1.161.0`        | **1.174.0**                 | 13 patches                                |
| **ruff**          | `0.15.17`        | **0.16.4**                  | 1 minor                                   |
| **mypy**          | `2.1.0`          | **2.3.1**                   | 2 minors                                  |
| **bun**           | `1.3` (range)    | **1.4.0** (2026-08-20)      | range excludes 1.4                        |
| node              | `24`             | 26.7.0                      | **current is correct** — 24 is Active LTS |
| java              | `26`             | 26                          | current                                   |
| yamllint          | `1.38.0`         | 1.38.0                      | current                                   |
| actionlint        | `1.7.12`         | 1.7.12                      | current                                   |
| shellcheck        | `0.11.0`         | 0.11.0                      | current                                   |

**Rust is the outlier and should be triaged first.** Fifteen months of compiler releases is
not a chore, it is a supply-chain and correctness surface: `src/Core.Rust.*` is one of the
byte-lock oracles, and an oracle running a compiler that far behind is decorrelated for the
wrong reason.

## The coupling that makes a rust bump non-trivial (do not just edit the version)

`.mise.toml` says so itself:

> A version bump must also move the `1.87.0-*` rustup-toolchain cache globs in
> `.github/workflows/gate.yml` + `installer-unit-tests.yml`; a stale glob silently degrades
> the offline path to a CDN fetch.

That is a **semver-invisible coupling**, and per the currency-audit framing the fix for such
a thing is a documented constraint, not a bare bump. Any rust move must land the glob edits
in the same commit, and should re-run the negative control the file records (an isolated
config with a bogus rustup component must still be rejected **by name**).

Second coupling: `src/wasm-dla/bytelock/dla-canonical-zig.wasm` is byte-locked at
1,314 bytes under **zig 0.13.0**, verified byte-identical on rebuild (sha256 `c28210dc…`,
2026-08-17). A zig bump will move those bytes and requires the golden vectors to move with it,
deliberately, in the same change.

## Done when

Each row is either bumped (with the coupled edits above in the same commit and CI green) or
carries a written, dated hold with a `LIFTS WHEN:` clause — the shape `.github/dependabot.yml`
already uses for `Microsoft.CodeAnalysis.*` and `FsCheck*`.

---

## Progress 2026-08-23 — four rows closed, three held with measurements, one correction

Landed on `deps/security-roll-and-ecosystem-coverage`. Every row below was measured against
this tree at BOTH versions before it moved or stayed; `--version` was not accepted as
evidence for anything.

| row | outcome | evidence |
| --- | --- | --- |
| `uv` 0.11.21 -> **0.12.5** | **bumped** | `uv lock --check` in `src/Core.Python`: lock up to date, 22 packages |
| `pipx:mypy` 2.1.0 -> **2.3.1** | **bumped** | `Found 1 error in 1 file (checked 10 source files)` at BOTH versions — identical, and the error is pre-existing |
| `golangci-lint` 2.12.2 -> **2.13.1** | **bumped** | `0 issues` at both versions |
| `pipx:ruff` 0.15.17 | **HELD** | 0.15.17 -> `All checks passed!`; 0.16.4 -> `Found 65 errors.` Split out as `081M0QJWD89087G0R001FSQJP5` |
| `pipx:semgrep` 1.161.0 | **HELD** | floor ruleset clean at both; the full `.semgrep.yml` run did not complete inside the sweep, and semgrep GATES, so it was not shipped unverified |
| `zig` 0.13.0 | **HELD** | byte-lock coupled; now guarded by a check rather than prose (below). Note upstream has moved again — latest is **0.16.0**, not the 0.15.2 recorded above |
| `rust` 1.87.0 | **HELD** | see the correction below |
| `go` 1.26.4 | **HELD** | `src/wasm-dla/bytelock/go.mod` is byte-lock coupled: `bytelock.yml` BUILDS the Go substrate and compares its trajectory to the golden vectors, so a toolchain move can move the emitted wasm |

### Correction to the rust coupling as stated above — it is not two files

This item quotes `.mise.toml` saying a bump "must also move the `1.87.0-*` cache globs in
`gate.yml` + `installer-unit-tests.yml`". That is true and it is **short by an order of
magnitude**. Measured 2026-08-23: **17 operative restatements**, and the one that matters
most is not a cache glob at all —

> **`.mise.full.toml` carries its OWN `rust = { version = "1.87.0", … }` pin.**

So a bump that did exactly what the documented constraint asks — move `.mise.toml` and both
workflows — would still leave full-tier hosts (dev laptops, cluster nodes, the k8s CI lanes)
on a different compiler from slim/standard hosts, and nothing in the tree could say so.

That is the argument for the guard that landed instead of the bump:
`src/Core.TypeScript/hygiene/audit-mise-toolchain-couplings.ts`, on the `cross-verify` floor.
It DISCOVERS the restatement sites rather than listing them, holds no expected version, and
was mutation-tested against all three real failure modes (rust pin moved alone; zig pin moved
alone; one byte appended to the committed `.wasm`). Bump the pin and run it — it names every
file and line that still has to move.

The zig half is guarded by a recorded `(version, sha256)` pairing in
`audit-mise-toolchain-couplings.provenance.json`, checked **both** ways. The failure it closes
is the quiet one: the committed `.wasm` does not move when the compiler pin does, so the
byte-lock keeps passing while the artifact stops being reproducible from the pinned toolchain
— condition 3 of the `.claude/rules/no-binary-in-proof-lineage.md` exception.

### Sizing for the three that were not taken

**rust 1.87.0 -> 1.98.0 — its own PR, medium-to-large.** Eleven releases, ~15 months. The
version edit is minutes; the work is (a) the 17 coupled restatements, now enumerable by
running the guard, (b) rebuilding all **36** `src/Core.Rust.*` crates and re-running their
byte-lock vectors, since an oracle's compiler moving is exactly the kind of change the
four-oracle lock exists to catch, and (c) the negative control this file already names — an
isolated config with a bogus rustup component must still be rejected BY NAME, or the
`components`/`targets` pass-through has silently stopped working. Do not bundle it with
anything.

**zig 0.13.0 -> 0.16.0 — its own PR, medium.** Three minors now, not two. The artifact must
be REGENERATED (`node src/wasm-dla/bytelock/build-substrates.mjs`), the golden vectors
re-confirmed, and the provenance record moved in the same commit — the guard will refuse the
half-done version. Note the trap already recorded in `build-substrates.mjs`: an earlier
two-step route silently emitted an `ar` archive instead of a wasm module and it sat on `main`
for two weeks, so `verifyWasmHeader` is not optional reassurance.

**go 1.26.4 -> 1.27.0 — its own PR, small-to-medium.** The blast radius is the bytelock Go
substrate. Unlike zig this one fails LOUDLY (the artifact is built in CI, not committed), so
the risk is a red lane rather than a silent stale proof — but it still wants its own change
so the redness means one thing.

**semgrep 1.161.0 -> 1.174.0 — small, blocked only on wall clock.** The floor ruleset is
clean at both versions; what is outstanding is a full `.semgrep.yml` comparison, which takes
~20 minutes (the gate job's own `timeout-minutes: 20`). Method is settled — run both, diff
the finding fingerprints, ship if identical.
