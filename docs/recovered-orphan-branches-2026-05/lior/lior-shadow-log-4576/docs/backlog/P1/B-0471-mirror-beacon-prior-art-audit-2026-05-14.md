---
id: B-0471
priority: P1
status: closed
title: "Mirror/Beacon prior-art audit — collect and verify existing axis-2 substrate"
type: research
origin: B-0426 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-18
parent: B-0426
composes_with:
  - B-0426
  - B-0472
  - B-0473
  - B-0474
  - memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md
  - memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_speculative_fast_forks_vs_governance_citation_gated_another_orthogonality_2026_05_13.md
  - docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md
  - memory/feedback_doc_class_mirror_beacon_distinction_claudemd_beacon_memory_mirror_2026_04_27.md
  - memory/feedback_mirror_beacon_assessment_overnight_session_2026_05_11.md
---

# Mirror/Beacon prior-art audit — collect and verify existing axis-2 substrate

## Purpose

Before classifying repos (B-0472) or defining the promotion gate (B-0473),
collect all existing Mirror/Beacon substrate and verify it is current and
consistent. This prevents the backlog-item-start-gate failure mode of
beginning classification work with stale or contradictory substrate.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Prior-art search across wake-time-substrate, skill-router, orthogonal-axes
- [ ] Walk `parent:` chain (B-0426 → B-0425 closed; B-0424 still open)
- [ ] Backfill reciprocal `composes_with:` pointers on all referenced files

## Surfaces to audit

| Surface | Path | What to verify |
|---------|------|----------------|
| Otto-356 language register | `memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md` | Still accurate; not superseded |
| Repo-split mirror/beacon memory | `memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_speculative_fast_forks_vs_governance_citation_gated_another_orthogonality_2026_05_13.md` | Consistent with B-0426 |
| Mirror→Beacon gate research | `docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md` | Promotion-gate definition still load-bearing |
| Doc-class mirror/beacon | `memory/feedback_doc_class_mirror_beacon_distinction_claudemd_beacon_memory_mirror_2026_04_27.md` | CLAUDE.md/memory register applies to repos too |
| Overnight session assessment | `memory/feedback_mirror_beacon_assessment_overnight_session_2026_05_11.md` | Any repo-level decisions already made? |
| Threat-model mirror discipline | `docs/security/THREAT-MODEL.md` | Mirror/Beacon posture in threat-model |
| B-0426 backlog row | `docs/backlog/P1/B-0426-repo-split-orthogonal-mirror-beacon-axis-aaron-2026-05-13.md` | Illustrative matrix still matches current substrate |
| Product-repo ADR (B-0425 output) | `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md` | Axis-1 positions set; Axis-2 unset |
| civsim PR #2909 governance | PR #2909 (language → governance escalation) | Mirror/Beacon language discipline → repo topology |

## Output

A short research document at:

```
docs/research/2026-05-18-mirror-beacon-axis-prior-art-audit-b0471.md
```

Containing:

- Summary of all surfaces found, their current state, and whether they are
  consistent with each other
- Any conflicts or stale references identified
- Reciprocal pointer updates needed
- Substrate-ready signal: "ready for B-0472 and B-0473" or "blockers found"

## Definition of done

- [x] All 9 surfaces above surveyed, findings documented
- [x] Conflicts/staleness flagged (none expected; verify anyway)
- [x] Reciprocal `composes_with:` pointers added to all referenced files
- [x] Output doc committed and referenced from B-0426 pre-start checklist
- [x] B-0471 closed (status: closed) with PR link — [#4136](https://github.com/Lucent-Financial-Group/Zeta/pull/4136)

## Why P1

- Gate row for B-0472 and B-0473 — they depend on this
- Small bounded research task (read + summarize; no new design)
- Unblocks the classification and promotion-gate work
