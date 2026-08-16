---
id: 081M02ZTG2G087G0R002YFR8DJ
type: task
state: backlog
priority: P2
slug: 35-of-36-core-rust-crates-and-the-go-zetaid-codec-execute-in
title: "35 of 36 Core.Rust crates and the Go ZetaId codec execute in no CI job"
created: 2026-08-15T15:14:38.288Z
depends_on: []
composes_with: []
---

# 35 of 36 Core.Rust crates and the Go ZetaId codec execute in no CI job

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M02ZTG2G087G0R002YFR8DJ-*.md` glob. -->

## Measured

`.github/workflows/gate.yml` runs exactly two non-.NET, non-TS test invocations:

```yaml
- run: cargo test --manifest-path src/Core.Rust.Observe/Cargo.toml   # gate.yml:1760
- run: go test ./algebra/                                            # gate.yml:1763
```

`git ls-tree -r origin/main --name-only | grep -c 'Core.Rust.*/Cargo.toml'` returns **36**.
So 35 crates — including roughly 20 golden-vector suites such as
`src/Core.Rust.FourCorner/tests/golden_vectors.rs`, which form the Rust leg of the four-language
byte-lock treaties — execute in no CI job. `src/Core.Go/cross_verify_test.go` is `package main` at
the Go module root and is likewise outside `./algebra/`.

## Why it matters beyond coverage

`src/Core.TypeScript/ci/cross-verify-all.ts` states its own contract: it "does NOT regenerate the
F#/C#/Rust outputs … it asserts the committed outputs." `compare.ts` then pins those committed
outputs to `vectors.yaml`, so a **corrupted** output cannot pass. What can pass is a **stale**
one: the Rust or Go source drifts, its committed output JSON still matches the vectors, and every
job stays green because nothing ever re-derives it.

That is what made these two lanes the sharp end of the corruption-window audit
(`docs/research/2026-08-15-which-locally-produced-artifacts-does-ci-never-reproduce-*.md` §3b, §5).
The generated *constants* half is now gated by
`tests/cross-verification/zeta-id/gen-layout-drift.ts`; the codecs' own *logic* is still
unexecuted.

## What would close it

1. A `cargo test --workspace` (or an explicit crate list with a declared-and-reasoned exclusion
   file, the shape `registry/unexecuted-test-files.json` already uses for TS) in a CI job.
2. `go test ./...` in `src/Core.Go` rather than `./algebra/` only.
3. Whatever the honest N is, say it out loud: an aggregate that hides a zero is the defect
   `bytelock.yml`'s liveness floor was raised from 2 to 9 to fix. Do not add a floor that a
   redundant numerator can satisfy.

Cost is real (a Rust toolchain and a build cache in `cross-verify` or `full-verify`), which is
why this is filed rather than done inside an audit PR.
