---
id: B-0475
priority: P1
status: closed
title: "Axis-3 prior-art audit — verify three-axis substrate composes without conflict"
type: research
origin: B-0427 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0427
composes_with:
  - B-0427
  - B-0424
  - B-0425
  - B-0426
  - B-0476
  - B-0477
  - B-0478
  - B-0479
  - memory/feedback_aaron_repo_split_third_orthogonal_axis_code_vs_english_formal_verification_maybe_split_ruleset_divergence_is_smell_2026_05_13.md
  - memory/feedback_orthogonal_axes_factory_hygiene.md
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
---

# Axis-3 prior-art audit — verify three-axis substrate composes without conflict

## Purpose

Before classifying repos (B-0477) or running the ruleset audit (B-0476),
collect all existing Axis-3-relevant substrate and verify it is current and
consistent. This is the gate row: no classification work begins until the
substrate has been surveyed and conflicts identified.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] Prior-art search across wake-time-substrate, skill-router, orthogonal-axes
- [x] Walk `parent:` chain (B-0427 → B-0426 / B-0425 / B-0424 — check current status of each)
- [x] Backfill reciprocal `composes_with:` pointers on all referenced files

## Surfaces to audit

| Surface | Path | What to verify |
|---------|------|----------------|
| B-0427 parent row | `docs/backlog/P1/B-0427-*.md` | Axis-3 scope and constraints still accurate |
| Axis-1 ADR (three-repo split) | `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` | Axis-1 positions set; no Axis-3 conflict |
| Axis-1 product-repo ADR | `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md` | Axis-1 + glue mechanism decided; check for Axis-3 implications |
| Axis-2 substrate (B-0426 parent row) | `docs/backlog/P1/B-0426-*.md` | Mirror/Beacon; confirm Axis-2 in-flight status |
| Orthogonal-axes memory | `memory/feedback_orthogonal_axes_factory_hygiene.md` | All three axes consistent |
| Aaron's Axis-3 framing | `memory/feedback_aaron_repo_split_third_orthogonal_axis_code_vs_english_formal_verification_maybe_split_ruleset_divergence_is_smell_2026_05_13.md` | Framing matches B-0427 body |
| B-0424 (factory split) | `docs/backlog/P1/B-0424-*.md` | Stage-1 factory split — does Axis-3 affect Stage-1 scope? |
| DV2.0 rule | `.claude/rules/dv2-data-split-discipline-activated.md` | DV2.0 hub-satellite partition directly informs Code/English cut |
| GOVERNANCE.md (repo-placement sections) | `GOVERNANCE.md` | Search for "repo" or "directory" headings — any sections that classify which docs belong in which repo per engineering-practices (e.g. `grep -n "^## " GOVERNANCE.md` to enumerate sections) |

## Questions this audit must answer

1. Does the engineering-docs exception (README/ADR/CONTRIBUTING/etc. stay with code)
   have an existing canonical definition, or is it first defined here?
2. Does Axis-2 (Mirror/Beacon) constrain Axis-3 options for any repo?
3. Does B-0424 (Stage-1 factory split) produce any Axis-3 pre-decisions?
4. Is the "formal-verification sub-axis" already addressed anywhere in substrate?
5. Are there any existing GitHub rulesets that have already been documented
   as diverging (pre-empting B-0476's work)?

## Output

A short research document at:

```
docs/research/2026-05-14-axis3-prior-art-audit-b0475.md
```

Containing:

- Summary of all surfaces found, their current state, and whether they are
  consistent with each other
- Any conflicts or stale references identified
- Answers to the five questions above
- Reciprocal pointer updates needed
- Substrate-ready signal: "ready for B-0476/B-0477/B-0478" or "blockers found"

## Definition of done

- [x] All 9 surfaces above surveyed; findings documented
- [x] Five questions answered in output doc
- [x] Conflicts/staleness flagged
- [x] Reciprocal `composes_with:` pointers added to all referenced files
- [x] Output doc committed and referenced from B-0427 pre-start checklist
- [x] B-0475 closed (status: closed) with PR link

## Why P1

- Gate row for B-0476/B-0477/B-0478 — they depend on this
- Small bounded research task (read + summarize; no new design)
- Unblocks all three parallel work streams
