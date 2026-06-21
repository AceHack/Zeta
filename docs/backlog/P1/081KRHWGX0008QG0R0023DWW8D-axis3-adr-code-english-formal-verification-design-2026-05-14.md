---
id: 081KRHWGX0008QG0R0023DWW8D
priority: P1
status: open
title: "Axis-3 ADR — Code/English + formal-verification three-axis design decision"
type: adr
origin: 081KRFA460008QG0R000VKJF0H decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R000VKJF0H
depends_on:
  - 081KRHWGX0008QG0R000BS8Y4R
  - 081KRHWGX0008QG0R002893S6E
  - 081KRHWGX0008QG0R0008EYYCA
composes_with:
  - 081KRFA460008QG0R000VKJF0H
  - 081KRHWGX0008QG0R000M9RFY2
  - 081KRHWGX0008QG0R000BS8Y4R
  - 081KRHWGX0008QG0R002893S6E
  - 081KRHWGX0008QG0R0008EYYCA
  - 081KRHWGX0008QG0R0023FDYVE
  - 081KRFA460008QG0R001H98EXJ
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
  - docs/DECISIONS/2026-05-14-product-repo-split-decisions.md
---

# Axis-3 ADR — Code/English + formal-verification three-axis design decision

## Purpose

Synthesize the outputs of 081KRHWGX0008QG0R000BS8Y4R (ruleset divergence audit), 081KRHWGX0008QG0R002893S6E
(Code/English classification matrix), and 081KRHWGX0008QG0R0008EYYCA (FV sub-axis evaluation)
into a committed architecture decision record.

This ADR extends the 2026-04-22 three-repo-split ADR and the 081KRHWGX0008QG0R0023FDYVE Axis-2
Mirror/Beacon ADR to cover Axis 3 (Code/English + FV sub-axis). Together,
the three ADRs form the complete three-axis repo-split design.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] 081KRHWGX0008QG0R000BS8Y4R output doc reviewed (ruleset divergence audit complete)
- [ ] 081KRHWGX0008QG0R002893S6E output doc reviewed (classification matrix complete)
- [ ] 081KRHWGX0008QG0R0008EYYCA output doc reviewed (FV evaluation complete)
- [ ] 2026-04-22 ADR reviewed for consistent framing
- [ ] 081KRHWGX0008QG0R0023FDYVE (Axis-2 ADR) reviewed — check whether it is closed or in-flight
- [ ] Ambiguous cases from 081KRHWGX0008QG0R002893S6E and 081KRHWGX0008QG0R0008EYYCA resolved

## ADR structure (output doc template)

```
docs/DECISIONS/2026-05-14-axis3-code-english-formal-verification-design.md
```

Required sections:

### Context

- Three-axis system: Axis 1 (Factory/Product/Owner-only) + Axis 2 (Mirror/Beacon)
  + Axis 3 (Code/English + FV sub-axis)
- Aaron's 2026-05-13 framing (verbatim from 081KRFA460008QG0R000VKJF0H)
- Companion to: 2026-04-22 ADR + 2026-05-14 product-repo ADR + 081KRHWGX0008QG0R0023FDYVE Axis-2 ADR
- DV2.0 change-rate framing (the intellectual foundation for Code/English cut)

### Decision: Code/English tier definitions

- Precise Code tier definition
- Precise English tier definition
- Engineering-docs exception (canonical list of doc types that stay with code)
- Default: Code-tier content is co-located with source unless DV2.0 criteria met

### Decision: per-repo Axis-3 assignments

- Complete three-axis matrix (adds Axis-3 column to the Axis-1/Axis-2 matrix)
- Rationale for any ambiguous cases resolved here
- Where English-tier split is recommended: explicit repo scope

### Decision: Formal-verification sub-axis

- Per-property-class decisions from 081KRHWGX0008QG0R0008EYYCA (co-locate / split)
- FsCheck co-locate decision (pre-decided; rationale included)
- Any new FV repos proposed (with scope and owner)

### Decision: Ruleset-divergence smell test operationalization

- Summary of 081KRHWGX0008QG0R000BS8Y4R findings
- Which divergences confirmed split recommendations
- Which divergences were resolved by ruleset alignment instead
- Canonical statement: "the ruleset divergence smell test is operative
  at repo-creation time" (or: "the smell test is advisory")

### Consequences

- What changes with this ADR (repo-creation process, CI templates,
  CONTRIBUTING docs)
- What does NOT change (Axis-1/Axis-2 positions, honor-system license)
- Relationship to existing rules (DV2.0, default-to-both, additive-not-zero-sum)

### Composes with

- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
- `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md`
- `docs/DECISIONS/2026-05-14-mirror-beacon-axis-two-axis-design.md` (081KRHWGX0008QG0R0023FDYVE output)
- `docs/research/2026-05-14-axis3-prior-art-audit-b0475.md`
- `docs/research/2026-05-14-github-ruleset-divergence-audit-b0476.md`
- `docs/research/2026-05-14-axis3-code-english-classification-matrix-b0477.md`
- `docs/research/2026-05-14-formal-verification-repo-split-evaluation-b0478.md`

## Closing 081KRFA460008QG0R000VKJF0H

This ADR PR also:

- Updates 081KRFA460008QG0R000VKJF0H status to `closed`
- Updates 081KRHWGX0008QG0R000M9RFY2/081KRHWGX0008QG0R000BS8Y4R/081KRHWGX0008QG0R002893S6E/081KRHWGX0008QG0R0008EYYCA/081KRHWGX0008QG0R0023DWW8D to `closed`
- Releases the `otto-cli` claim on 081KRFA460008QG0R000VKJF0H

## Definition of done

- [ ] ADR written and committed at canonical path
- [ ] All three Axis-3 decisions formally recorded
  (Code/English tiers + FV sub-axis + ruleset smell test)
- [ ] All ambiguous repos from 081KRHWGX0008QG0R002893S6E and 081KRHWGX0008QG0R0008EYYCA resolved with explicit reasoning
- [ ] Three-axis matrix complete (Axis 1 + 2 + 3 for all repos)
- [ ] 081KRFA460008QG0R000VKJF0H closed; all 5 child rows closed
- [ ] PR merged; claim released

## Why P1

- Terminal row for the 081KRFA460008QG0R000VKJF0H planning item
- Produces the durable substrate-or-it-didn't-happen artifact (committed ADR)
- Without this ADR, the prior-art audit + classification + ruleset audit +
  FV evaluation remain research-grade (Mirror tier); the ADR is what
  promotes them to Beacon and makes them operative
- Completes the three-axis design space opened by 081KRFA460008QG0R001H98EXJ/081KRFA460008QG0R003JQ46J4/081KRFA460008QG0R0007RWSN1/081KRFA460008QG0R000VKJF0H
