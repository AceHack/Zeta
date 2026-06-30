---
id: B-0479
priority: P1
status: closed
title: "Axis-3 ADR — Code/English + formal-verification three-axis design decision"
type: adr
origin: B-0427 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0427
depends_on:
  - B-0476
  - B-0477
  - B-0478
composes_with:
  - B-0427
  - B-0475
  - B-0476
  - B-0477
  - B-0478
  - B-0474
  - B-0424
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
  - docs/DECISIONS/2026-05-14-product-repo-split-decisions.md
---

# Axis-3 ADR — Code/English + formal-verification three-axis design decision

## Purpose

Synthesize the outputs of B-0476 (ruleset divergence audit), B-0477
(Code/English classification matrix), and B-0478 (FV sub-axis evaluation)
into a committed architecture decision record.

This ADR extends the 2026-04-22 three-repo-split ADR and the B-0474 Axis-2
Mirror/Beacon ADR to cover Axis 3 (Code/English + FV sub-axis). Together,
the three ADRs form the complete three-axis repo-split design.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] B-0476 output doc reviewed (ruleset divergence audit complete)
- [x] B-0477 output doc reviewed (classification matrix complete)
- [x] B-0478 output doc reviewed (FV evaluation complete)
- [x] 2026-04-22 ADR reviewed for consistent framing
- [x] B-0474 (Axis-2 ADR) reviewed — check whether it is closed or in-flight
- [x] Ambiguous cases from B-0477 and B-0478 resolved

## ADR structure (output doc template)

```
docs/DECISIONS/2026-05-14-axis3-code-english-formal-verification-design.md
```

Required sections:

### Context

- Three-axis system: Axis 1 (Factory/Product/Owner-only) + Axis 2 (Mirror/Beacon)
  + Axis 3 (Code/English + FV sub-axis)
- Aaron's 2026-05-13 framing (verbatim from B-0427)
- Companion to: 2026-04-22 ADR + 2026-05-14 product-repo ADR + B-0474 Axis-2 ADR
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

- Per-property-class decisions from B-0478 (co-locate / split)
- FsCheck co-locate decision (pre-decided; rationale included)
- Any new FV repos proposed (with scope and owner)

### Decision: Ruleset-divergence smell test operationalization

- Summary of B-0476 findings
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
- `docs/DECISIONS/2026-05-14-mirror-beacon-axis-two-axis-design.md` (B-0474 output)
- `docs/research/2026-05-14-axis3-prior-art-audit-b0475.md`
- `docs/research/2026-05-14-github-ruleset-divergence-audit-b0476.md`
- `docs/research/2026-05-14-axis3-code-english-classification-matrix-b0477.md`
- `docs/research/2026-05-14-formal-verification-repo-split-evaluation-b0478.md`

## Closing B-0427

This ADR PR also:

- Updates B-0427 status to `closed`
- Updates B-0475/B-0476/B-0477/B-0478/B-0479 to `closed`
- Releases the `otto-cli` claim on B-0427

## Definition of done

- [x] ADR written and committed at canonical path
- [x] All three Axis-3 decisions formally recorded
  (Code/English tiers + FV sub-axis + ruleset smell test)
- [x] All ambiguous repos from B-0477 and B-0478 resolved with explicit reasoning
- [x] Three-axis matrix complete (Axis 1 + 2 + 3 for all repos)
- [x] B-0427 closed; all 5 child rows closed
- [x] PR merged; claim released

## Why P1

- Terminal row for the B-0427 planning item
- Produces the durable substrate-or-it-didn't-happen artifact (committed ADR)
- Without this ADR, the prior-art audit + classification + ruleset audit +
  FV evaluation remain research-grade (Mirror tier); the ADR is what
  promotes them to Beacon and makes them operative
- Completes the three-axis design space opened by B-0424/B-0425/B-0426/B-0427
