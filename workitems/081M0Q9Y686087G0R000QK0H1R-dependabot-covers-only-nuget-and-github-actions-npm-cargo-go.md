---
id: 081M0Q9Y686087G0R000QK0H1R
type: task
state: backlog
priority: P1
slug: dependabot-covers-only-nuget-and-github-actions-npm-cargo-go
title: "Dependabot covers only nuget and github-actions: npm, cargo, gomod and pip manifests have no automated currency at all"
created: 2026-08-23T12:36:13.702Z
depends_on: []
composes_with: []
---

# Dependabot covers only nuget and github-actions: npm, cargo, gomod and pip manifests have no automated currency at all

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q9Y686087G0R000QK0H1R-*.md` glob. -->

## Measured (2026-08-23)

`.github/dependabot.yml` declares exactly **two** ecosystems:

- `nuget` at `/`
- `github-actions` at `/`

And the nuget half works: of the pins in `Directory.Packages.props` that were checked against
`api.nuget.org`, `benchmarkdotnet`, `apache.arrow`, `yamldotnet`, `system.reactive`,
`libgit2sharp`, `messagepack`, `google.protobuf` and `microsoft.z3` are all **at latest**.
That is the control — it shows the mechanism is effective where it is pointed.

## What is pointed at nothing

| ecosystem        | manifests in tree                                                                                                                          | Dependabot coverage      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| npm / bun        | root `package.json` + 8 nested (`demo/`, `genesis/`, `full-ai-cluster/portal/`, `agentic-organization/`, `src/Core.TypeScript/blake3/`, …) | **none**                 |
| cargo            | **many** `src/Core.Rust.*/Cargo.toml`                                                                                                      | **none**                 |
| gomod            | `src/Core.Go/`, `src/wasm-dla/bytelock/`, `full-ai-cluster/k8s/applications/hat-system/operator/`                                          | **none**                 |
| pip/uv           | `src/Core.Python/pyproject.toml`                                                                                                           | **none**                 |
| mise             | `.mise.toml`, `.mise.full.toml`                                                                                                            | no such ecosystem exists |
| `global.json`    | .NET SDK pin                                                                                                                               | no such ecosystem exists |
| `lean-toolchain` | Lean pin                                                                                                                                   | no such ecosystem exists |

The npm consequence is visible in the same audit: `typescript` is pinned **6.0.3** while
**7.0.2** is current — an entire major, and nothing was ever going to say so. `z3-solver`
4.16.0 vs 5.2.0 likewise.

## Done when

1. `npm`, `cargo` and `gomod` ecosystems are added to `.github/dependabot.yml`, **grouped**
   the way the nuget entry already is (grouping is why the nuget lane is drainable).
2. The unmanaged-by-any-bot residue — `.mise.toml`, `global.json`, `lean-toolchain` — is
   covered by a **scheduled currency report** rather than pretended to be covered. A report
   that prints the delta is honest; a bot that does not exist is not.

## Do NOT touch

The two `ignore:` entries already in the file are load-bearing and were each added _after_ the
widened version broke the build:

- `Microsoft.CodeAnalysis.*` — CS9057 against the SDK's Roslyn (measured on PR #13590).
- `FsCheck*` — the **family** pattern, because `FsCheck.Xunit.v3` 3.4.0 requires
  `FsCheck [3.4.0]` exactly and transitively demands xunit.v3 4.x (measured, PR #13653/#13696;
  the first attempt ignored only the follower and Dependabot re-opened 21 minutes later).

If a new bump turns out to carry a semver-invisible coupling, the fix is another documented
`ignore` with a `LIFTS WHEN:` clause — never a bump that hopes.
