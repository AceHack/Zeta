---
id: B-0293
priority: P1
status: open
title: "Coherence AI — consent-first architecture design"
created: 2026-05-08
parent: B-0245
depends_on: []
classification: buildable-now
decomposition: atomic
type: feature
---

# B-0293 — Consent architecture

Design the consent-first architecture: every AI action
requires explicit user consent before execution. KSK
(N-of-M multi-sig) pattern at the consent layer.

## Acceptance criteria

- Architecture doc at docs/research/
- Consent flow: request → display → confirm → execute
- KSK override path documented (military/emergency)
