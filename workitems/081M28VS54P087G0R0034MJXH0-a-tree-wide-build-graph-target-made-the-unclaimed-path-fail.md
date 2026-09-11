---
id: 081M28VS54P087G0R0034MJXH0
type: bug
state: backlog
priority: P2
slug: a-tree-wide-build-graph-target-made-the-unclaimed-path-fail
title: "A tree-wide build-graph target made the unclaimed-path fail-safe unreachable"
created: 2026-09-11T18:30:50.262Z
depends_on: []
composes_with: []
---

# A tree-wide build-graph target made the unclaimed-path fail-safe unreachable

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M28VS54P087G0R0034MJXH0-*.md` glob. -->

## The defect

`classifyPath` classifies a changed path in a deliberate order — `always` → target
hit → `inert` → `unknown` — and the last of those is a fail-safe: a path no target
claims escalates the whole build to `mode: "full"`, because a selector that cannot
recognise a file it has never seen must not be allowed to decide that file needs no
work.

The target `leg:tree-structure` declares `sources: ["**"]`. It is *correct* as
declared: the empty-directory guard and structural hygiene are properties of the
tree, not of any file. But it matches every path that will ever exist, so
`hits.length > 0` was always true, so **both branches below it were unreachable** —
the `inert` branch and the `unknown` fail-safe alike.

Measured on the checked-in graph before the fix (2026-09-11):

| input | mode | legs on | floor |
|---|---|---|---|
| `some/totally/unknown/path.xyz` | `selective` | 2 | **entirely off** |
| (empty diff) | `selective` | 0 | **entirely off** |

Two legs — `lint-no-empty-dirs`, `lint-structural-hygiene` — are exactly
`leg:tree-structure`'s own. Nothing else ran.

## Why it mattered now

Nothing consumed `affected-legs.ts` yet, so no check was actually skipped on any
PR. The defect was found while wiring job selection onto this graph, which is the
change that would have made it load-bearing: gating `build-and-test`,
`lint-typescript` and `cross-verify` on these legs would have meant **a new source
file the graph does not yet claim skips the entire uncompensatable floor.** A check
that did not run, looking like one that passed.

The suite stayed green throughout because every semantics test runs against the
`TOY` fixture, and `TOY` has no target claiming `**`. The fixture could not express
the condition the real graph created — which is why the falsifiers added here test
both a tree-wide toy *and* the checked-in graph.

## The fix

`classifyPath` now distinguishes "a target matched this path" from "a target
*claims* this path": tree-wide targets (`**`, `**/*`) are still **seeded** by every
path — that is what `**` means — and no longer **count** as the claim that
suppresses the fail-safe. `inert` paths seed tree-wide targets too, so a docs-only
change still runs the empty-directory and structural-hygiene legs without being
dragged to a full build.

Residual escalation measured over `git ls-files` (69,018 files):

| class | files | share |
|---|---|---|
| target | 58,885 | 85.3% |
| inert | 9,420 | 13.6% |
| **unknown → full** | **387** | **0.56%** |
| always → full | 326 | 0.47% |

So the fail-safe is live but rare: ~1% of files escalate, and a docs-only or
archive-only change stays selective — which is the case the wiring exists to
exploit.

## Follow-on

The 387 unclaimed files are the honest backlog this exposes: each is a file whose
CI needs the graph cannot state, and each one costs a full build when touched.
Claiming them is a separate, incremental piece of work — it makes selection
*better*, never *safer*, and the fail-safe is what makes that ordering acceptable.
