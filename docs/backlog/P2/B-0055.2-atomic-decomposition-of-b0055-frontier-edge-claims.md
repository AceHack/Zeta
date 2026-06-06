---
id: B-0055.2
zetaid: 081KR7JY10008QG0R001JW71CT
priority: P2
status: open
title: Atomic decomposition of B-0055 — re-decompose the frontier edge-claims track into dependency-ordered S-effort children (assume prior slice mistakes)
tier: edge-claim-staking
effort: S
ask: Re-decompose B-0055.1 (the large monolithic edge-claims-catalog.ts) into smallest atomic TS modules + corresponding backlog rows; CTF flags remain falsifiable/retractible
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0055.1]
composes_with: [B-0055]
tags: [decomposition, re-decomp, atomic-children, TS-modules, edge-claims]
type: friction-reducer
---

# B-0055.2 — Atomic re-decomposition of B-0055 (Riven 2026-05-10)

## Why this child exists

B-0055 is L-effort broad research track (11 CTF flags + schema). B-0055.1 landed the monolithic `tools/research/edge-claims-catalog.ts` (~600 LOC). Per "always re-decompose items during the build — assume decomposition has mistakes", this row splits the implementation surface into the smallest dependency-ordered atomic children so future slices stay S-effort and reviewable.

## Dependency-ordered atomic children (smallest slices)

All children are S-effort, TS-first, no docs bloat. Each child produces one focused TS module or harness entrypoint. Order ensures buildable now with no external deps beyond existing Bun/TS setup.

1. **B-0055.2.1 — CtfFlag + FlagState pure types** (no runtime, export-only interfaces + JSDoc)
   - File: `tools/research/edge-claims/types.ts`
   - Depends: none
   - Unblocks: all downstream

2. **B-0055.2.2 — ChallengeRecord + state-machine transition predicates** (pure functions, retractibility assertions)
   - File: `tools/research/edge-claims/state-machine.ts`
   - Depends: B-0055.2.1
   - Unblocks: validator, measurables

3. **B-0055.2.3 — Seed flag data (11 CTF entries, verbatim Aaron stakes)** (const array, no logic)
   - File: `tools/research/edge-claims/seed-flags.ts`
   - Depends: B-0055.2.1
   - Unblocks: loader, summary

4. **B-0055.2.4 — Catalog loader + validator harness** (Bun entry, --validate, type-safe load)
   - File: `tools/research/edge-claims/loader.ts`
   - Depends: B-0055.2.2 + B-0055.2.3
   - Unblocks: CLI, measurables

5. **B-0055.2.5 — 4 alignment-trajectory measurables calculator** (pure reduce over catalog)
   - File: `tools/research/edge-claims/measurables.ts`
   - Depends: B-0055.2.4
   - Unblocks: summary CLI

6. **B-0055.2.6 — Summary + validate CLI entrypoint** (bin shim, --summary/--validate)
   - File: `tools/research/edge-claims-catalog.ts` (thin re-export shim only)
   - Depends: B-0055.2.5
   - Terminal leaf — replaces monolithic original

## Retractibility / CTF invariants preserved

- Every child keeps the original 11 flags verbatim (stake dates, defense surfaces, CTF challenges).
- No flag state changes in this decomp; only module boundaries.
- All new modules are retractible (git history + revision blocks on this row).
- Focused checks run before PR: bun --check on each, build gate, no new warnings.

## One bounded step (this PR)

This row + the 6 child slices above constitute the single bounded decomposition step. No implementation of the modules themselves — only the decomp substrate and dependency graph. Next loop picks B-0055.2.1 as first buildable atomic.

## Evidence / prior art

- B-0055 (parent)
- B-0055.1 (monolithic slice being re-decomposed)
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
