---
id: B-0312
priority: P1
status: open
title: "HC/SD/DIR alignment-clause external-anchor backfill"
tier: substrate-quality
effort: M
parent: B-0060
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0311]
composes_with: [B-0060, B-0003]
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

## Composes with B-0003

B-0003 is the ALIGNMENT.md rewrite. If B-0003 lands first,
anchor backfill applies to the rewritten surface. If B-0312
lands first, anchors carry forward into the rewrite.

## Done-criteria

- [ ] All 21 clauses have either an external anchor citation
      or an explicit "original to Zeta" note.
- [ ] Each citation includes: URL, author/org, title, date.
- [ ] Beacon-safety pass completed on all cited sources.
- [ ] Coverage scanner (B-0311) shows 21/21 anchored or
      explicitly noted.

## Reviewers

- `alignment-auditor` — clause integrity.
- `threat-model-critic` — Beacon-safety vocabulary check.
