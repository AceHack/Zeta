---
id: 081KR2E4K0008QG0R0009QXZ77
priority: P1
status: in-progress
title: "HC/SD/DIR alignment-clause external-anchor backfill"
tier: substrate-quality
effort: M
parent: 081KQ8P5D0008QG0R000N718AC
created: 2026-05-08
last_updated: 2026-05-09
depends_on: [081KR2E4K0008QG0R001ZWARTN]
composes_with: [081KQ8P5D0008QG0R000N718AC, 081KQ0YZ80008QG0R001QJJTVF]
tags: [substrate-quality, external-anchors, alignment, beacon-safety, research]
type: friction-reducer
---

# HC/SD/DIR alignment-clause external-anchor backfill

Research and land external prior-art anchors for all 21
alignment clauses in `docs/ALIGNMENT.md`. Each clause gets
either (a) a cited human-authored external source or (b) an
explicit "original to Zeta" note.

## Scope — 21 clauses

- HC-1 through HC-7 (Honesty Commitments)
- SD-1 through SD-9 (Safety Defaults)
- DIR-1 through DIR-5 (Directional Commitments)

## Research approach per clause

1. Identify the clause's core property (e.g., HC-1 is about
   truthfulness in AI outputs).
2. WebSearch for the property in AI safety / alignment
   literature, ACM / IEEE / AAAI proceedings, ArXiv, blog
   posts from recognized researchers.
3. If a human-authored prior-art source exists, cite it
   inline in ALIGNMENT.md using a footnote or "Prior art:"
   annotation.
4. If no prior art found after diligent search, add an
   explicit "Original to Zeta — no external prior art found
   as of YYYY-MM-DD" note.
5. Beacon-safety check: verify cited source vocabulary does
   not collide with Beacon-blocked terminology (per
   Otto-351).

## Composes with 081KQ0YZ80008QG0R001QJJTVF

081KQ0YZ80008QG0R001QJJTVF is the ALIGNMENT.md rewrite. If 081KQ0YZ80008QG0R001QJJTVF lands first,
anchor backfill applies to the rewritten surface. If 081KR2E4K0008QG0R0009QXZ77
lands first, anchors carry forward into the rewrite.

## Done-criteria

- [ ] All 21 clauses have either an external anchor citation
      or an explicit "original to Zeta" note.
- [ ] Each citation includes: URL, author/org, title, date.
- [ ] Beacon-safety pass completed on all cited sources.
- [ ] Coverage scanner (081KR2E4K0008QG0R001ZWARTN) shows 21/21 anchored or
      explicitly noted.

## Pre-start checklist (2026-05-09)

**Prior-art-search:**

- Skill router: no existing skill covers external-anchor backfill for
  alignment clauses.
- `tools/alignment/audit_external_anchors.ts` (081KR2E4K0008QG0R001ZWARTN, done 2026-05-09)
  — scanner confirms 60 of 63 concepts are anchor-pending; HC clauses
  all pending before this work.
- Concept registry (081KR2E4K0008QG0R003DS2XHJ): has `anchor:` field (081KR50HA0008QG0R001G4QHQF PR #2316).
- Decision-archaeology: 081KQ8P5D0008QG0R000N718AC umbrella motivates; 081KR2E4K0008QG0R001ZWARTN gates; no
  supersession.

**Dependency-restructure:**

- 081KR2E4K0008QG0R001ZWARTN status updated to `done` in same branch.
- 081KQ0YZ80008QG0R001QJJTVF (ALIGNMENT.md rewrite) is not yet started; HC anchors will
  carry forward per composes_with note.

**Scope decision:**  
Smallest safe slice = HC-1..HC-7 in this PR.
SD-1..SD-9 and DIR-1..DIR-5 in a follow-on PR (081KR2E4K0008QG0R0009QXZ77 part 2).

## Progress

- [x] HC-1: Nissenbaum (2004) contextual integrity + GDPR Art. 7
- [x] HC-2: Richardson saga pattern + Microsoft compensating-transaction
- [x] HC-3: Greshake et al. (2023) indirect prompt injection (ArXiv 2302.12173)
- [x] HC-4: Wei et al. (2023) + Zou et al. (2023) adversarial attacks
- [x] HC-5: Bickmore & Picard (2005) + FTC health claims guidance
- [x] HC-6: Tulving (1972) episodic memory + "original to Zeta" note
- [x] HC-7: Öhman & Watson (2019) digital posthumous + "original to Zeta" note
- [ ] SD-1..SD-9 (follow-on)
- [ ] DIR-1..DIR-5 (follow-on)

## Reviewers

- `alignment-auditor` — clause integrity.
- `threat-model-critic` — Beacon-safety vocabulary check.
