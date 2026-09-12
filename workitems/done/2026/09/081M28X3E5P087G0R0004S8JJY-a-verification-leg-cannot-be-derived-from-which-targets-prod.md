---
id: 081M28X3E5P087G0R0004S8JJY
type: bug
state: done
priority: P2
slug: a-verification-leg-cannot-be-derived-from-which-targets-prod
title: "A verification leg cannot be derived from which targets produce the artifact"
created: 2026-09-11T18:53:55.766Z
completed: 2026-09-11T23:40:35.510Z
depends_on: []
composes_with: []
---

# A verification leg cannot be derived from which targets produce the artifact

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M28X3E5P087G0R0004S8JJY-*.md` glob. -->

## The rule

> **A verification leg cannot be derived from "which targets produce this artifact".
> It must be claimed by everything it VERIFIES.**

A verifier exists to catch changes that do not declare themselves. Deriving its
trigger from declarations is therefore circular: the change that most needs the
verifier is exactly the one that will not turn it on.

## Measured 2026-09-11

| leg | targets claiming it | what the job actually does |
|---|---|---|
| `gate/cross-verify` | **3** — `ts:ace`, `ts:cross-verification`, `unit:qsharp` | cross-oracle treaty byte-lock over F#/C#/TS/Rust |
| `gate/full-verify` | **4** — `rust:src/Core.Rust.Observe`, `ts:cross-verification`, `unit:go`, `unit:python` | all seven toolchains + cross-language tests |

An F#-only change that **breaks** the byte-lock touches none of those targets, so
neither leg turns on. The golden vectors self-cover the case where the vectors
themselves change; they do not cover the case the job exists for.

Contrast the legs that are sound: `gate/build-and-test`, `gate/lint-fsharp` and
`gate/lint-csharp` are each claimed by **59** targets, and `gate/lint-typescript`,
`gate/test-typescript-hermetic` and `gate/test-typescript-environment` by `**/*.ts`.

## Consequence

Both jobs are on `NOT_GATED` in `src/Core.TypeScript/ci/gate-leg-wiring.ts` with
this reason. `full-verify` keeps its coarser `code` gate; `cross-verify` stays
ungated. The roster is checked in both directions, so neither entry can outlive its
reason silently.

## LIFTS WHEN

The targets these jobs verify claim their legs — every oracle in the byte-lock, not
only the TypeScript side. Then remove the `NOT_GATED` entries; the audit will refuse
a stale one on the next run.

## Resolved — the fix is in the GRAPH, not in `gate.yml`

`attachTreeWideVerifiers` in `ace/build-graph.ts` is a post-pass over the merged
target list that attaches every tree-wide verifier to every real build target.
`gate/full-verify` went from **4 of 121** targets to **106 of 121**, and
`full-verify` is now gated on its leg instead of on the `code` path regex.

The 15 exclusions are two measured classes, not a convenience:

| excluded | why |
|---|---|
| the 10 synthetic `leg:` rows | they carry properties of the TREE or of a FILE TYPE, not of a build. Attaching a verifier to `leg:markdown` would run the seven-toolchain build on every docs change — the exact cost this mechanism exists to avoid. |
| `agda`, `alloy`, `tla`, `lean` | full-verify's nineteen steps neither build nor run them; each has its own workflow or none, and `audit-build-graph-completeness.ts` already rosters them as uncovered. |

### Two things the mechanism caught in its own implementation

**1. Over-claiming against measured evidence is not caution.** The first draft
attached the verifier to Agda/Alloy/Lean on the grounds that the job installs
`java` and nobody had measured otherwise. The completeness audit refused it:
those rows are *rostered* as having no CI, with reasons on file. The
over-claim-when-uncertain principle applies to **uncertainty**, not to
contradicting a finding — and it would have pinned the selector in full mode for
changes that provably need nothing.

**2. A deriver may not disagree with itself.** The first pass was add-only.
`deriveGraph` preserves declared rows verbatim, so a leg written once became an
input the next time and could not be taken back: after narrowing the scope,
`derive` reported *"already current"* while the completeness audit still refused
three rows. The pass is now authoritative in both directions — it strips every
tree-wide verifier and re-adds it where it belongs — so it is a total function of
its sources and idempotent against its own output. Pinned by a test.

### Measured behaviour

| diff | `gate/full-verify` | before |
|---|---|---|
| `src/Core/ZSet.fs` | **on** | off — the bug |
| `src/Core.Rust.Bonsai/src/lib.rs` | **on** | off (35 of 36 crates) |
| docs-only | off | off |
| archive-only | off | off |

So the saving is unchanged and the coverage gap is closed.

## `cross-verify` stays ungated, and the reason is now different

Not "its leg under-claims" — **no leg can express its scope.** It is 45 audits
under one check name, covering source, `.github/workflows/**`, dependency
manifests, `workitems/**`, commit metadata and the archive tree. Several of those
are DECLARED INERT, and an inert path produces no target, so there is nothing for
a leg to attach to. Widening the graph cannot fix that; splitting the matrix can.

**LIFTS WHEN** the cross-verify matrix is selected per-audit rather than per-job.
Each of the 45 has its own scope, and the roster that enumerates them
(`ci/cross-verify-roster.ts`) is where those scopes would live.
