---
id: 081M23PNS51087G0R002TVVV3C
type: bug
state: backlog
priority: P2
slug: sealed-room-gate-was-evadable-by-one-space-and-an-unanchored
title: "sealed-room gate was evadable by one space, and an unanchored regex misclassified a manifest"
created: 2026-09-09T18:25:24.641Z
depends_on: []
composes_with: []
---

# sealed-room gate was evadable by one space, and an unanchored regex misclassified a manifest

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23PNS51087G0R002TVVV3C-*.md` glob. -->

## The alert class

CodeQL `js/regex/missing-regexp-anchor`, 2 open alerts:

- **229** `src/Core.TypeScript/hygiene/audit-sealed-rooms.ts:25` — `/\bSystem\.IO\b/`
- **175** `full-ai-cluster/tools/k8s-manifests.test.ts:75` — `/argoproj\.io/`

Neither regex is applied to a URL. The query fires because each literal is
HOST-SHAPED (`.IO` and `.io` read as TLDs) and unanchored. Taken as a security
finding both are false positives — and looked at as engineering, both regexes
were genuinely wrong for reasons that have nothing to do with URLs. Both are
fixed on the merits; the alerts clear as a consequence. No dismissal.

## Defect 1 — the sealed-room gate was evadable by one space

`audit-sealed-rooms.ts` runs in `gate.yml` and enforces the Reticulum-only
clause (081KTSZN10008QG0R002J0GE0Z, noninterference #13): a file declaring
`SEALED-ROOM` must contain zero ambient-channel tokens — filesystem, process,
network, wall clock, entropy, threadpool spawn.

Every dotted entry in its table matched a LITERAL dot. C#, F# and TypeScript all
accept whitespace around a member-access dot, so each of these walked straight
through:

```
System . IO      File . ReadAllText      Directory . CreateDirectory
Path . GetTempFileName                   Environment . GetEnvironmentVariable
DateTime . UtcNow                        Guid . NewGuid        Task . Run
```

A gate a space walks through is not a gate. The evidence that this was an
oversight rather than a decision is in the table itself: `Random\s*\(` was
written whitespace-tolerant from the start. One entry got it; the rest did not.

**And nothing tested any of it.** The audit had no test file at all — while its
`inspect()` explicitly skipped a file named `audit-sealed-rooms.test.ts`. A
reserved slot for a falsifier nobody wrote: the vacuity class with a parking
space.

Fix: every dotted pattern becomes whitespace-tolerant, the line matcher is
extracted as `bannedReason()` so it can be tested without a filesystem, and the
walk is guarded by `import.meta.main` so `bun audit-sealed-rooms.ts` keeps
working unchanged for `gate.yml`.

## Defect 2 — a comment made a manifest an ArgoCD Application

The Application filter read `/kind:\s*Application/ && /argoproj\.io/` against
raw file text, unanchored. Two consequences, both live:

- `k8s/sync-wave-dependency-graph.yaml` is `kind: AppDependencyGraph`,
  `apiVersion: ace.zeta.io/v1`. It was classified as an ArgoCD Application
  purely because its PROSE quotes `kind: Application` and the
  `argocd.argoproj.io/sync-wave` annotation name. Measured: 52 files selected,
  51 real Applications and that one.
- `kind: ApplicationSet` matched too, since nothing required end-of-value.

Fix: both patterns line-anchored, reading the document rather than the prose —
`/^\s*kind:\s*Application\s*$/m` and `/^\s*apiVersion:\s*argoproj\.io\//m`.

## Falsifiers, and the mutations run against them

`src/Core.TypeScript/hygiene/audit-sealed-rooms.test.ts` is new — the gate has a
test for the first time. 8 tests:

- every declared door refused with its own reason
- **EVERY row of the table is exercised** — a row nothing tests is a door nobody
  checked, so the coverage set is pinned against `BANNED` itself
- the whitespace regression, per token, plus tabs
- the negative cases: ordinary lines are clean; the SEALED-ROOM declaration line
  may name the doors it forbids; an explicit `SEAL-WAIVER:` is honoured
- **and that the waiver is the ONLY escape** — a plain comment on the same line
  does not excuse a door, or the waiver would be decoration

In `k8s-manifests.test.ts`, `a file that only TALKS about Applications is not
one` asserts the misclassified file is gone from the set AND exercises the
predicate directly on all three forcing shapes.

| mutation | outcome |
|---|---|
| revert every pattern to a literal dot (i.e. the pre-fix state) | **killed** by 2 tests |
| revert the ArgoCD filter to the unanchored form | **killed** by 1 test |

The first mutation is exactly the code that shipped before this change, which is
the honest way to state the finding: the gate was open, and the test that says
so fails against the old source.
