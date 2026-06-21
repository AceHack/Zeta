---
id: 081KT07NV0008QG0R002WK9064
priority: P2
status: open
title: Ace advanced semver — `||` unions, hyphen ranges, pre-release precedence, build metadata (deferred from slice 5.2 pragmatic subset)
effort: M
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KR2E4K0008QG0R002YE3MMD
composes_with: []
tags: [ace, package-manager, semver, version-ranges, deferred-enhancement, slice-5.2-followon]
---

## What this row proposes

Slice 5.2 (`tools/ace/semver.ts`) ships a **pragmatic semver subset**: `^`, `~`,
`>=`, `<=`, `>`, `<`, `=`, exact `x.y.z`, `*` / `x` wildcards, and space-separated
AND-ranges. This row tracks the **deferred** remainder of node-semver semantics:

- **`||` unions** — `^1.0.0 || ^2.0.0` (disjunction of ranges).
- **Hyphen ranges** — `1.2.0 - 1.5.0` (inclusive bounded range sugar).
- **Pre-release precedence** — `1.0.0-rc.1 < 1.0.0`, and the rule that a pre-release
  only satisfies a range whose lower bound names the same `x.y.z` pre-release tuple.
- **Build metadata** — `1.0.0+build.5` (ignored for precedence, preserved for display).

## Why deferred (operator 2026-06-01)

The pragmatic subset covers virtually all real manifests with a small, testable
surface; pre-release precedence in particular is the fiddly part of semver and earns
its own focused slice. Operator: *"everything we skipped lets slice off for further
enhancements."*

## Acceptance

- `parseRange` accepts `||`, hyphen ranges; `satisfies` honors pre-release precedence
  + the same-tuple pre-release rule; build metadata parsed + ignored for ordering.
- node-semver differential corpus extended to cover unions / hyphen / pre-release /
  build-metadata and asserts parity (per slice-5.2 test discipline).
- Solver intersection logic handles union ranges (disjunction of conjunctions).

## Composes with

- Slice 5.2 spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.2-semver-solver-design.md`
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)
