---
id: 081M0Q9Y69F087G0R000FBK4JA
type: bug
state: backlog
priority: P2
slug: fast-check-property-tests-in-five-typescript-directories-are
title: "fast-check property tests in five TypeScript directories are executed by no CI lane"
created: 2026-08-23T12:36:13.743Z
depends_on: []
composes_with: []
---

# fast-check property tests in five TypeScript directories are executed by no CI lane

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q9Y69F087G0R000FBK4JA-*.md` glob. -->

## Measured (2026-08-23)

`fast-check` is pinned `4.8.0` in `package.json` (devDependencies) and statically imported by
five tracked test files:

- `src/Core.TypeScript/cover-acyclicity/gyo.test.ts`
- `src/Core.TypeScript/peer-call/_firewall.test.ts`
- `src/Core.TypeScript/discovery/udp-lossy-transport.test.ts`
- `src/Core.TypeScript/ferry-throttler/priority-ferry-throttler.property.test.ts`
- `src/Core.TypeScript/observe/schema-aware-join.test.ts`

**No workflow runs any of them.** Every `bun test` invocation across `.github/workflows/*.yml`
is path-targeted (`src/Core.TypeScript/hygiene/`, `…/ace/`, `…/inventory/`, `…/cluster/`, plus
individually named files); there is **no bare `bun test`**; and none of the five directories
above appears in any workflow. Checked by grepping every invocation, not by reading one file.

## Why this is the same defect as the radar drift that found it

The .NET sibling is gated: 156 `tests/` files reference FsCheck and `dotnet test Zeta.sln -c
Release` runs them in `gate.yml`'s blocking `build-and-test` job. So the repo has property
tests on both sides of the language boundary and gates only one — while the radar carried a
single row, "FsCheck 3 property tests | Adopt", which read as covering both.

Written properties that nothing executes are the vacuity class: they look exactly like
coverage and constrain nothing.

## Done when

A CI lane executes the five files (they are fast, pure, and socket-free — the natural home is
an existing `bun test` step, widened, or one new targeted step), the lane is green, and
`docs/TECH-RADAR.md`'s `fast-check` row graduates **Trial → Adopt** on that evidence.

Falsifier for the fix: break one property deliberately and confirm the lane goes red.
