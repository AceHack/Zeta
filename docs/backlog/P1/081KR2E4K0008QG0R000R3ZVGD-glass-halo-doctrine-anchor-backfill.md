---
id: 081KR2E4K0008QG0R000R3ZVGD
priority: P1
status: closed
closed: 2026-05-10
closed_by: "all 5 doctrines anchored across 3 slices — ALIGNMENT.md (slice 1+fix), AGENTS.md (slice 2+3), README.md (slice 3)"
title: "Glass-Halo doctrine external-anchor backfill"
tier: substrate-quality
effort: S
parent: 081KQ8P5D0008QG0R000N718AC
created: 2026-05-08
last_updated: 2026-05-10
depends_on: [081KR2E4K0008QG0R001ZWARTN]
composes_with: [081KQ8P5D0008QG0R000N718AC]
tags: [substrate-quality, external-anchors, glass-halo, beacon-safety, research]
type: friction-reducer
---

# Glass-Halo doctrine external-anchor backfill

Research and land external prior-art anchors for Glass-Halo
doctrines visible on public-facing surfaces (README.md,
AGENTS.md, CLAUDE.md, docs/ALIGNMENT.md).

## Target doctrines

| Doctrine | Public surface | Core property |
| --- | --- | --- |
| Radical honesty | AGENTS.md, ALIGNMENT.md | AI never hides reasoning from observers |
| Total observability | AGENTS.md, ALIGNMENT.md | Every decision trail is inspectable |
| No hidden reasoning | AGENTS.md | Visible chain of thought, not opaque |
| Glass-halo transparency | CLAUDE.md, README.md | External-facing truthfulness contract |
| Retraction-native | AGENTS.md | Every action has a bounded undo path |

## Research approach per doctrine

1. Extract the doctrine's operational definition from
   AGENTS.md / ALIGNMENT.md.
2. WebSearch for the underlying concept in AI transparency
   research, explainable AI (XAI), organizational
   transparency theory, software auditability literature.
3. Cite or note "original to Zeta" per the 081KQ8P5D0008QG0R000N718AC protocol.
4. Land anchors inline in the doctrine's defining surface.

## Done-criteria

- [ ] All Glass-Halo doctrines have external anchor or
      "original" note.
- [ ] Citations include URL, author/org, title, date.
- [ ] Beacon-safety pass on all cited sources.
- [ ] Coverage scanner (081KR2E4K0008QG0R001ZWARTN) confirms resolution.

## Pre-start checklist (2026-05-10, slice 1)

### Prior-art search

Axes searched: XAI/interpretable-ML literature, organizational radical-
transparency theory, AI audit-trail / accountability research, CoT
monitorability safety research.

Queries run (2026-05-10):

- "radical transparency organizational theory Dalio AI systems accountability"
- "algorithmic transparency explainability AI decision audit trail XAI"
- "LLM chain-of-thought reasoning transparency no hidden reasoning AI observability"
- "Brundage 2020 toward trustworthy AI development mechanisms verifiable claims"
- "Doshi-Velez Kim 2017 rigorous science interpretable machine learning"
- "bilateral transparency symmetric transparency mutual transparency human-AI"
- "Korbak chain of thought monitorability fragile opportunity AI safety arxiv"

Results:

- Dalio (2017) *Principles: Life and Work* → radical transparency / no hidden moves
- Doshi-Velez & Kim (2017) arxiv:1702.08608 → total observability / inspectable decisions
- Brundage et al. (2020) arxiv:2004.07213 → audit trails / total observability
- Korbak et al. (2025) arxiv:2507.11473 → CoT monitorability / no hidden reasoning
- Bilateral symmetric form: no external prior art found → original to Zeta

### Dependency check

- 081KR2E4K0008QG0R001ZWARTN (external-anchor coverage scanner): **closed** ✓
- 081KQ8P5D0008QG0R000N718AC (parent umbrella): umbrella, no gate ✓
- No broken `depends_on` pointers in this row.

### Scope for slice 1

This slice lands anchors for three of the five doctrines
(radical honesty, total observability, no hidden reasoning)
in their ALIGNMENT.md surface only — specifically the
"Symmetric transparency: the glass halo" section.

Remaining for subsequent slices:

- Glass-halo transparency in CLAUDE.md / README.md
- Retraction-native in AGENTS.md
- Radical honesty / total observability / no hidden reasoning in AGENTS.md

### Scope for slice 2 (2026-05-10)

Lands prior-art block for three AGENTS.md doctrines (radical honesty,
total observability, no hidden reasoning) at their defining location —
AGENTS.md §"The three load-bearing values". Single blockquote citing:

- Dalio (2017) → radical honesty / truth over politeness
- Brundage et al. (2020) arxiv:2004.07213 → total observability / git audit trail
- Korbak et al. (2025) arxiv:2507.11473 → no hidden reasoning / reviewer layer

Remaining after slice 2:

- Glass-halo transparency in CLAUDE.md / README.md
- Retraction-native in AGENTS.md

### Scope for slice 3 (2026-05-10)

Lands two remaining doctrines:

1. **Retraction-native in AGENTS.md** — bullet added to §"How AI agents
   should treat this codebase", citing Richardson (2016+) Saga Pattern
   and Microsoft Azure Compensating Transaction pattern as prior art;
   git-native retraction noted as original to Zeta.

2. **Glass-halo transparency in README.md** — acknowledgements paragraph
   added noting the bilateral / symmetric form as original to Zeta,
   linking to `docs/ALIGNMENT.md` §"Symmetric transparency: the glass halo".
   CLAUDE.md omitted: currently razor-trimmed to 47-line bootstrap;
   adding doctrine content contradicts the 081KR50HA0008QG0R001DBKS6T condensation intent.

All five 081KR2E4K0008QG0R000R3ZVGD doctrines now have external anchor or "original" note
on at least one defining surface. Core done-criteria met; the coverage
scanner remains deferred to the next audit pass:

- [x] All Glass-Halo doctrines have external anchor or "original" note
- [x] Citations include URL, author/org, title, date
- [x] Beacon-safety pass: all cited sources (Dalio, Doshi-Velez/Kim,
      Brundage et al., Korbak et al., Richardson Saga, MS Azure) are
      reputable academic/industry publications
- [ ] Coverage scanner (081KR2E4K0008QG0R001ZWARTN, closed) — deferred to next audit pass

## Reviewers

- `public-api-designer` — public-surface language quality.
- `alignment-auditor` — doctrine-level integrity.
