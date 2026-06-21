---
id: 081KRHWGX0008QG0R0031EGYA7
priority: P1
status: open
title: "Mirror→Beacon promotion gate protocol — concrete criteria for repo-level graduation"
type: design
origin: 081KRFA460008QG0R0007RWSN1 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0007RWSN1
depends_on:
  - 081KRHWGX0008QG0R002VV6DTS
composes_with:
  - 081KRFA460008QG0R0007RWSN1
  - 081KRHWGX0008QG0R002VV6DTS
  - 081KRHWGX0008QG0R002DP6AZN
  - 081KRHWGX0008QG0R0023FDYVE
  - docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md
  - docs/ALIGNMENT.md
  - memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md
  - memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_speculative_fast_forks_vs_governance_citation_gated_another_orthogonality_2026_05_13.md
---

# Mirror→Beacon promotion gate protocol — concrete criteria for repo-level graduation

## Purpose

Define the concrete criteria that gate a repo's graduation from Mirror to
Beacon tier. The 081KRFA460008QG0R0007RWSN1 item names the gate but leaves it abstract. This
row makes it actionable: what exactly must be true for a repo to be
promoted?

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] 081KRHWGX0008QG0R002VV6DTS prior-art audit complete (especially the promotion-gate
  research doc at `docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md`)
- [ ] `docs/ALIGNMENT.md` reviewed — which clauses apply at Beacon tier?
- [ ] Reciprocal pointers on 081KRHWGX0008QG0R002VV6DTS/081KRHWGX0008QG0R002DP6AZN/081KRHWGX0008QG0R0023FDYVE verified

## Gate dimensions to specify

### 1. Citation requirement

From `docs/research/2026-05-01-claudeai-mirror-beacon-gate-taxonomy-canonicalization-aaron-forwarded.md`:

> "Each class lands as Mirror by default. Promotion to Beacon requires
> an external citation that did the same work in another domain."

At repo scope, this means:

- What citation threshold is required? (≥1 published work? ≥N?)
- What citation types count? (academic papers, RFCs, published standards,
  industry specs with version + date?)
- Who verifies the citation is real (not hallucinated)?
- Does the factory's existing verification stack cover this? (e.g.,
  `missing-citations` skill)

### 2. Alignment-floor check

Beacon repos carry alignment-floor expectations. Specify:

- Which `docs/ALIGNMENT.md` clauses are required at Beacon tier?
  (HC-1..HC-7 / SD-1..SD-8 / DIR-1..DIR-5)
- Is a passing alignment-audit required before promotion?
- Which persona/agent performs the audit? (alignment-auditor Sova)
- What evidence format is required?

### 3. Governance sign-off

Specify who must approve a Mirror→Beacon promotion:

- Aaron only?
- Aaron + alignment-auditor audit passing?
- PR process (merge to main = approval)?
- What governance document records the promotion decision?

### 4. Fork-engagement protocol change

On promotion, fork-engagement protocol shifts:

- Mirror: "forks encouraged to advance substrate (agree + push back)"
- Beacon: "forks encouraged to validate / propose-promotion"

Specify:

- Is this change documented in the repo's README/CONTRIBUTING?
- Is the license clause affected (honor-system language changes)?
- Who updates the fork-engagement docs on promotion?

### 5. Demotion criteria (Beacon→Mirror)

Should downward mobility be possible? Specify:

- Can a Beacon repo be demoted to Mirror?
- Under what circumstances?
- What happens to existing citation lineage?

## Output

A protocol document at:

```
docs/research/2026-05-14-mirror-beacon-promotion-gate-protocol-b0473.md
```

Containing:

- The 5 gate dimensions above, each with concrete answers
- A single-page checklist a future agent can use when proposing promotion
- A `PromotionProposal` template (frontmatter-based, analogous to ADR format)
- Reference to the taxonomy research doc as prior art

## Definition of done

- [ ] All 5 gate dimensions answered with concrete criteria
- [ ] Checklist form of the gate produced (not just prose)
- [ ] `PromotionProposal` template drafted
- [ ] Protocol doc cross-references alignment-auditor role
- [ ] 081KRHWGX0008QG0R0031EGYA7 closed with PR link; 081KRHWGX0008QG0R0023FDYVE unblocked

## Why P1

- Direct dependency for 081KRHWGX0008QG0R0023FDYVE ADR
- Can run in parallel with 081KRHWGX0008QG0R002DP6AZN after 081KRHWGX0008QG0R002VV6DTS completes
- Bounded design task: answer 5 questions, produce checklist
- Without this, 081KRHWGX0008QG0R0023FDYVE ADR cannot document the gate (undefined)
