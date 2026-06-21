---
id: 081KT07NV0008QG0R003659TWT
priority: P2
status: open
title: Ace solver↔installer single-fetch cache — fetch each package once (deferred from slice 5.2 clean two-phase split)
effort: S
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KR2E4K0008QG0R002YE3MMD
composes_with: []
tags: [ace, package-manager, solver, fetch-cache, performance, deferred-enhancement, slice-5.3-adjacent]
---

## What this row proposes

Slice 5.2 chose a **clean two-phase split** (operator 2026-06-01): the solver fetches
candidate packages to read their transitive deps, then slice-5.1's `resolve()` re-fetches
to verify + install. Each package is therefore fetched up to twice. Registry reads are
local/content-addressed so the double-read is cheap, but it is wasted work for remote
registries (081KT07NV0008QG0R000SJ34AK) and large graphs.

This row tracks threading a **fetch cache** (solver's fetched + verified packages handed
to the installer) so each package version is fetched exactly once.

## Why deferred (operator 2026-06-01)

Keeps slice 5.2 minimal + keeps slice-5.1's verified `resolve()` engine fully untouched.
The cache lands naturally with the **slice 5.3 lockfile** — the lockfile IS the persisted
solved graph, and a fetch cache is the in-memory analog produced on the way to it.
Operator: *"everything we skipped lets slice off for further enhancements."*

## Scope sketch

- Solver returns (or populates) a `Map<name@version, AcePackage>` of fetched manifests.
- `resolve()` accepts an optional pre-fetched-package cache; on a cache hit it skips the
  network/disk fetch but **still runs every verify step** (content-hash, package-hash
  pin, identity, signature) — caching must never bypass verification.
- Compose with the 5.3 lockfile so a locked graph can install with zero solve-time fetches.

## Composes with

- Slice 5.2 spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.2-semver-solver-design.md`
- 081KT07NV0008QG0R000SJ34AK (remote registry — where the double-fetch actually costs)
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)
