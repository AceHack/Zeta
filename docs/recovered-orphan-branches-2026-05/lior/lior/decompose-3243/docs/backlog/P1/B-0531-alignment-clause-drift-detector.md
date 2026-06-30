---
id: B-0531
priority: P1
status: open
title: Alignment-clause drift detector
tier: substrate-foundational-discipline
effort: S
ask: Peel off from B-0058
created: 2026-05-14
last_updated: 2026-05-14
decomposition: decomposed-from-B-0058
children: []
depends_on: [B-0058]
composes_with: [docs/ALIGNMENT.md]
tags: [ai-ethics, ai-safety, alignment, drift-detector]
type: friction-reducer
---

# B-0531 — Alignment-clause drift detector

## Origin

Decomposed from B-0058 Step 4 to isolate the drift detector implementation for atomic execution.

## Ask

If a clause in `docs/ALIGNMENT.md` is about to be weakened or removed via the renegotiation protocol, this track generates the impact-survey across factory surfaces that touch the clause. Answers "who depends on this clause, and what breaks if it moves?" before the renegotiation is accepted.

## Owner / effort

- **Owner:** Alignment-auditor (Sova)
- **Effort:** S
