---
id: 081M0QDJGFJ087G0R000KF1N33
type: bug
state: backlog
priority: P2
slug: inert-valuesobject-keys-cli-test-flakes-past-its-5s-timeout
title: "inert-valuesobject-keys CLI test flakes past its 5s timeout under full-suite parallel load"
created: 2026-08-23T13:39:45.266Z
depends_on: []
composes_with: []
---

# inert-valuesobject-keys CLI test flakes past its 5s timeout under full-suite parallel load

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QDJGFJ087G0R000KF1N33-*.md` glob. -->

## Observed, and honestly attributed

`src/Core.TypeScript/cluster/inert-valuesobject-keys.test.ts` §"the CLI's exit code
— the thing CI actually reads" > "exits 0 on the tree as checked in" **timed out
after 5000ms (took 6274ms)** on one run of `bun test src/Core.TypeScript/cluster/`
on 2026-08-23.

Measured both ways on the same tree, same commit:

- **alone**: 57 pass, 0 fail, whole file in **3.44s** — the test itself is ~two
  thirds of the budget.
- **full directory, re-run**: 855 pass, **0 fail** — it did not reproduce.

So it is a load-dependent timeout, not a logic failure: the test spawns the CLI as a
subprocess, and under 24 test files running in parallel the spawn crosses 5s.

**My own contribution to it is named rather than filed as purely pre-existing.** The
rung-reachable-raw-manifests change added a tree-walking reachability check to the
shared audit path, which raises total suite load. It did not create the fragility — a
3.44s test against a 5s default was already one slow machine away from red — but it
moves it closer, and a gate that goes red for reasons unrelated to the defect it
guards is a gate people learn to re-run instead of read.

## Fix

Give the test an explicit timeout the way `rendered-resource-requests.test.ts`
§CONTROL now does (`30_000` as the third argument to `test`), with the reason written
at the call site: a subprocess spawn's wall time is not what this test asserts.

Sweep for siblings while there — any `test()` that spawns a CLI and relies on the 5s
default is the same shape.
