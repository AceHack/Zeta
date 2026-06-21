---
id: 081KQ8P5D0008QG0R000N718AC
priority: P1
status: umbrella
title: Human-lineage / external-anchor backfill across all factory substrate — Beacon-safe + human-anchored prior-art citations for every load-bearing concept
tier: substrate-quality
effort: L
ask: maintainer Aaron 2026-04-28 ("we should backlog human lineage to all our substraight stuff too if it exists, all our AI stuff even though we are just editing md files is coding and thee might be articles and research papers or question/answer fourms stack overflow etc... we should research waht we've already done and make sure it's beacon safe and human anchored/linage.")
created: 2026-04-28
last_updated: 2026-05-08
depends_on: []
composes_with: [081KQ0YZ80008QG0R001QJJTVF]
children: [081KR2E4K0008QG0R003DS2XHJ, 081KR2E4K0008QG0R001ZWARTN, 081KR2E4K0008QG0R0009QXZ77, 081KR2E4K0008QG0R00289GE8Z, 081KR2E4K0008QG0R001ADMBVW, 081KR2E4K0008QG0R000R3ZVGD, 081KR2E4K0008QG0R0032TWN5H]
tags: [substrate-quality, beacon-safety, otto-351, otto-352, external-anchors, human-lineage, prior-art, agent-design-research, research-discipline]
type: friction-reducer
---

# Human-lineage / external-anchor backfill across all substrate

Backfill external prior-art anchors (papers, RFCs, blog posts,
Stack Overflow / Stack Exchange threads, conference talks,
public agent-design discussions) for every load-bearing
substrate concept in the factory. Goal: every load-bearing
concept has either (a) a cited human-authored external anchor
OR (b) an explicit "no prior art found, this is original" note
(so absence is itself documented).

## Why

Aaron 2026-04-28:

> *"we should backlog human lineage to all our substraight
> stuff too if it exists, all our AI stuff even though we
> are just editing md files is coding and thee might be
> articles and research papers or question/answer fourms
> stack overflow etc... we should research waht we've
> already done and make sure it's beacon safe and human
> anchored/linage."*

Two load-bearing observations:

1. **Editing Markdown for AI substrate IS coding.** The
   substrate doc-writing (memories, BP rules, Otto-NN named
   principles, Glass-Halo doctrine) is a form of software
   engineering. Software engineering has decades of public
   prior art. Ignoring that prior art means re-deriving what's
   already known and missing pitfalls others have documented.
2. **Beacon-safe + human-anchored.** Per Otto-351 (Beacon
   naming + lineage rigor), substrate concepts gain
   credibility from human-authored anchoring. A concept named
   "Otto-NNN" is internal-vocabulary; the same concept cited
   to a paper / RFC / conference talk gains external lineage
   that survives the project's lifetime + is teachable to
   external collaborators.

## Phasing proposal

**Phase 1 — audit (M effort, 1 round):**
Enumerate substrate concepts that DO and DON'T have external
anchors today. Output: a coverage table mapping each concept
to either a citation list or an "anchor-pending" marker.
Targets to enumerate:

- HC-1..HC-7 / SD-1..SD-9 / DIR-1..DIR-5 alignment clauses
  (`docs/ALIGNMENT.md`)
- Otto-NN named principles (~360 entries; the per-Otto-NN
  mapping is already tracked as task #288 — Otto-349
  per-Otto-NN ↔ named-principle mapping, BACKLOG-deferred)
- BP-NN best-practice rules (`docs/AGENT-BEST-PRACTICES.md`)
- Glass-Halo substrate doctrines (radical honesty, total-
  observability, etc.)
- Aurora doctrine concepts (Immune Governance Layer, ferry
  protocol, KSK, etc.)
- Memory files under `memory/` (~1500 entries)
- Research reports under `docs/research/`

**Phase 2 — high-priority backfill (L effort, 2-3 rounds):**
Anchor the load-bearing concepts first. Priority ordering:

1. HC-/SD-/DIR- alignment clauses (most-cited; Beacon-safe
   matters most here for external collaborators)
2. Otto-NN named principles that compose into wake-time
   disciplines (Otto-247 / Otto-275 / Otto-279 / Otto-341 /
   Otto-351 / Otto-352 / Otto-357)
3. BP-NN rules that fire in CI / pre-commit hooks
4. Glass-Halo doctrines visible on the public-facing
   surfaces (README, AGENTS.md, CLAUDE.md)

**Phase 3 — long-tail (cadenced, ongoing):**
Memory-file coverage on a cadence (e.g., every 10th memory
file in a sweep). Covered by an existing backlog row for
periodic memory-index audits.

## Done-criteria

For each load-bearing substrate concept:

- [ ] Coverage table entry exists.
- [ ] Either (a) at least one cited external anchor (paper /
      RFC / blog / Stack Overflow / Stack Exchange / public
      talk / conference proceedings) OR (b) explicit
      "no prior art found, original to Zeta" note.
- [ ] Anchor checked for Beacon-safety: the cited source's
      vocabulary doesn't collide with Beacon-blocked
      terminology (per Otto-351 + the prompt-protector
      review).

## Decomposition (2026-05-08)

This umbrella row is decomposed into 7 atomic child rows,
dependency-ordered across 3 layers:

**Layer 0 — Tooling (no external deps, buildable now):**

| Child | Title | Effort | Depends on |
| --- | --- | --- | --- |
| 081KR2E4K0008QG0R003DS2XHJ | Concept-registry extraction tool | S | — |

**Layer 1 — Scanner (depends on registry):**

| Child | Title | Effort | Depends on |
| --- | --- | --- | --- |
| 081KR2E4K0008QG0R001ZWARTN | External-anchor coverage scanner | S | 081KR2E4K0008QG0R003DS2XHJ |

**Layer 2 — Research backfill (parallelizable, depends on scanner):**

| Child | Title | Effort | Depends on |
| --- | --- | --- | --- |
| 081KR2E4K0008QG0R0009QXZ77 | HC/SD/DIR alignment-clause anchor backfill | M | 081KR2E4K0008QG0R001ZWARTN |
| 081KR2E4K0008QG0R00289GE8Z | Wake-time Otto-NN principle anchor backfill | M | 081KR2E4K0008QG0R001ZWARTN |
| 081KR2E4K0008QG0R001ADMBVW | BP-NN rule anchor backfill | M | 081KR2E4K0008QG0R001ZWARTN |
| 081KR2E4K0008QG0R000R3ZVGD | Glass-Halo doctrine anchor backfill | S | 081KR2E4K0008QG0R001ZWARTN |

**Layer 3 — Long-tail cadence (depends on scanner):**

| Child | Title | Effort | Depends on |
| --- | --- | --- | --- |
| 081KR2E4K0008QG0R0032TWN5H | Long-tail anchor cadenced sweep setup | S | 081KR2E4K0008QG0R001ZWARTN |

Dependency graph:
```
081KR2E4K0008QG0R003DS2XHJ → 081KR2E4K0008QG0R001ZWARTN → 081KR2E4K0008QG0R0009QXZ77 (HC/SD/DIR)
                 → 081KR2E4K0008QG0R00289GE8Z (Otto-NN)
                 → 081KR2E4K0008QG0R001ADMBVW (BP-NN)
                 → 081KR2E4K0008QG0R000R3ZVGD (Glass-Halo)
                 → 081KR2E4K0008QG0R0032TWN5H (cadence setup)
```

## Composes with

- **081KQ0YZ80008QG0R001QJJTVF** — ALIGNMENT.md rewrite. Phase 2 anchoring of
  HC/SD/DIR clauses lands cleanly during the rewrite.
- **Otto-352** — external-anchor-lineage discipline already
  applied to the live-lock 5-class taxonomy. This row
  generalises it to all substrate.
- **`feedback_search_internet_when_self_fixing_*`** — the
  parent rule for *new* self-fixing rules. This row does the
  *backfill* for *existing* substrate.
- **Otto-351** — Beacon naming + lineage + rigor work.
  External anchors raise the rigor floor.

## Reviewers

- `alignment-auditor` — for HC/SD/DIR coverage signal.
- `threat-model-critic` — for security-substrate coverage.
- The human maintainer — for Beacon-safe-language pass on
  any anchor that surfaces vocabulary the project has chosen
  to avoid.
