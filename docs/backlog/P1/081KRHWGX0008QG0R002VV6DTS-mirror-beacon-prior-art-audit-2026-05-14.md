---
id: 081KRHWGX0008QG0R002VV6DTS
priority: P1
status: open
title: "Mirror/Beacon prior-art audit — collect and verify existing axis-2 substrate"
type: research
origin: 081KRFA460008QG0R0007RWSN1 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0007RWSN1
composes_with:
  - 081KRFA460008QG0R0007RWSN1
  - 081KRHWGX0008QG0R002DP6AZN
  - 081KRHWGX0008QG0R0031EGYA7
  - 081KRHWGX0008QG0R0023FDYVE
  - memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md
  - memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_speculative_fast_forks_vs_governance_citation_gated_another_orthogonality_2026_05_13.md
  - docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md
  - memory/feedback_doc_class_mirror_beacon_distinction_claudemd_beacon_memory_mirror_2026_04_27.md
  - memory/feedback_mirror_beacon_assessment_overnight_session_2026_05_11.md
---

# Mirror/Beacon prior-art audit — collect and verify existing axis-2 substrate

## Purpose

Before classifying repos (081KRHWGX0008QG0R002DP6AZN) or defining the promotion gate (081KRHWGX0008QG0R0031EGYA7),
collect all existing Mirror/Beacon substrate and verify it is current and
consistent. This prevents the backlog-item-start-gate failure mode of
beginning classification work with stale or contradictory substrate.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Prior-art search across wake-time-substrate, skill-router, orthogonal-axes
- [ ] Walk `parent:` chain (081KRFA460008QG0R0007RWSN1 → 081KRFA460008QG0R003JQ46J4 closed; 081KRFA460008QG0R001H98EXJ still open)
- [ ] Backfill reciprocal `composes_with:` pointers on all referenced files

## Surfaces to audit

| Surface | Path | What to verify |
|---------|------|----------------|
| Otto-356 language register | `memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md` | Still accurate; not superseded |
| Repo-split mirror/beacon memory | `memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_speculative_fast_forks_vs_governance_citation_gated_another_orthogonality_2026_05_13.md` | Consistent with 081KRFA460008QG0R0007RWSN1 |
| Mirror→Beacon gate research | `docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md` | Promotion-gate definition still load-bearing |
| Doc-class mirror/beacon | `memory/feedback_doc_class_mirror_beacon_distinction_claudemd_beacon_memory_mirror_2026_04_27.md` | CLAUDE.md/memory register applies to repos too |
| Overnight session assessment | `memory/feedback_mirror_beacon_assessment_overnight_session_2026_05_11.md` | Any repo-level decisions already made? |
| Threat-model mirror discipline | `docs/security/THREAT-MODEL.md` | Mirror/Beacon posture in threat-model |
| 081KRFA460008QG0R0007RWSN1 backlog row | `docs/backlog/P1/081KRFA460008QG0R0007RWSN1-repo-split-orthogonal-mirror-beacon-axis-aaron-2026-05-13.md` | Illustrative matrix still matches current substrate |
| Product-repo ADR (081KRFA460008QG0R003JQ46J4 output) | `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md` | Axis-1 positions set; Axis-2 unset |
| civsim PR #2909 governance | PR #2909 (language → governance escalation) | Mirror/Beacon language discipline → repo topology |

## Output

A short research document at:

```
docs/research/2026-05-14-mirror-beacon-axis-prior-art-audit-b0471.md
```

Containing:

- Summary of all surfaces found, their current state, and whether they are
  consistent with each other
- Any conflicts or stale references identified
- Reciprocal pointer updates needed
- Substrate-ready signal: "ready for 081KRHWGX0008QG0R002DP6AZN and 081KRHWGX0008QG0R0031EGYA7" or "blockers found"

## Definition of done

- [ ] All 9 surfaces above surveyed, findings documented
- [ ] Conflicts/staleness flagged (none expected; verify anyway)
- [ ] Reciprocal `composes_with:` pointers added to all referenced files
- [ ] Output doc committed and referenced from 081KRFA460008QG0R0007RWSN1 pre-start checklist
- [ ] 081KRHWGX0008QG0R002VV6DTS closed (status: closed) with PR link

## Why P1

- Gate row for 081KRHWGX0008QG0R002DP6AZN and 081KRHWGX0008QG0R0031EGYA7 — they depend on this
- Small bounded research task (read + summarize; no new design)
- Unblocks the classification and promotion-gate work
