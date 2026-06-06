---
id: B-0455
zetaid: 081KRA5AR0008QG0R0033TJSAF
priority: P2
status: open
title: T4 onboarding briefing + T5 drift retrospective (trajectory packets)
tier: factory-hygiene
effort: S
ask: Onboarding + measurement per B-0092
created: 2026-05-11
last_updated: 2026-05-14
parent: B-0092
depends_on: [B-0452, B-0453]
composes_with: [B-0090]
renumbered_from: B-0373
renumbered_reason: "ID collision with B-0373 P1 (alignment-proof-primitive-ladder). Part of the P2 contributor-compliance set renumbered as a unit: B-0370→B-0452, B-0371→B-0453, B-0372→B-0454, B-0373→B-0455. Internal depends_on [B-0370, B-0371] remapped to [B-0452, B-0453]. Substrate-cleanup tracked in B-0451."
tags: [contributor-compliance, T4, T5, trajectory, renumbered]
decomposition: atomic
classification: buildable-now
---

# B-0455 — T4 + T5 trajectory packets (renumbered from B-0373)

## Scope (atomic)

- T4: Onboarding briefing text (add to FIRST-PR.md or AGENTS.md onboarding; cite doc).
- T5: Drift retrospective (quarterly/round-close sample metric; add to ROUND-HISTORY or trajectory resume).
- No new code; doc + cadence updates only.

## Acceptance

- [ ] Onboarding text landed.
- [ ] T5 metric sketch + first baseline in docs.
- [ ] Depends on doc + cross-refs.

## Why last

Requires upstream surfaces; keeps graph ordered.
