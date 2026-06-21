---
id: 081KRHWGX0008QG0R0023FDYVE
priority: P1
status: open
title: "Mirror/Beacon axis ADR — two-axis design decision (extends 2026-04-22 ADR)"
type: adr
origin: 081KRFA460008QG0R0007RWSN1 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0007RWSN1
depends_on:
  - 081KRHWGX0008QG0R002DP6AZN
  - 081KRHWGX0008QG0R0031EGYA7
composes_with:
  - 081KRFA460008QG0R0007RWSN1
  - 081KRHWGX0008QG0R002VV6DTS
  - 081KRHWGX0008QG0R002DP6AZN
  - 081KRHWGX0008QG0R0031EGYA7
  - 081KRFA460008QG0R001H98EXJ
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
  - docs/DECISIONS/2026-05-14-product-repo-split-decisions.md
---

# Mirror/Beacon axis ADR — two-axis design decision (extends 2026-04-22 ADR)

## Purpose

Synthesize the outputs of 081KRHWGX0008QG0R002DP6AZN (classification matrix) and 081KRHWGX0008QG0R0031EGYA7
(promotion gate protocol) into a committed architecture decision record.
This ADR extends the 2026-04-22 three-repo-split ADR to cover Axis 2
(Mirror/Beacon) and becomes the canonical reference for all future
repo-split decisions on this axis.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] 081KRHWGX0008QG0R002DP6AZN output doc reviewed (classification matrix complete)
- [ ] 081KRHWGX0008QG0R0031EGYA7 output doc reviewed (promotion gate protocol complete)
- [ ] 2026-04-22 ADR and 2026-05-14 product-repo-split ADR reviewed
  to ensure consistent framing and no contradictions
- [ ] Ambiguous-repo flags from 081KRHWGX0008QG0R002DP6AZN addressed

## ADR structure (output doc template)

```
docs/DECISIONS/2026-05-14-mirror-beacon-axis-two-axis-design.md
```

Required sections:

### Context

- Two-axis system: Axis 1 (Factory/Product/Owner-only) + Axis 2 (Mirror/Beacon)
- Aaron's 2026-05-13 framing: *"we should probalbu split repos based on nthat too another orthoganality"*
- Companion to: 2026-04-22 three-repo-split ADR + 2026-05-14 product-repo-split ADR

### Decision: Mirror/Beacon axis definition

- Precise Mirror tier definition (criteria)
- Precise Beacon tier definition (criteria)
- Default: all new repos start at Mirror
- Promotion: per 081KRHWGX0008QG0R0031EGYA7 gate protocol

### Decision: per-repo Axis-2 assignments

- Complete two-axis matrix from 081KRHWGX0008QG0R002DP6AZN
- Rationale for any ambiguous cases resolved here

### Decision: Mirror→Beacon promotion gate

- Summary of 081KRHWGX0008QG0R0031EGYA7 protocol (full protocol lives in the 081KRHWGX0008QG0R0031EGYA7 research doc)
- Reference to the `PromotionProposal` template

### Consequences

- What changes with this ADR (repo creation process, CONTRIBUTING docs, etc.)
- What does NOT change (Axis-1 positions, honor-system license, fork posture)
- Relationship to existing rules (glass-halo, default-to-both, additive-not-zero-sum)

### Composes with

- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
- `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md`
- `docs/DECISIONS/2026-05-14-product-repo-glue-mechanism.md`
- `memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md`
- `docs/research/2026-05-18-mirror-beacon-two-axis-classification-matrix-b0472.md`
- `docs/research/2026-05-14-mirror-beacon-promotion-gate-protocol-b0473.md`

## Closing 081KRFA460008QG0R0007RWSN1

This ADR PR also:

- Updates 081KRFA460008QG0R0007RWSN1 status to `closed`
- Updates 081KRHWGX0008QG0R002VV6DTS/081KRHWGX0008QG0R002DP6AZN/081KRHWGX0008QG0R0031EGYA7/081KRHWGX0008QG0R0023FDYVE to `closed`
- Releases the `otto-cli` claim on 081KRFA460008QG0R0007RWSN1

## Definition of done

- [ ] ADR written and committed at canonical path
- [ ] Both Axis-2 decisions (definition + per-repo assignments + promotion gate)
  formally recorded
- [ ] All ambiguous repos from 081KRHWGX0008QG0R002DP6AZN resolved with explicit reasoning
- [ ] 081KRFA460008QG0R0007RWSN1 closed; all 4 child rows closed
- [ ] PR merged; claim released

## Why P1

- Terminal row for the 081KRFA460008QG0R0007RWSN1 planning item
- Produces the durable substrate-or-it-didn't-happen artifact (committed ADR)
- Without this, the prior-art audit + classification + protocol remain
  research-grade (Mirror tier); the ADR is what promotes them to Beacon
