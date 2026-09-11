---
id: 081M28X3E5P087G0R0004S8JJY
type: bug
state: backlog
priority: P2
slug: a-verification-leg-cannot-be-derived-from-which-targets-prod
title: "A verification leg cannot be derived from which targets produce the artifact"
created: 2026-09-11T18:53:55.766Z
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
