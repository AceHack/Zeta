---
id: 081KRFA460008QG0R0007RWSN1
priority: P1
status: decomposed
title: "Repo-split orthogonal Mirror/Beacon axis — speculative-fast-forks vs governance-citation-gated"
type: planning
origin: Aaron 2026-05-13 (autonomous-loop substrate cascade)
created: 2026-05-13
last_updated: 2026-05-14
children:
  - 081KRHWGX0008QG0R002VV6DTS
  - 081KRHWGX0008QG0R002DP6AZN
  - 081KRHWGX0008QG0R0031EGYA7
  - 081KRHWGX0008QG0R0023FDYVE
composes_with:
  - 081KRFA460008QG0R001H98EXJ
  - 081KRFA460008QG0R003JQ46J4
  - memory/feedback_aaron_civsim_language_mirror_beacon_discipline_fun_rigorous_aliens_and_future_included_2026_05_13.md
  - memory/feedback_orthogonal_axes_factory_hygiene.md
  - memory/feedback_aaron_forker_perspective_easy_fork_no_files_they_cant_touch_segregate_owner_only_substrate_to_different_repo_2026_05_13.md
  - memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md
---

# Repo-split ORTHOGONAL Mirror/Beacon axis — speculative-fast-forks vs governance-citation-gated

## Aaron's directive

Aaron 2026-05-13 (immediately after PR #2909 civsim language
mirror/beacon governance escalation):

> "we should probalbu split repos based on nthat too another
> orthoganality"

NEW orthogonal repo-split axis on top of existing axes.

## Repo-split axes (running list)

Per `.claude/rules/default-to-both.md` — MULTIPLE axes can apply
to the same repo simultaneously. Each axis serves a different
design constraint.

### Axis 1: Factory / Product / Owner-only (per 081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4 + PR #2905 forker-perspective META)

| Category | Forkability |
|---|---|
| Factory (Zeta + Forge + ace) | Designed-to-be-forked |
| Products (KSK + wellness + civsim + AD2.0 + DIO + Aurora + Dawn) | Public + glass-halo BUT honor-system "please don't fork" |
| Owner-only | Not in forkable repos at all |

### Axis 2: Mirror / Beacon (NEW per Aaron 2026-05-13)

| Tier | Properties |
|---|---|
| **Mirror repos** | Speculative + fast-iteration + can include aliens-and-future + FUN + RIGOROUS + fork-encouraged-to-advance-quickly |
| **Beacon repos** | Governance-tier + citation-gated + alignment-floor + externally-citable + Mirror→Beacon promotion gate applied |

## Two axes compose

Both axes apply simultaneously. Each repo gets a position on
BOTH axes:

| | Factory | Product | Owner-only |
|---|---|---|---|
| **Mirror** | Forge mirror (factory speculative substrate; forks can advance fast) | civsim Mirror (gameplay speculation + alien-and-future inclusive) | Aaron-private speculative substrate |
| **Beacon** | Zeta (database; citation-gated F# computation expressions) | Aurora (alignment consensus thesis; citation-gated) | Aaron-private governance-gated substrate |

The matrix is illustrative; specific repo positioning needs
per-repo evaluation per the pre-start checklist below.

## What this orthogonality enables

### Speed of iteration

- Mirror repos can iterate fast (speculative + fork-friendly)
- Beacon repos require slower governance (citation lineage +
  alignment-floor compliance)
- Different cadences for different substrate-maturity levels

### Fork-engagement patterns

- Mirror repos: forks encouraged to ADVANCE substrate (per
  PR #2909 governance discipline; forks agree + push back)
- Beacon repos: forks encouraged to VALIDATE / PROPOSE-
  PROMOTION (citation lineage contributions)
- Different fork-engagement protocols per tier

### Governance gate location

- Mirror→Beacon promotion gate IS the governance threshold
- Beacon-tier substrate carries alignment-floor expectations
- Mirror-tier substrate can experiment without governance load
- The gate IS where alignment is enforced

### Substrate-honest discipline preserved

- Mirror substrate doesn't have to be Beacon-ready to be
  load-bearing
- Beacon substrate doesn't sand off the Mirror-richness
- Both tiers are first-class; not hierarchy

## Decomposition (2026-05-14)

This row was decomposed on 2026-05-14 into 4 dependency-ordered atomic
child rows per `.claude/rules/backlog-item-start-gate.md`:

| Row | Title | Type | Depends on |
|-----|-------|------|------------|
| **081KRHWGX0008QG0R002VV6DTS** | Mirror/Beacon prior-art audit | research | — (first in chain; parent: 081KRFA460008QG0R0007RWSN1) |
| **081KRHWGX0008QG0R002DP6AZN** | Two-axis classification matrix | design | 081KRHWGX0008QG0R002VV6DTS |
| **081KRHWGX0008QG0R0031EGYA7** | Mirror→Beacon promotion gate protocol | design | 081KRHWGX0008QG0R002VV6DTS |
| **081KRHWGX0008QG0R0023FDYVE** | Mirror/Beacon axis ADR | adr | 081KRHWGX0008QG0R002DP6AZN, 081KRHWGX0008QG0R0031EGYA7 |

Dependency order: 081KRHWGX0008QG0R002VV6DTS → 081KRHWGX0008QG0R002DP6AZN (parallel with 081KRHWGX0008QG0R0031EGYA7) → 081KRHWGX0008QG0R0023FDYVE.

081KRHWGX0008QG0R0023FDYVE closes this row when merged.

## Pre-start checklist (decomposition gate — completed 2026-05-14)

Prior-art search completed per `.claude/rules/backlog-item-start-gate.md`:

- [x] Otto-356 register discipline (existing; consistent with 081KRFA460008QG0R0007RWSN1)
- [x] `memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_*.md` (exists; current)
- [x] `docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md` (exists; defines promotion gate)
- [x] `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md` (081KRFA460008QG0R003JQ46J4 closed; Axis-1 positions set)
- [x] `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` (Zeta/Forge/ace three-repo split context)
- [x] 081KRFA460008QG0R001H98EXJ still open (Stage-1 factory repo split unblocked by this classification)
- [x] Dependency chain: 081KRHWGX0008QG0R002VV6DTS → 081KRHWGX0008QG0R002DP6AZN ∥ 081KRHWGX0008QG0R0031EGYA7 → 081KRHWGX0008QG0R0023FDYVE established

**Substrate-ready signal:** decomposition is clean; child rows are independent
and bounded. No blockers found.

## Original pre-start checklist (per-repo work — applies to each child row)

Before splitting any repo on the Mirror/Beacon axis, complete
per `.claude/rules/backlog-item-start-gate.md`:

1. **Prior-art search** — verify the existing substrate hasn't
   drifted from Otto-356 + Mirror→Beacon gate research +
   threat-model mirror substrate
2. **Dependency restructure** — walk composes_with chain;
   reciprocal pointers added
3. **Per-repo two-axis classification**:
   - Determine position on Axis 1 (Factory/Product/Owner-only)
   - Determine position on Axis 2 (Mirror/Beacon)
   - Both positions inform the repo-split decision
4. **Forker-perspective audit** (per PR #2905) applies to both
   axes
5. **Promotion gate documented** — clear protocol for moving
   substrate from Mirror to Beacon

## What this row does NOT commit to

- **NOT a repo-split execution this round** — planning + per-
  repo evaluation
- **NOT a forced classification** — some repos may legitimately
  be Mirror+Factory; others Beacon+Product; others Mirror+
  Owner-only
- **NOT a commitment to physically split all combinations** —
  some intersections may be empty; some may be in-product
- **NOT a Beacon-superiority claim** — both tiers are first-
  class

## Composes with

- 081KRFA460008QG0R001H98EXJ (three-repo split Stage 1)
- 081KRFA460008QG0R003JQ46J4 (product-repo split planning)
- PR #2905 (forker-perspective META-discipline)
- PR #2909 (civsim language mirror/beacon discipline →
  governance escalation)
- `memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md`
- `memory/feedback_orthogonal_axes_factory_hygiene.md`
  (orthogonal axes for factory hygiene — existing discipline)
- `docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md`
- `.claude/rules/default-to-both.md` (BOTH axes apply
  simultaneously)
- `.claude/rules/glass-halo-bidirectional.md`
- `.claude/rules/additive-not-zero-sum.md`

## Definition of done

- Two-axis classification matrix populated for ALL existing /
  proposed repos
- Per-repo split decisions made per audit
- ADR recording the two-axis design decision (extends
  2026-04-22 three-repo-split ADR)
- Mirror→Beacon promotion gate documented at repo-level
- Backlog row closed with PR link to ADR + per-repo decisions

## Why P1

- Composes with 081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4 (sibling backlog rows)
- Aaron has explicitly named the orthogonality
- Composes with substrate cascade from this session
- Unblocks Stage 1 Factory split (081KRFA460008QG0R001H98EXJ) by clarifying which
  factory repo gets Mirror vs Beacon classification
- Strategic-substrate (per PR #2902) decisions compose with
  Mirror/Beacon governance gate
