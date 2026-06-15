# Grandfather-claims inventory — pre-ADR `O(·)` claims at `docs/DECISIONS/2026-04-21-router-coherence-v2.md` landing

**Date:** 2026-04-21 (round 41, late).
**Owner:** Architect (Kenji) commissions; this is the one-time inventory named in v2 Closure C-P0-1.
**Source ADR:** [`docs/DECISIONS/2026-04-21-router-coherence-v2.md`](../DECISIONS/2026-04-21-router-coherence-v2.md) §"Closure C-P0-1 (scopes the grandfather clause — v1-P0-1)".
**Discharge cadence:** one pre-ADR claim per round thereafter until the inventory is empty, tracked via a `docs/BACKLOG.md` P2 entry created alongside this doc (see §Discharge queue below).

## What this is (and is not)

v2 §C-P0-1 reads:

> Pre-ADR claims are the set of `O(·)` claims that already exist in the repository at the time this ADR lands. Owner: Architect (Kenji) commissions a one-time audit within the round this ADR lands, produces `docs/research/grandfather-claims-inventory-YYYY-MM-DD.md` listing every docstring, README, BACKLOG, TECH-RADAR, paper-draft, and `openspec/specs/**` `O(·)` claim with its current Stage-1 and Stage-2 status. ... New claims (post-ADR) route through the normal Stage-1-first flow and do not enter the grandfather set.

This inventory distinguishes:

- **Live claims** (shipping to consumers as asserted bounds): F# `///` XML doc comments on public/internal API, `openspec/specs/**` spec text, published `docs/research/**` claims that consumers might cite, `docs/TECH-RADAR.md` live rows. These populate the grandfather set.
- **Non-claims** (historical / residual evidence): BACKLOG `[x] ✅` shipped-item residue mentioning past O-values, in-file comment commentary narrating past bugs (e.g. "was O(n·k)" on a fixed path), TECH-RADAR flag-text describing a past regression. These are *evidence*, not *claims Zeta is currently making*, and are excluded. The grandfather set is what Zeta asserts **today**.
- **Surfaces with zero hits**: root `README.md` (no big-O claims); `memory/<persona>/*/NOTEBOOK.md` (no big-O claims); `docs/papers/**` (directory does not exist yet).

Methodology: ripgrep over `src/**/*.fs`, `docs/BACKLOG.md`, `docs/TECH-RADAR.md`, `docs/research/**/*.md`, `openspec/specs/**/*.md`, `memory/**/*.md`, and root `README*` for `O\([A-Za-z0-9 ·²³√/|]+\)`. Each hit classified by hand as live claim vs evidence.

## Inventory — live claims at ADR-landing time

Status column conventions: **Stage-1** = analytic review by Hiroshi (`complexity-reviewer`) against code. **Stage-2** = empirical measurement by Daisy (`claims-tester`). Both marked `pre-ADR` on every row since no claim has been routed through the v2 pipeline yet — that is the definition of the grandfather set.

### F# source docstrings (`///` triple-slash) — shipping surfaces

| # | File | Line | Claim (verbatim, trimmed) | Surface kind | Stage-1 | Stage-2 |
|---|---|---|---|---|---|---|
| 1 | `src/Bayesian/BayesianAggregate.fs` | 22 | Beta conjugate update "O(1) per observation" | docstring | sound (2026-04-20, `docs/research/claims/bayesian-aggregate-update-o1-2026-04-20.md`) | deferred post-merge |
| 2 | `src/Core/SpineAsync.fs` | 14 | Steady-state throughput matches sync spine "same O(log n) amortised" | docstring | pre-ADR | pre-ADR |
| 3 | `src/Core/Merkle.fs` | 13 | "O(log N) path to the root" | docstring | pre-ADR | pre-ADR |
| 4 | `src/Core/DeltaCrdt.fs` | 14 | Delta ship-size "O(1) bytes instead of O(\|state\|)" | docstring | pre-ADR | pre-ADR |
| 5 | `src/Core/DeltaCrdt.fs` | 107 | "Shipping size = O(1), vs O(\|replicas\|) for full-state merge" | docstring | pre-ADR | pre-ADR |
| 6 | `src/Core/BalancedSpine.fs` | 9 | "amortised O(log n) insert for bounded-latency per-insert cost" | docstring | pre-ADR | pre-ADR |
| 7 | `src/Core/Spine.fs` | 14 | "Inserting a batch at L_i is amortised O(log n)" | docstring | pre-ADR | pre-ADR |
| 8 | `src/Core/Spine.fs` | 16 | "O(log n) lookup and O(n) scan with excellent cache [locality]" | docstring | pre-ADR | pre-ADR |
| 9 | `src/Core/Spine.fs` | 57-58 | "Collapse all levels ... O(n log n) work ... amortised O(n) across the batch" | docstring | pre-ADR | pre-ADR |
| 10 | `src/Core/NovelMath.fs` | 112 | `Merge` "O(k₁ + k₂)" | docstring | pre-ADR | pre-ADR |
| 11 | `src/Core/NovelMath.fs` | 206 | "O(log windowSize) time — physics-signal-processing trick" | docstring | pre-ADR | pre-ADR |
| 12 | `src/Core/NovelMath.fs` | 212 | "answers all three in O(log n) probes" | docstring | pre-ADR | pre-ADR |
| 13 | `src/Core/NovelMath.fs` | 249 | "Sum over the most-recent 2^lvl samples. O(1) given the [prefix]" | docstring | pre-ADR | pre-ADR |
| 14 | `src/Core/Recursive.fs` | 195 | LFP relation "O(\|integrated\|)" | docstring | pre-ADR | pre-ADR |
| 15 | `src/Core/Recursive.fs` | 244-248 | "O(n·N)" naive vs "O(total new facts across iterations) = O(\|LFP\|)" semi-naive | docstring | pre-ADR | pre-ADR |
| 16 | `src/Core/FastCdc.fs` | 12 | "O(1) cross-checkpoint dedup" | docstring | pre-ADR | pre-ADR |
| 17 | `src/Core/FastCdc.fs` | 68 | "Push(n) amortises to O(n)" | docstring | pre-ADR | pre-ADR |
| 18 | `src/Core/Hierarchy.fs` | 18 | Range queries "O(log K + matches)" | docstring | pre-ADR | pre-ADR |
| 19 | `src/Core/Hierarchy.fs` | 42 | "nodes exactly N levels below X queries in O(1)" | docstring | pre-ADR | pre-ADR |
| 20 | `src/Core/ZSet.fs` | 494 | "true O(n log k) — heap merge over source head pointers" | docstring | pre-ADR | pre-ADR |
| 21 | `src/Core/ConsistentHash.fs` | 15 | "O(log N) lookup, 1/N optimal rebalance" | docstring | pre-ADR | pre-ADR |
| 22 | `src/Core/ConsistentHash.fs` | 17 | "arbitrary bucket IDs; still O(log N)" | docstring | pre-ADR | pre-ADR |
| 23 | `src/Core/ConsistentHash.fs` | 121 | "removal for O(1) Add/Remove" | docstring | pre-ADR | pre-ADR |
| 24 | `src/Core/Residuated.fs` | 9 | "O(log k) retraction for non-invertible [aggregates]" | docstring | pre-ADR | pre-ADR |
| 25 | `src/Core/Residuated.fs` | 34 | "All three core ops are O(log k) where k = \|distinct keys\|" | docstring | pre-ADR | pre-ADR |
| 26 | `src/Core/Residuated.fs` | 121 | "retract, max-query — is O(log k) where k = \|distinct [keys]\|" | docstring | pre-ADR | pre-ADR |
| 27 | `src/Core/IndexedZSet.fs` | 25 | "O(log k) key lookup for joins and span-friendly [iteration]" | docstring | pre-ADR | pre-ADR |
| 28 | `src/Core/Sketch.fs` | 10 | "\|supp(Z-set)\| in O(1) memory regardless of input size" | docstring | pre-ADR | pre-ADR |
| 29 | `src/Core/CountMin.fs` | 16 | "A delta-only update at tick t updates the sketch in O(d)" | docstring | pre-ADR | pre-ADR |

**29 live F# docstring claims.**

### Non-docstring F# comments narrating past or ambient costs (grey-zone — see notes)

These are code comments (not `///` docstrings), so they do not ship to IntelliSense consumers, but they are still asserted bounds on read-through. Included for completeness; may be re-classified as non-claims if Hiroshi + Daisy agree.

| # | File | Line | Comment | Notes |
|---|---|---|---|---|
| 30 | `src/Core/DiskSpine.fs` | 180 | "Phase 3: re-hot so the next Load is O(1)" | Code comment, not docstring. Describes current intended behaviour. |
| 31 | `src/Core/LawRunner.fs` | 114 | "is O(n) on List.item, so a List scan would ..." | Code comment narrating an avoidance rationale. Borderline. |
| 32 | `src/Core/HigherOrder.fs` | 89 | "For 'T = ZSet<_>, this is O(n·order) in the worst case" | Code comment. Describes current behaviour under a type specialisation. |

### `openspec/specs/**` — published behavioural spec text

| # | File | Line | Claim | Stage-1 | Stage-2 |
|---|---|---|---|---|---|
| 33 | `openspec/specs/operator-algebra/spec.md` | 341 | "supports O(n + m) group operations over two Z-sets of sizes n and m" | pre-ADR | pre-ADR |

### `docs/TECH-RADAR.md` — live rows

Both TECH-RADAR rows that mention `O(·)` do so in the **flag-text of past regressions** (e.g. *"claimed O(1) was actually O(n); fix in progress"* on row 29; *"harsh-critic found O(n²) buffer scan; fix P0"* on row 30). These are retrospective observations, not current assertions. Excluded from the grandfather set; captured here for audit trail.

### `docs/research/**` — published research claims

| # | File | Line | Claim | Notes | Stage-1 | Stage-2 |
|---|---|---|---|---|---|---|
| 34 | `docs/research/bloom-filter-frontier.md` | 16 | Vector Quotient Filter "O(1) ops" | External claim cited from Pandey et al. SIGMOD 2021; not Zeta's assertion, but Zeta is citing it uncritically. | pre-ADR | pre-ADR |
| 35 | `docs/research/openspec-coverage-audit-2026-04-21.md` | 92 | `Spine.fs` description: "LSM trace over Z-set batches; O(log n) amortised insert" | Duplicates claim #7 (same bound, different surface). | pre-ADR | pre-ADR |

The two `docs/research/liquidfsharp-evaluation.md` `O(n²)` references (lines 38 and 98) are narrating a past harsh-critic-#7 bug — historical, excluded.

### `docs/BACKLOG.md`

Three `[x] ✅` shipped-item entries mention historical `O(·)` values (line 265 `Residual.fs rebuildFromIntegrated is O(n), not O(1)`; line 267 "every op is honestly O(log k)"; line 273 `FastCdc.fs O(n²) buffer scan`). All historical residue from completed fixes — excluded. The formerly-live Dictionary.Remove example on line 143 was itself the target of v2 C-P2-9 and is now superseded by the `ArrayPool<T>.Rent` illustration in v2 — excluded.

### Zero-hit surfaces (verified empty)

- root `README.md` and any other README.md under the repo — no big-O claims.
- `memory/<persona>/*/NOTEBOOK.md` — no big-O claims (notebooks are observations, not asserted bounds).
- `docs/papers/**` — directory does not exist yet; when it does, future paper drafts route through the normal post-ADR Stage-1 flow and do not enter the grandfather set.

## Summary

**Live-claim grandfather set: 35 claims** (29 F# docstrings + 3 grey-zone F# code comments + 1 openspec spec + 2 research doc claims).

Surface distribution:

- 32 F# source-file claims (concentrated in `Core/` — 28 claims; 1 in `Bayesian/`; 3 grey-zone comments)
- 1 `openspec/specs/**` claim
- 2 `docs/research/**` claims

Complexity-class distribution (rough):

- `O(1)` claims: 10
- `O(log n)` / `O(log k)` / `O(log N)` claims: 13
- `O(n)` / `O(n log n)` / `O(n log k)` claims: 7
- `O(k₁ + k₂)` / `O(n + m)` / `O(d)` / `O(|LFP|)` / `O(|integrated|)` / `O(|state|)` / `O(|replicas|)` parametric claims: 5

## Discharge queue — BACKLOG entry

A `docs/BACKLOG.md` P2 entry accompanies this doc (filed as part of the same commit) with the rubric:

> **Grandfather `O(·)` claims discharge — one per round** — 35 pre-ADR `O(·)` claims catalogued at `docs/research/grandfather-claims-inventory-2026-04-21.md`. Cadence: one claim per round through the router-coherence v2 pipeline (Stage 1 analytic by Hiroshi → Stage 2 empirical by Daisy). On each discharge, the row's Stage-1 and Stage-2 cells are updated from `pre-ADR` to the relevant output state (`sound` / `wrong` / `under-specified` / `measurement-matches` / `measurement-contradicts` / `workload-narrowed`). Empty inventory closes the entry. Priority: P2. Effort per claim: S (one claim + one measurement). Total effort: ~35-round tail. Owner: Architect selects which claim to discharge each round; Hiroshi + Daisy execute.

If the inventory is not produced within round 41 (this doc being the production), Aarav files it as a P1 drift finding the following round (per v2 §C-P0-1 graceful-degradation clause). This doc being written and committed within round 41 honours the within-round commitment.

## Observations for future rankings

- The **F# docstring** surface dominates (29/35 = 83%). A systematic sweep of `Core/*.fs` `///` docstrings is where the pipeline will spend most of its cycles.
- The claims cluster around **logarithmic promises** (13/35 = 37%) — mostly IVM / spine / residuated-lattice data-structure rows. These are also where Zeta's published research contributions concentrate; Stage-2 evidence on them directly supports paper-draft readiness.
- **Two claim pairs are potentially synonymous** across surfaces: claim #7 (`Spine.fs:14` docstring) and claim #35 (`docs/research/openspec-coverage-audit` row). Same bound, different surface — when discharged, both rows update together.
- **The three grey-zone code comments** (rows 30-32) are a candidate reclassification target for a future ranker pass — if Hiroshi + Daisy agree that non-`///` comments don't count as asserted bounds, those three drop and the inventory becomes 32 claims.
- **Zero hits in `memory/<persona>/*/NOTEBOOK.md`** is a coherence check that the notebooks are observational (per Aarav's §What this skill does NOT do §BP-08 frontmatter-wins) rather than contract-carrying.

## Provenance

This doc was produced on round 41 (2026-04-21) immediately after `docs/DECISIONS/2026-04-21-router-coherence-v2.md` landed (commit `09f0889`), honouring v2 §C-P0-1's within-round commitment. It is a one-time inventory; future grandfather-set churn is tracked by the discharge BACKLOG entry, not by re-running this sweep.
