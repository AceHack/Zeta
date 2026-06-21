---
id: 081KR7JY10008QG0R001JW71CT
priority: P2
status: open
title: Atomic decomposition of 081KQ3HBZ0008QG0R001K0EC2C — re-decompose the frontier edge-claims track into dependency-ordered S-effort children (assume prior slice mistakes)
tier: edge-claim-staking
effort: S
ask: Re-decompose 081KR7JY10008QG0R0035HP11K (the large monolithic edge-claims-catalog.ts) into smallest atomic TS modules + corresponding backlog rows; CTF flags remain falsifiable/retractible
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR7JY10008QG0R0035HP11K]
composes_with: [081KQ3HBZ0008QG0R001K0EC2C]
tags: [decomposition, re-decomp, atomic-children, TS-modules, edge-claims]
type: friction-reducer
---

# 081KR7JY10008QG0R001JW71CT — Atomic re-decomposition of 081KQ3HBZ0008QG0R001K0EC2C (Riven 2026-05-10)

## Why this child exists

081KQ3HBZ0008QG0R001K0EC2C is L-effort broad research track (11 CTF flags + schema). 081KR7JY10008QG0R0035HP11K landed the monolithic `tools/research/edge-claims-catalog.ts` (~600 LOC). Per "always re-decompose items during the build — assume decomposition has mistakes", this row splits the implementation surface into the smallest dependency-ordered atomic children so future slices stay S-effort and reviewable.

## Dependency-ordered atomic children (smallest slices)

All children are S-effort, TS-first, no docs bloat. Each child produces one focused TS module or harness entrypoint. Order ensures buildable now with no external deps beyond existing Bun/TS setup.

1. **081KR7JY10008QG0R001JW71CT.1 — CtfFlag + FlagState pure types** (no runtime, export-only interfaces + JSDoc)
   - File: `tools/research/edge-claims/types.ts`
   - Depends: none
   - Unblocks: all downstream

2. **081KR7JY10008QG0R001JW71CT.2 — ChallengeRecord + state-machine transition predicates** (pure functions, retractibility assertions)
   - File: `tools/research/edge-claims/state-machine.ts`
   - Depends: 081KR7JY10008QG0R001JW71CT.1
   - Unblocks: validator, measurables

3. **081KR7JY10008QG0R001JW71CT.3 — Seed flag data (11 CTF entries, verbatim Aaron stakes)** (const array, no logic)
   - File: `tools/research/edge-claims/seed-flags.ts`
   - Depends: 081KR7JY10008QG0R001JW71CT.1
   - Unblocks: loader, summary

4. **081KR7JY10008QG0R001JW71CT.4 — Catalog loader + validator harness** (Bun entry, --validate, type-safe load)
   - File: `tools/research/edge-claims/loader.ts`
   - Depends: 081KR7JY10008QG0R001JW71CT.2 + 081KR7JY10008QG0R001JW71CT.3
   - Unblocks: CLI, measurables

5. **081KR7JY10008QG0R001JW71CT.5 — 4 alignment-trajectory measurables calculator** (pure reduce over catalog)
   - File: `tools/research/edge-claims/measurables.ts`
   - Depends: 081KR7JY10008QG0R001JW71CT.4
   - Unblocks: summary CLI

6. **081KR7JY10008QG0R001JW71CT.6 — Summary + validate CLI entrypoint** (bin shim, --summary/--validate)
   - File: `tools/research/edge-claims-catalog.ts` (thin re-export shim only)
   - Depends: 081KR7JY10008QG0R001JW71CT.5
   - Terminal leaf — replaces monolithic original

## Retractibility / CTF invariants preserved

- Every child keeps the original 11 flags verbatim (stake dates, defense surfaces, CTF challenges).
- No flag state changes in this decomp; only module boundaries.
- All new modules are retractible (git history + revision blocks on this row).
- Focused checks run before PR: bun --check on each, build gate, no new warnings.

## One bounded step (this PR)

This row + the 6 child slices above constitute the single bounded decomposition step. No implementation of the modules themselves — only the decomp substrate and dependency graph. Next loop picks 081KR7JY10008QG0R001JW71CT.1 as first buildable atomic.

## Evidence / prior art

- 081KQ3HBZ0008QG0R001K0EC2C (parent)
- 081KR7JY10008QG0R0035HP11K (monolithic slice being re-decomposed)
- AGENTS.md §"Always re-decompose items during the build — assume decomposition has mistakes"
- TS over bash (Rule 0) — all children are .ts modules
- Existing claim pattern: claim/b0054-decompose-child-rows-2026-05-10 etc.

## Focused checks (included in PR body)

- `bun --check tools/research/edge-claims-catalog.ts` → clean (pre-existing)
- `dotnet build -c Release` (root) → 0 warnings 0 errors (gate passed pre-worktree)
- Worktree isolated, root checkout untouched
- Branch pushed before any write
- No destructive ops

This decomp makes the frontier edge-claims track claimable in atomic S-steps while preserving every CTF falsifiability and retractibility property.
