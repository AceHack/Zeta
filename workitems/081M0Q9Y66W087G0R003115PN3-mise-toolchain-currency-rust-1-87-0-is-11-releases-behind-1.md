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
