---
id: 081M0DG68ZH087G0R001RMAX88
type: task
state: backlog
priority: P2
slug: repo-split-round-2-measured-change-rate-partition-candidate
title: "Repo-split round 2: measured change-rate partition, candidate cut-lines with named costs"
created: 2026-08-19T17:13:05.777Z
depends_on: []
composes_with:
  - docs/research/2026-08-19-repo-split-round-2-the-change-rate-partition-is-measured-and-the-first-cut-is-not-the-one-the-adr-drew.md
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
  - 081KRFA460008QG0R001H98EXJ
  - 081KRFA460008QG0R0007RWSN1
  - 081KRFA460008QG0R000VKJF0H
  - 081KRHWGX0008QG0R000BS8Y4R
---

# Repo-split round 2: measured change-rate partition, candidate cut-lines with named costs

The design round landed as
`docs/research/2026-08-19-repo-split-round-2-the-change-rate-partition-is-measured-and-the-first-cut-is-not-the-one-the-adr-drew.md`.
This row tracks what the round left open.

## What the round settled (measured, re-runnable)

- The operative DV2.0 axis for this tree is **re-touch percentage**, not churn
  rate. Three classes separate without a tuned threshold.
- The cold merge archive (`docs/history`, `docs/github`, `docs/pr-discussions`,
  `docs/recovered-orphan-branches-2026-05`) is **18,273 files / 48.6% of tracked
  files** and **90% solo in both the 90d and 30d windows** — the most
  independent group in the tree and the only window-stable one.
- `docs/observe-events` is NOT an archive. 323 of 324 archive-x-product
  co-changes are it; it is written synchronously by
  `src/Core.TypeScript/planning/proposal-gated-commit.ts`. It stays.
- Forge/Zeta cut price: `FACTORY x PRODUCT` = 305 commits/90d, **16%/17%**,
  stable across windows.
- Ruleset-divergence audit (081KRHWGX0008QG0R000BS8Y4R) run: **one** divergence,
  `refs/heads/heartbeat/*`, on the telemetry lane.
- `Forge` and `ace` **do not exist** at LFG. ADR Stage 1 has been one
  `workflow_dispatch` away since 2026-05-14.

## Open — the decision that belongs to the human

Four options are stated in §8 of the doc with consequences. Not restated here;
the doc is the surface.

## Open — the one unmeasured cost

How often do agents actually read `docs/history/` and `docs/github/` from their
own clone? This is the falsifier for the archive cut and it is the only
unmeasured cost in the best-supported candidate. It should be gathered BEFORE
the cut, not after.

## Open — a §1 requirement that does not depend on which cut is taken

`ace` must never become the mandatory resolution path between repos. Plain
`git clone` at a pinned tag must remain **sufficient** forever, not
transitional. Falsifier: a test that clones each repo at a tag with no `ace`
present and builds. Cheap now, expensive after `ace` ships.

## Open — the byte-lock rendezvous

`tests/cross-verification/` is written by per-language suites across
`src/Core.Rust.*`, `tests/Tests.FSharp/`, and `src/Core.TypeScript/ace/`. Any
cut crossing `src/` makes a build-time invariant a distributed-agreement
problem. `src/Core.TypeScript/ace/build-graph.test.ts` is the one crossing the
ADR's Forge/Zeta line already makes; resolve it before Cut B, not during.
